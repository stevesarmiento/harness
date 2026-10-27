// @effect-diagnostics nodeBuiltinImport:off
import { createHash } from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";

import type {
  ProjectCreateDirectoryInput,
  ProjectCreateDirectoryResult,
  ProjectDeleteEntryInput,
  ProjectDeleteEntryResult,
  FilesystemEntryMetadata,
  FilesystemGetMetadataInput,
  FilesystemGetMetadataResult,
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectRenameEntryInput,
  ProjectRenameEntryResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "@t3tools/contracts";
import {
  ProjectCreateDirectoryError,
  ProjectDeleteEntryError,
  ProjectFileVersionConflictError,
  ProjectRenameEntryError,
} from "@t3tools/contracts";
import { expandHomePath } from "@t3tools/provider-core/server/pathExpansion";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { isNetworkPath } from "@t3tools/shared/path";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import * as KnownWorkspaces from "./KnownWorkspaces.ts";
import * as WorkspaceEntries from "./WorkspaceEntries.ts";
import * as WorkspacePaths from "./WorkspacePaths.ts";
import * as WorkspaceProtectedPaths from "./WorkspaceProtectedPaths.ts";
import { fileHeaderMimeType } from "./fileHeaderMimeType.ts";

const PROJECT_READ_FILE_MAX_BYTES = 1024 * 1024;
const FILE_HASH_CHUNK_BYTES = 64 * 1024;

async function hashOpenFile(handle: NodeFSP.FileHandle): Promise<string> {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(FILE_HASH_CHUNK_BYTES);
  let position = 0;
  while (true) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
    if (bytesRead === 0) break;
    hash.update(buffer.subarray(0, bytesRead));
    position += bytesRead;
  }
  return hash.digest("hex");
}

function hashString(contents: string): string {
  return createHash("sha256").update(Buffer.from(contents, "utf8")).digest("hex");
}

function hasNodeErrorCode(cause: unknown, code: string): boolean {
  return (
    cause !== null &&
    typeof cause === "object" &&
    "code" in cause &&
    (cause as { readonly code?: unknown }).code === code
  );
}

// NTFS reaches .git through trailing dots/spaces, stream suffixes and GIT~1; compare uppercased names.
const isGitMetadataName = (segment: string) => {
  const name = (segment.split(":")[0] ?? "").replace(/[. ]+$/, "").toUpperCase();
  return name === ".GIT" || name === "GIT~1";
};

