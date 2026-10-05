import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  ProjectFileVersionConflictError,
  type EnvironmentId,
  type ProjectFileVersion,
} from "@t3tools/contracts";
import { Schema } from "effect";
import { createRef, useEffect, useMemo, useRef, useState } from "react";

import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";

import { FileSaveCoordinator } from "./fileSaveCoordinator";
import { confirmProjectFileQueryData } from "./projectFilesQueryState";

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
  const writeFile = useAtomCommand(projectEnvironment.writeFile);
  // Fork: versioned writes. A conflict pauses autosave until the user reloads
  // or overwrites; until then the last confirmed version stays the baseline.
  const [conflict, setConflict] = useState<ProjectFileVersionConflictError | null>(null);
  const confirmedVersionRef = useRef(version);
  const forceNextWriteRef = useRef(false);
  useEffect(() => {
    if (conflict === null) confirmedVersionRef.current = version;
  }, [conflict, version]);

  const session = useMemo(() => {
    const coordinatorRef = createRef<Pick<FileSaveCoordinator, "change" | "reset" | "resume">>();
    return {
      change: (contents: string) => coordinatorRef.current?.change(contents),
      reset: () => coordinatorRef.current?.reset(),
      resume: () => coordinatorRef.current?.resume(),
      setup: () => {
        const coordinator = new FileSaveCoordinator({
          debounceMs: FILE_SAVE_DEBOUNCE_MS,
          onPendingChange: (pending) => onPendingChange(relativePath, pending),
          persist: (nextContents) => {
            const expectedVersion = forceNextWriteRef.current
              ? undefined
              : confirmedVersionRef.current;
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
            forceNextWriteRef.current = false;
            const confirmedVersion = result?.version;
            confirmedVersionRef.current = confirmedVersion;
            setConflict(null);
            confirmProjectFileQueryData(
              environmentId,
              cwd,
              relativePath,
              confirmedContents,
              confirmedVersion,
            );
          },
          onFailed: (result) => {
            forceNextWriteRef.current = false;
            const cause = squashAtomCommandFailure(result);
            if (!isVersionConflict(cause)) return { pause: false };
            setConflict(cause);
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
  }, [cwd, environmentId, onPendingChange, relativePath, writeFile]);

  // StrictMode replays effect setup. Retired file sessions stay inert, while the
  // replay gets a fresh coordinator instead of reusing a disposed one.
  useEffect(session.setup, [session]);
  return useMemo(
    () => ({
      change: session.change,
      conflict,
      reloadFromDisk: () => {
        session.reset();
        setConflict(null);
      },
      overwrite: () => {
        forceNextWriteRef.current = true;
        session.resume();
      },
    }),
    [conflict, session],
  );
}
