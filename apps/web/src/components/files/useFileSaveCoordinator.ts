import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  AuthFilesystemWriteScope,
  ProjectFileVersionConflictError,
  type EnvironmentId,
  type ProjectFileVersion,
} from "@t3tools/contracts";
import { Schema } from "effect";
import { createRef, useEffect, useState } from "react";

import { projectEnvironment } from "~/state/projects";
import { readEnvironmentScope, useEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";

import { FileSaveCoordinator } from "./fileSaveCoordinator";
import {
  confirmProjectFileQueryData,
  getUnsavedProjectFileQueryData,
} from "./projectFilesQueryState";

const FILE_SAVE_DEBOUNCE_MS = 500;
const isVersionConflict = Schema.is(ProjectFileVersionConflictError);

interface FileSaveOptions {
  environmentId: EnvironmentId;
  cwd: string;
  relativePath: string;
  // Fork: the version the editor loaded. Absent when the environment server
  // predates versioned project files; saves then degrade to unversioned writes.
  version?: ProjectFileVersion | undefined;
  onPendingChange: (relativePath: string, pending: boolean) => void;
}

export interface FileSaveSession {
  change: (contents: string) => void;
  /** Fork: set when the file changed on disk since it was loaded; autosave pauses. */
  conflict: ProjectFileVersionConflictError | null;
  /** Fork: drop the pending draft so the caller can re-read the file. */
  reloadFromDisk: () => void;
  /** Fork: write the pending draft without a version check. */
  overwrite: () => void;
}

export function useFileSaveCoordinator({
  environmentId,
  cwd,
  relativePath,
  version,
  onPendingChange,
}: FileSaveOptions): FileSaveSession {
  const canWriteFiles = useEnvironmentScope(environmentId, AuthFilesystemWriteScope);
  const writeFile = useProjectFileWriter();
  // Fork: versioned writes. A conflict pauses autosave until the user reloads
  // or overwrites; until then the last confirmed version stays the baseline.
  const [conflict, setConflict] = useState<ProjectFileVersionConflictError | null>(null);
  // A session owns the pending debounce, so it must outlive rerenders and be
  // replaced only when what it writes to changes.
  const inputs = { environmentId, cwd, relativePath, onPendingChange, writeFile };
  const [current, setCurrent] = useState(() => ({
    inputs,
    session: createFileSaveSession({ ...inputs, version, onConflict: setConflict }),
  }));
  if (
    current.inputs.environmentId !== environmentId ||
    current.inputs.cwd !== cwd ||
    current.inputs.relativePath !== relativePath ||
    current.inputs.onPendingChange !== onPendingChange ||
    current.inputs.writeFile !== writeFile
  ) {
    setCurrent({
      inputs,
      session: createFileSaveSession({ ...inputs, version, onConflict: setConflict }),
    });
    setConflict(null);
  }
  const session = current.session;

  useEffect(() => {
    if (conflict === null) session.setConfirmedVersion(version);
  }, [conflict, session, version]);

  // StrictMode replays effect setup. Retired file sessions stay inert, while the
  // replay gets a fresh coordinator instead of reusing a disposed one.
  useEffect(session.setup, [session]);
  useEffect(() => {
    if (!canWriteFiles) return;
    let cancelled = false;
    // Replay must retire the first session before recovery queues a draft to flush.
    queueMicrotask(() => {
      if (cancelled) return;
      const unsaved = getUnsavedProjectFileQueryData(environmentId, cwd, relativePath);
      if (unsaved) session.change(unsaved.contents);
    });
    return () => {
      cancelled = true;
    };
  }, [canWriteFiles, cwd, environmentId, relativePath, session]);
  return {
    change: session.change,
    conflict,
    reloadFromDisk: () => {
      session.reset();
      setConflict(null);
    },
    overwrite: session.overwrite,
  };
}

function useProjectFileWriter() {
  return useAtomCommand(projectEnvironment.writeFile);
}

function createFileSaveSession({
  environmentId,
  cwd,
  relativePath,
  version,
  onPendingChange,
  onConflict,
  writeFile,
}: FileSaveOptions & {
  onConflict: (conflict: ProjectFileVersionConflictError | null) => void;
  writeFile: ReturnType<typeof useProjectFileWriter>;
}) {
  const coordinatorRef = createRef<Pick<FileSaveCoordinator, "change" | "reset" | "resume">>();
  // Fork: the version the next write is checked against, and whether the user
  // chose to overwrite a conflicting file on disk.
  let confirmedVersion = version;
  let forceNextWrite = false;
  return {
    change: (contents: string) => coordinatorRef.current?.change(contents),
    reset: () => coordinatorRef.current?.reset(),
    overwrite: () => {
      forceNextWrite = true;
      coordinatorRef.current?.resume();
    },
    setConfirmedVersion: (nextVersion: ProjectFileVersion | undefined) => {
      confirmedVersion = nextVersion;
    },
    setup: () => {
      const coordinator = new FileSaveCoordinator({
        debounceMs: FILE_SAVE_DEBOUNCE_MS,
        canPersist: () => readEnvironmentScope(environmentId, AuthFilesystemWriteScope),
        onPendingChange: (pending) => onPendingChange(relativePath, pending),
        persist: (nextContents) => {
          const expectedVersion = forceNextWrite ? undefined : confirmedVersion;
          return writeFile({
            environmentId,
            input: {
              cwd,
              relativePath,
              contents: nextContents,
              ...(expectedVersion !== undefined ? { expectedVersion } : {}),
            },
          });
        },
        onConfirmed: (confirmedContents, result) => {
          forceNextWrite = false;
          confirmedVersion = result?.version;
          onConflict(null);
          return confirmProjectFileQueryData(
            environmentId,
            cwd,
            relativePath,
            confirmedContents,
            confirmedVersion,
          );
        },
        onFailed: (result) => {
          forceNextWrite = false;
          const cause = squashAtomCommandFailure(result);
          if (!isVersionConflict(cause)) return { pause: false };
          onConflict(cause);
          return { pause: true };
        },
      });
      coordinatorRef.current = coordinator;
      return () => {
        coordinatorRef.current = null;
        coordinator.dispose();
      };
    },
  };
}