export class WorkspaceFileSystemOperationError extends Schema.TaggedError<WorkspaceFileSystemOperationError>()(
  "WorkspaceFileSystemOperationError",
  {
    workspaceRoot: Schema.String,
    relativePath: Schema.String,
    resolvedPath: Schema.String,
    operationPath: Schema.String,
    operation: Schema.Literals([
      "realpath-workspace-root",
      "realpath-target",
      "open",
      "stat",
      "read",
      "close",
      "make-directory",
      "write-file",
    ]),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Workspace file operation '${this.operation}' failed at '${this.operationPath}' for resolved path '${this.resolvedPath}' (requested as '${this.relativePath}' in '${this.workspaceRoot}').`;
  }
}

export class WorkspaceFilePathEscapeError extends Schema.TaggedError<WorkspaceFilePathEscapeError>()(
  "WorkspaceFilePathEscapeError",
  {
    workspaceRoot: Schema.String,
    relativePath: Schema.String,
    resolvedWorkspaceRoot: Schema.String,
    resolvedPath: Schema.String,
  },
) {
  override get message(): string {
    return `Workspace file '${this.relativePath}' resolves outside workspace root '${this.workspaceRoot}': ${this.resolvedPath}`;
  }
}

export class WorkspacePathNotFileError extends Schema.TaggedError<WorkspacePathNotFileError>()(
  "WorkspacePathNotFileError",
  {
    workspaceRoot: Schema.String,
    relativePath: Schema.String,
    resolvedPath: Schema.String,
  },
) {
  override get message(): string {
    return `Workspace path '${this.relativePath}' in '${this.workspaceRoot}' is not a file: ${this.resolvedPath}`;
  }
}

export class WorkspaceBinaryFileError extends Schema.TaggedError<WorkspaceBinaryFileError>()(
  "WorkspaceBinaryFileError",
  {
    workspaceRoot: Schema.String,
    relativePath: Schema.String,
    resolvedPath: Schema.String,
  },
) {
  override get message(): string {
    return `Workspace file '${this.relativePath}' in '${this.workspaceRoot}' is binary and cannot be previewed as text.`;
  }
}

/**
 * Raised when a file operation targets a path under a protected filesystem
 * location while the Forma "Protected paths" safety setting is enabled.
 */
export class WorkspaceProtectedPathError extends Schema.TaggedError<WorkspaceProtectedPathError>()(
  "WorkspaceProtectedPathError",
  {
    workspaceRoot: Schema.String,
    relativePath: Schema.String,
    resolvedPath: Schema.String,
  },
) {
  override get message(): string {
    return `Workspace path '${this.relativePath}' in '${this.workspaceRoot}' is protected by Forma safety settings.`;
  }
}

export const WorkspaceFileSystemError = Schema.Union([
  WorkspaceFileSystemOperationError,
  WorkspaceFilePathEscapeError,
  WorkspacePathNotFileError,
  WorkspaceBinaryFileError,
  WorkspaceProtectedPathError,
]);
export type WorkspaceFileSystemError = typeof WorkspaceFileSystemError.Type;

export class WorkspaceFileSystem extends Context.Service<
  WorkspaceFileSystem,
  {
    readonly getMetadata: (
      input: FilesystemGetMetadataInput,
    ) => Effect.Effect<FilesystemGetMetadataResult>;

    readonly readFile: (
      input: ProjectReadFileInput,
    ) => Effect.Effect<
      ProjectReadFileResult,
      WorkspaceFileSystemError | WorkspacePaths.WorkspacePathOutsideRootError
    >;
    /** Writes inside a known workspace only. */
    readonly writeFile: (
      input: ProjectWriteFileInput,
    ) => Effect.Effect<
      ProjectWriteFileResult,
      | WorkspaceFileSystemError
      | WorkspacePaths.WorkspacePathOutsideRootError
      | ProjectFileVersionConflictError
      | KnownWorkspaces.UnknownWorkspaceError
    >;
    readonly createDirectory: (
      input: ProjectCreateDirectoryInput,
    ) => Effect.Effect<
      ProjectCreateDirectoryResult,
      ProjectCreateDirectoryError | WorkspacePaths.WorkspacePathOutsideRootError
    >;
    readonly renameEntry: (
      input: ProjectRenameEntryInput,
    ) => Effect.Effect<
      ProjectRenameEntryResult,
      ProjectRenameEntryError | WorkspacePaths.WorkspacePathOutsideRootError
    >;
    readonly deleteEntry: (
      input: ProjectDeleteEntryInput,
    ) => Effect.Effect<
      ProjectDeleteEntryResult,
      ProjectDeleteEntryError | WorkspacePaths.WorkspacePathOutsideRootError
    >;
  }
>()("t3/workspace/WorkspaceFileSystem") {}

/** @public */
export const make = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const workspacePaths = yield* WorkspacePaths.WorkspacePaths;
  const knownWorkspaces = yield* KnownWorkspaces.KnownWorkspaces;
  const workspaceEntries = yield* WorkspaceEntries.WorkspaceEntries;
  const protectedPaths = yield* WorkspaceProtectedPaths.makeProtectedPathsGuard;

  const failIfTargetBlocked = Effect.fn("WorkspaceFileSystem.failIfTargetBlocked")(function* (
    input: { readonly cwd: string; readonly relativePath: string },
    absolutePath: string,
  ) {
    if (yield* protectedPaths.isPathBlocked(absolutePath)) {
      return yield* new WorkspaceProtectedPathError({
        workspaceRoot: input.cwd,
        relativePath: input.relativePath,
        resolvedPath: absolutePath,
      });
    }
  });

  /**
   * Resolve the real (symlink-free) path of a target, verify it stays inside
   * the workspace root, and re-check protected-path blocking on the resolved
   * location. Mirrors the readFile containment checks for destructive
   * operations (rename/delete) where a symlink escape has a large blast radius.
   */
  const resolveRealTargetWithinRoot = Effect.fn("WorkspaceFileSystem.resolveRealTargetWithinRoot")(
    function* (
      input: { readonly cwd: string; readonly relativePath: string },
      absolutePath: string,
    ) {
      const realWorkspaceRoot = yield* Effect.tryPromise({
        try: () => NodeFSP.realpath(input.cwd),
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: absolutePath,
            operationPath: input.cwd,
            operation: "realpath-workspace-root",
            cause,
          }),
      });
      const realTargetPath = yield* Effect.tryPromise({
        try: () => NodeFSP.realpath(absolutePath),
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: absolutePath,
            operationPath: absolutePath,
            operation: "realpath-target",
            cause,
          }),
      });
      const relativeRealPath = path.relative(realWorkspaceRoot, realTargetPath);
      if (
        relativeRealPath.startsWith(`..${path.sep}`) ||
        relativeRealPath === ".." ||
        path.isAbsolute(relativeRealPath)
      ) {
        return yield* new WorkspaceFilePathEscapeError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedWorkspaceRoot: realWorkspaceRoot,
          resolvedPath: realTargetPath,
        });
      }
      yield* failIfTargetBlocked(input, realTargetPath);
      return realTargetPath;
    },
  );

  const metadataForPath = Effect.fnUntraced(function* (requestedPath: string) {
    const expandedPath = expandHomePath(requestedPath, yield* HostProcess.HomeDirectory);
    // Chips ask as soon as an agent's message renders, and touching a network
    // path makes Windows sign in to its host with the user's NTLM credentials.
    if (!path.isAbsolute(expandedPath) || isNetworkPath(expandedPath)) return null;
    const stat = yield* fileSystem.stat(expandedPath).pipe(Effect.option);
    if (stat._tag === "None") return null;
    if (stat.value.type === "Directory") return { kind: "directory" } as const;
    if (stat.value.type !== "File") return { kind: "other" } as const;
    let mimeType: string | undefined;
    if (path.extname(expandedPath) === "" && stat.value.size > 0) {
      mimeType = yield* Effect.tryPromise({
        try: async () => {
          const handle = await NodeFSP.open(
            expandedPath,
            NodeFS.constants.O_RDONLY | NodeFS.constants.O_NONBLOCK,
          );
          try {
            if (!(await handle.stat()).isFile()) return undefined;
            const buffer = Buffer.alloc(512);
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
            return fileHeaderMimeType(buffer.subarray(0, bytesRead));
          } finally {
            await handle.close();
          }
        },
        catch: () => undefined,
      }).pipe(Effect.orElseSucceed(() => undefined));
    }
    return {
      kind: "file",
      byteLength: Number(stat.value.size),
      ...(mimeType === undefined ? {} : { mimeType }),
    } satisfies FilesystemEntryMetadata;
  });

  const getMetadata: WorkspaceFileSystem["Service"]["getMetadata"] = Effect.fn(
    "WorkspaceFileSystem.getMetadata",
  )(function* (input) {
    const paths = [...new Set(input.paths)];
    const entries = yield* Effect.forEach(paths, metadataForPath, { concurrency: 8 });
    const byPath = new Map(paths.map((value, index) => [value, entries[index] ?? null]));
    return { entries: input.paths.map((value) => byPath.get(value) ?? null) };
  });

  /** Both paths must already be real paths. */
  const isInsideRealRoot = (realWorkspaceRoot: string, realPath: string) => {
    const relative = path.relative(realWorkspaceRoot, realPath);
    return !(
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative)
    );
  };

  // Reject Git folders, including renamed bare repos whose config/hooks can execute; paths must be normalized.
  // Stop at linked worktrees' .git files since worktrees can sit inside bare repos.
  const isInGitFolder = async (absolutePath: string) => {
    if (absolutePath.split(path.sep).some(isGitMetadataName)) return true;
    for (let folder = path.dirname(absolutePath); ; folder = path.dirname(folder)) {
      const [head, commondir, objects, refs, dotGit] = await Promise.all(
        ["HEAD", "commondir", "objects", "refs", ".git"].map((name) =>
          NodeFSP.lstat(path.join(folder, name)).catch((error: NodeJS.ErrnoException) => {
            // Any other failure leaves the folder unknown, so the write is refused.
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
            throw error;
          }),
        ),
      );
      // Git recognizes HEAD with commondir or objects/refs as a repository.
      if (head && (commondir || (objects && refs))) return true;
      if (dotGit?.isFile() || path.dirname(folder) === folder) return false;
    }
  };

  /**
   * Workspace-relative paths must stay inside the root, symlinks included. An
   * absolute or `~/` path reads a host file in place, such as a report an agent
   * wrote to a temp directory; it gets no root check. A network path does, since
   * Windows signs in to its host with the user's NTLM credentials.
   */
  const resolveReadTarget = Effect.fn("WorkspaceFileSystem.resolveReadTarget")(function* (
    input: ProjectReadFileInput,
  ) {
    const requestedPath = input.relativePath.trim();
    const hostPath = requestedPath.startsWith("~/")
      ? expandHomePath(requestedPath, yield* HostProcess.HomeDirectory)
      : requestedPath;
    if (
      isNetworkPath(hostPath) &&
      !KnownWorkspaces.isWithinRoot(path, path.resolve(hostPath), path.resolve(input.cwd))
    ) {
      return yield* new WorkspacePaths.WorkspacePathOutsideRootError({
        workspaceRoot: input.cwd,
        relativePath: input.relativePath,
      });
    }
    if (path.isAbsolute(hostPath)) {
      // Native realpath hands Windows a `\\?\` path as written, `..` included,
      // so a network path must be the resolved one the check above approved.
      // Others keep POSIX `link/..` semantics, which resolving first would change.
      const absolutePath = isNetworkPath(hostPath) ? path.resolve(hostPath) : hostPath;
      const realTargetPath = yield* Effect.tryPromise({
        try: () => NodeFSP.realpath(absolutePath),
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: absolutePath,
            operationPath: absolutePath,
            operation: "realpath-target",
            cause,
          }),
      }).pipe(
        Effect.catchIf(
          (error) =>
            input.allowMissing === true && (error.cause as NodeJS.ErrnoException).code === "ENOENT",
          () => Effect.succeed(null),
        ),
      );
      // Fork: absolute host reads must still respect the protected-paths guard.
      if (realTargetPath !== null) yield* failIfTargetBlocked(input, realTargetPath);
      return { relativePath: requestedPath, realTargetPath };
    }

    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });
    yield* failIfTargetBlocked(input, target.absolutePath);

    const realWorkspaceRoot = yield* Effect.tryPromise({
      try: () => NodeFSP.realpath(path.resolve(input.cwd)),
      catch: (cause) =>
        new WorkspaceFileSystemOperationError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedPath: target.absolutePath,
          operationPath: input.cwd,
          operation: "realpath-workspace-root",
          cause,
        }),
    });
    const resolved = yield* Effect.tryPromise({
      try: async () => {
        let candidate = target.absolutePath;
        for (;;) {
          try {
            return {
              realTargetPath: path.join(
                await NodeFSP.realpath(candidate),
                path.relative(candidate, target.absolutePath),
              ),
              exists: candidate === target.absolutePath,
            };
          } catch (error) {
            if (!input.allowMissing || (error as NodeJS.ErrnoException).code !== "ENOENT") {
              throw error;
            }
            // Like writes, missing reads must check the nearest existing ancestor.
            // An existing entry that cannot resolve is a dangling link, not absence.
            const exists = await NodeFSP.lstat(candidate).then(
              () => true,
              (cause: NodeJS.ErrnoException) => {
                if (cause.code !== "ENOENT") throw cause;
                return false;
              },
            );
            if (exists || path.dirname(candidate) === candidate) throw error;
            candidate = path.dirname(candidate);
          }
        }
      },
      catch: (cause) =>
        new WorkspaceFileSystemOperationError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedPath: target.absolutePath,
          operationPath: target.absolutePath,
          operation: "realpath-target",
          cause,
        }),
    });
    if (!isInsideRealRoot(realWorkspaceRoot, resolved.realTargetPath)) {
      return yield* new WorkspaceFilePathEscapeError({
        workspaceRoot: input.cwd,
        relativePath: input.relativePath,
        resolvedWorkspaceRoot: realWorkspaceRoot,
        resolvedPath: resolved.realTargetPath,
      });
    }
    // Fork: re-check after symlink resolution so links inside the workspace
    // cannot escape into protected locations.
    yield* failIfTargetBlocked(input, resolved.realTargetPath);
    return {
      relativePath: target.relativePath,
      realTargetPath: resolved.exists ? resolved.realTargetPath : null,
    };
  });

  const readFile: WorkspaceFileSystem["Service"]["readFile"] = Effect.fn(
    "WorkspaceFileSystem.readFile",
  )(function* (input) {
    const target = yield* resolveReadTarget(input);
    const absentResult = {
      relativePath: target.relativePath,
      contents: "",
      byteLength: 0,
      truncated: false,
      exists: false,
    };
    const realTargetPath = target.realTargetPath;
    if (realTargetPath === null) return absentResult;

    return yield* Effect.acquireUseRelease(
      Effect.tryPromise({
        // Non-blocking opens prevent FIFO hangs before stat rejects them; Windows lacks the flag.
        try: () =>
          NodeFSP.open(
            realTargetPath,
            NodeFS.constants.O_RDONLY | (NodeFS.constants.O_NONBLOCK ?? 0),
          ),
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: realTargetPath,
            operationPath: realTargetPath,
            operation: "open",
            cause,
          }),
      }).pipe(
        Effect.catchIf(
          (error) =>
            input.allowMissing === true && (error.cause as NodeJS.ErrnoException).code === "ENOENT",
          () => Effect.succeed(null),
        ),
      ),
      (handle) =>
        Effect.gen(function* () {
          if (handle === null) return absentResult;
          const stat = yield* Effect.tryPromise({
            try: () => handle.stat(),
            catch: (cause) =>
              new WorkspaceFileSystemOperationError({
                workspaceRoot: input.cwd,
                relativePath: input.relativePath,
                resolvedPath: realTargetPath,
                operationPath: realTargetPath,
                operation: "stat",
                cause,
              }),
          });
          if (!stat.isFile()) {
            return yield* new WorkspacePathNotFileError({
              workspaceRoot: input.cwd,
              relativePath: input.relativePath,
              resolvedPath: realTargetPath,
            });
          }

          const bytesToRead = Math.min(stat.size, PROJECT_READ_FILE_MAX_BYTES);
          const buffer = Buffer.alloc(bytesToRead);
          const { bytesRead } = yield* Effect.tryPromise({
            try: () => handle.read(buffer, 0, bytesToRead, 0),
            catch: (cause) =>
              new WorkspaceFileSystemOperationError({
                workspaceRoot: input.cwd,
                relativePath: input.relativePath,
                resolvedPath: realTargetPath,
                operationPath: realTargetPath,
                operation: "read",
                cause,
              }),
          });
          const fileBytes = buffer.subarray(0, bytesRead);
          if (fileBytes.includes(0)) {
            return yield* new WorkspaceBinaryFileError({
              workspaceRoot: input.cwd,
              relativePath: input.relativePath,
              resolvedPath: realTargetPath,
            });
          }

          return {
            relativePath: target.relativePath,
            contents: new TextDecoder("utf-8").decode(fileBytes),
            byteLength: stat.size,
            truncated: stat.size > PROJECT_READ_FILE_MAX_BYTES,
            version: yield* Effect.tryPromise({
              try: () => hashOpenFile(handle),
              catch: (cause) =>
                new WorkspaceFileSystemOperationError({
                  workspaceRoot: input.cwd,
                  relativePath: input.relativePath,
                  resolvedPath: realTargetPath,
                  operationPath: realTargetPath,
                  operation: "read",
                  cause,
                }),
            }),
          };
        }),
      (handle) =>
        handle === null
          ? Effect.void
          : Effect.tryPromise({
              try: () => handle.close(),
              catch: (cause) =>
                new WorkspaceFileSystemOperationError({
                  workspaceRoot: input.cwd,
                  relativePath: input.relativePath,
                  resolvedPath: realTargetPath,
                  operationPath: realTargetPath,
                  operation: "close",
                  cause,
                }),
            }),
    );
  });

  // Resolve existing ancestors and reject dangling links so creation cannot follow symlinks outside root.
  const resolveWriteTarget = Effect.fn("WorkspaceFileSystem.resolveWriteTarget")(function* (
    input: ProjectWriteFileInput,
  ) {
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });
    const realWorkspaceRoot = yield* Effect.tryPromise({
      // Resolve `..` in cwd the way the relative path was resolved, before following links.
      try: () => NodeFSP.realpath(path.resolve(input.cwd)),
      catch: (cause) =>
        new WorkspaceFileSystemOperationError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedPath: target.absolutePath,
          operationPath: input.cwd,
          operation: "realpath-workspace-root",
          cause,
        }),
    });

    // Split the host path, not the display relativePath: on POSIX `\` is a file name character.
    const segments = path.relative(input.cwd, target.absolutePath).split(path.sep);
    const realTargetPath = yield* Effect.tryPromise({
      try: async () => {
        for (let depth = segments.length; depth > 0; depth--) {
          const candidate = path.join(realWorkspaceRoot, ...segments.slice(0, depth));
          try {
            return path.join(await NodeFSP.realpath(candidate), ...segments.slice(depth));
          } catch (error) {
            // Only a missing entry is skipped; one that exists but cannot resolve is a dangling link.
            const exists = await NodeFSP.lstat(candidate).then(
              () => true,
              () => false,
            );
            if ((error as NodeJS.ErrnoException).code !== "ENOENT" || exists) throw error;
          }
        }
        return path.join(realWorkspaceRoot, ...segments);
      },
      catch: (cause) =>
        new WorkspaceFileSystemOperationError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedPath: target.absolutePath,
          operationPath: target.absolutePath,
          operation: "realpath-target",
          cause,
        }),
    });
    // The path as named is checked too: a `.git/config` symlink resolves away the `.git`.
    const namedTargetPath = path.join(realWorkspaceRoot, ...segments);
    const inGitFolder = Effect.fn("WorkspaceFileSystem.inGitFolder")((checkedPath: string) =>
      Effect.tryPromise({
        try: () => isInGitFolder(checkedPath),
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: realTargetPath,
            operationPath: checkedPath,
            operation: "stat",
            cause,
          }),
      }),
    );
    if (
      !isInsideRealRoot(realWorkspaceRoot, realTargetPath) ||
      (yield* inGitFolder(realTargetPath)) ||
      (yield* inGitFolder(namedTargetPath))
    ) {
      return yield* new WorkspaceFilePathEscapeError({
        workspaceRoot: input.cwd,
        relativePath: input.relativePath,
        resolvedWorkspaceRoot: realWorkspaceRoot,
        resolvedPath: realTargetPath,
      });
    }
    return { relativePath: target.relativePath, realTargetPath };
  });

  const writeFile: WorkspaceFileSystem["Service"]["writeFile"] = Effect.fn(
    "WorkspaceFileSystem.writeFile",
  )(function* (input) {
    yield* knownWorkspaces.assertContains(input.cwd);
    const target = yield* resolveWriteTarget(input);
    const realTargetPath = target.realTargetPath;
    // Fork: protected paths (Settings → Safety) and optimistic version checks.
    yield* failIfTargetBlocked(input, realTargetPath);
    if ("expectedVersion" in input) {
      const currentBytes = yield* Effect.tryPromise({
        try: async () => {
          try {
            return await NodeFSP.readFile(realTargetPath);
          } catch (cause) {
            if (hasNodeErrorCode(cause, "ENOENT")) return null;
            throw cause;
          }
        },
        catch: (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: realTargetPath,
            operationPath: realTargetPath,
            operation: "read",
            cause,
          }),
      });
      const actualVersion =
        currentBytes === null ? null : createHash("sha256").update(currentBytes).digest("hex");
      if (input.expectedVersion !== actualVersion) {
        return yield* new ProjectFileVersionConflictError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          expectedVersion: input.expectedVersion ?? null,
          actualVersion,
          message:
            input.expectedVersion === null
              ? `Workspace file already exists: ${target.relativePath}`
              : `Workspace file changed on disk: ${target.relativePath}`,
        });
      }
    }

    yield* fileSystem.makeDirectory(path.dirname(realTargetPath), { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new WorkspaceFileSystemOperationError({
            workspaceRoot: input.cwd,
            relativePath: input.relativePath,
            resolvedPath: realTargetPath,
            operationPath: path.dirname(realTargetPath),
            operation: "make-directory",
            cause,
          }),
      ),
    );
    yield* Effect.tryPromise({
      // A symlink swapped in after the check is not followed. Windows lacks O_NOFOLLOW.
      try: () =>
        NodeFSP.writeFile(realTargetPath, input.contents, {
          flag:
            NodeFS.constants.O_WRONLY |
            NodeFS.constants.O_CREAT |
            NodeFS.constants.O_TRUNC |
            (NodeFS.constants.O_NOFOLLOW ?? 0),
        }),
      catch: (cause) =>
        new WorkspaceFileSystemOperationError({
          workspaceRoot: input.cwd,
          relativePath: input.relativePath,
          resolvedPath: realTargetPath,
          operationPath: realTargetPath,
          operation: "write-file",
          cause,
        }),
    });
    yield* workspaceEntries.refresh(input.cwd);
    return {
      relativePath: target.relativePath,
      version: hashString(input.contents),
    };
  });

  const createDirectory: WorkspaceFileSystem["Service"]["createDirectory"] = Effect.fn(
    "WorkspaceFileSystem.createDirectory",
  )(function* (input) {
    // Fork: entry mutations follow writeFile and only touch known workspaces.
    yield* knownWorkspaces.assertContains(input.cwd).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectCreateDirectoryError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });
    yield* failIfTargetBlocked(input, target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectCreateDirectoryError({
            cwd: input.cwd,
            relativePath: target.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    if (target.relativePath === "." || target.relativePath.length === 0) {
      return yield* new ProjectCreateDirectoryError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        message: "The workspace root cannot be created as a child entry.",
      });
    }

    yield* Effect.tryPromise({
      try: async () => {
        try {
          await NodeFSP.stat(target.absolutePath);
          throw new Error("entry-exists");
        } catch (cause) {
          if (hasNodeErrorCode(cause, "ENOENT")) return;
          throw cause;
        }
      },
      catch: (cause) =>
        new ProjectCreateDirectoryError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          message:
            cause instanceof Error && cause.message === "entry-exists"
              ? `Workspace path already exists: ${target.relativePath}`
              : `Failed to create workspace directory: ${String(cause)}`,
          cause,
        }),
    });
    yield* Effect.tryPromise({
      try: () => NodeFSP.mkdir(target.absolutePath, { recursive: true }),
      catch: (cause) =>
        new ProjectCreateDirectoryError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          message: `Failed to create workspace directory: ${String(cause)}`,
          cause,
        }),
    });
    yield* workspaceEntries.refresh(input.cwd);
    return { relativePath: target.relativePath };
  });

  const renameEntry: WorkspaceFileSystem["Service"]["renameEntry"] = Effect.fn(
    "WorkspaceFileSystem.renameEntry",
  )(function* (input) {
    yield* knownWorkspaces.assertContains(input.cwd).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectRenameEntryError({
            cwd: input.cwd,
            fromRelativePath: input.fromRelativePath,
            toRelativePath: input.toRelativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    const source = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.fromRelativePath,
    });
    const destination = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.toRelativePath,
    });
    yield* failIfTargetBlocked(
      { cwd: input.cwd, relativePath: input.fromRelativePath },
      source.absolutePath,
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectRenameEntryError({
            cwd: input.cwd,
            fromRelativePath: source.relativePath,
            toRelativePath: destination.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    yield* failIfTargetBlocked(
      { cwd: input.cwd, relativePath: input.toRelativePath },
      destination.absolutePath,
    ).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectRenameEntryError({
            cwd: input.cwd,
            fromRelativePath: source.relativePath,
            toRelativePath: destination.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    if (
      source.relativePath === destination.relativePath ||
      source.relativePath === "." ||
      destination.relativePath === "."
    ) {
      return yield* new ProjectRenameEntryError({
        cwd: input.cwd,
        fromRelativePath: source.relativePath,
        toRelativePath: destination.relativePath,
        message: "The workspace root cannot be renamed.",
      });
    }

    const sourceStat = yield* Effect.tryPromise({
      try: () => NodeFSP.stat(source.absolutePath),
      catch: (cause) =>
        new ProjectRenameEntryError({
          cwd: input.cwd,
          fromRelativePath: source.relativePath,
          toRelativePath: destination.relativePath,
          message: `Failed to inspect workspace path before rename: ${String(cause)}`,
          cause,
        }),
    });
    const mapRenameGuardError = (cause: { readonly message: string }) =>
      new ProjectRenameEntryError({
        cwd: input.cwd,
        fromRelativePath: source.relativePath,
        toRelativePath: destination.relativePath,
        message: cause.message,
        cause,
      });
    // Symlink-escape re-check + protected re-check on the resolved source.
    const realSourcePath = yield* resolveRealTargetWithinRoot(
      { cwd: input.cwd, relativePath: input.fromRelativePath },
      source.absolutePath,
    ).pipe(Effect.mapError(mapRenameGuardError));
    // Renaming an unprotected ancestor must not relocate protected locations
    // nested underneath it.
    if (sourceStat.isDirectory() && (yield* protectedPaths.hasBlockedDescendants(realSourcePath))) {
      return yield* new ProjectRenameEntryError({
        cwd: input.cwd,
        fromRelativePath: source.relativePath,
        toRelativePath: destination.relativePath,
        message: `Workspace path contains protected locations and cannot be renamed: ${source.relativePath}`,
      });
    }
    yield* Effect.tryPromise({
      try: async () => {
        try {
          await NodeFSP.stat(destination.absolutePath);
          throw new Error("entry-exists");
        } catch (cause) {
          if (hasNodeErrorCode(cause, "ENOENT")) return;
          throw cause;
        }
      },
      catch: (cause) =>
        new ProjectRenameEntryError({
          cwd: input.cwd,
          fromRelativePath: source.relativePath,
          toRelativePath: destination.relativePath,
          message:
            cause instanceof Error && cause.message === "entry-exists"
              ? `Workspace path already exists: ${destination.relativePath}`
              : `Failed to validate workspace rename target: ${String(cause)}`,
          cause,
        }),
    });
    yield* Effect.tryPromise({
      try: () => NodeFSP.mkdir(path.dirname(destination.absolutePath), { recursive: true }),
      catch: (cause) =>
        new ProjectRenameEntryError({
          cwd: input.cwd,
          fromRelativePath: source.relativePath,
          toRelativePath: destination.relativePath,
          message: `Failed to create rename target parent: ${String(cause)}`,
          cause,
        }),
    });
    yield* Effect.tryPromise({
      try: () => NodeFSP.rename(source.absolutePath, destination.absolutePath),
      catch: (cause) =>
        new ProjectRenameEntryError({
          cwd: input.cwd,
          fromRelativePath: source.relativePath,
          toRelativePath: destination.relativePath,
          message: `Failed to rename workspace path: ${String(cause)}`,
          cause,
        }),
    });
    yield* workspaceEntries.refresh(input.cwd);
    return {
      fromRelativePath: source.relativePath,
      toRelativePath: destination.relativePath,
      kind: sourceStat.isDirectory() ? "directory" : "file",
    };
  });

  const deleteEntry: WorkspaceFileSystem["Service"]["deleteEntry"] = Effect.fn(
    "WorkspaceFileSystem.deleteEntry",
  )(function* (input) {
    yield* knownWorkspaces.assertContains(input.cwd).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectDeleteEntryError({
            cwd: input.cwd,
            relativePath: input.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    const target = yield* workspacePaths.resolveRelativePathWithinRoot({
      workspaceRoot: input.cwd,
      relativePath: input.relativePath,
    });
    if (target.relativePath === "." || target.relativePath.length === 0) {
      return yield* new ProjectDeleteEntryError({
        cwd: input.cwd,
        relativePath: input.relativePath,
        message: "The workspace root cannot be deleted.",
      });
    }
    yield* failIfTargetBlocked(input, target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectDeleteEntryError({
            cwd: input.cwd,
            relativePath: target.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    const stat = yield* Effect.tryPromise({
      try: () => NodeFSP.stat(target.absolutePath),
      catch: (cause) =>
        new ProjectDeleteEntryError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          message: `Failed to inspect workspace path before delete: ${String(cause)}`,
          cause,
        }),
    });
    if (stat.isDirectory() && !input.recursive) {
      return yield* new ProjectDeleteEntryError({
        cwd: input.cwd,
        relativePath: target.relativePath,
        message: `Workspace directory delete requires recursive=true: ${target.relativePath}`,
      });
    }
    // Symlink-escape re-check + protected re-check on the resolved location.
    const realTargetPath = yield* resolveRealTargetWithinRoot(input, target.absolutePath).pipe(
      Effect.mapError(
        (cause) =>
          new ProjectDeleteEntryError({
            cwd: input.cwd,
            relativePath: target.relativePath,
            message: cause.message,
            cause,
          }),
      ),
    );
    // Recursive delete of an unprotected ancestor must not wipe protected
    // locations nested underneath it (e.g. a workspace above the home dir).
    if (stat.isDirectory() && (yield* protectedPaths.hasBlockedDescendants(realTargetPath))) {
      return yield* new ProjectDeleteEntryError({
        cwd: input.cwd,
        relativePath: target.relativePath,
        message: `Workspace path contains protected locations and cannot be deleted: ${target.relativePath}`,
      });
    }
    yield* Effect.tryPromise({
      try: () =>
        NodeFSP.rm(target.absolutePath, {
          recursive: stat.isDirectory(),
          force: false,
        }),
      catch: (cause) =>
        new ProjectDeleteEntryError({
          cwd: input.cwd,
          relativePath: target.relativePath,
          message: `Failed to delete workspace path: ${String(cause)}`,
          cause,
        }),
    });
    yield* workspaceEntries.refresh(input.cwd);
    return {
      relativePath: target.relativePath,
      kind: stat.isDirectory() ? "directory" : "file",
    };
  });

  return WorkspaceFileSystem.of({
    getMetadata,
    readFile,
    writeFile,
    createDirectory,
    renameEntry,
    deleteEntry,
  });
});

export const layer = Layer.effect(WorkspaceFileSystem, make);
