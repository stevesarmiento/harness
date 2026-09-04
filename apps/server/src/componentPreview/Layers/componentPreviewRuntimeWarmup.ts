// @effect-diagnostics nodeBuiltinImport:off - pure path/filesystem helpers for the preview harness.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

export interface PreviewRuntimeWarmupInput {
  readonly projectRoot: string;
  readonly workspaceRoot: string;
  readonly runtimeDir: string;
  readonly harnessRuntimeModulePath: string;
  readonly componentRelativePath: string;
  readonly previewFileRelativePath: string;
  readonly previewComponentRelativePath: string | null;
  readonly moduleMocks: Readonly<Record<string, string>>;
}

export interface PreviewRuntimeWarmupPlan {
  readonly cacheDir: string;
  readonly optimizeDepsEntries: readonly string[];
  readonly warmupFiles: readonly string[];
  readonly readinessPaths: readonly string[];
}

function normalizeFsPath(filePath: string): string {
  return NodePath.resolve(filePath).replaceAll("\\", "/");
}

function normalizeProjectPath(relativePath: string): string {
  return relativePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function normalizeViteFsPath(filePath: string): string {
  const resolved = normalizeFsPath(filePath);
  return resolved.startsWith("/") ? `/@fs${resolved}` : `/@fs/${resolved}`;
}

function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

const PREVIEW_RUNTIME_CACHE_VERSION = "v2";
const PREVIEW_OPTIMIZER_ENTRY_RELATIVE_PATH = "src/optimizer-entry.ts";
const DEPENDENCY_FINGERPRINT_FILES = [
  "package.json",
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
] as const;

function updateHashWithDependencyFile(
  hash: ReturnType<typeof NodeCrypto.createHash>,
  filePath: string,
): void {
  if (!NodeFS.existsSync(filePath)) {
    return;
  }
  hash.update("\0file:");
  hash.update(normalizeFsPath(filePath));
  hash.update("\0");
  hash.update(NodeFS.readFileSync(filePath));
}

export function buildPreviewRuntimeCacheDir(input: {
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}): string {
  const hash = NodeCrypto.createHash("sha256")
    .update(PREVIEW_RUNTIME_CACHE_VERSION)
    .update("\0project:")
    .update(normalizeFsPath(input.projectRoot))
    .update("\0workspace:")
    .update(normalizeFsPath(input.workspaceRoot));
  for (const root of [input.projectRoot, input.workspaceRoot]) {
    for (const fileName of DEPENDENCY_FINGERPRINT_FILES) {
      updateHashWithDependencyFile(hash, NodePath.join(root, fileName));
    }
  }
  const digest = hash.digest("hex").slice(0, 16);
  return NodePath.join(NodeOS.tmpdir(), "t3-component-preview-harness-cache", digest);
}

export function resolvePreviewComponentPath(input: {
  readonly projectRoot: string;
  readonly previewFilePath: string;
  readonly componentRelativePath: string;
  readonly previewComponentRelativePath: string | null;
}): string {
  if (!input.previewComponentRelativePath) {
    return NodePath.join(input.projectRoot, normalizeProjectPath(input.componentRelativePath));
  }
  const normalizedComponentPath = input.previewComponentRelativePath.replaceAll("\\", "/");
  if (normalizedComponentPath.startsWith(".")) {
    return NodePath.resolve(NodePath.dirname(input.previewFilePath), normalizedComponentPath);
  }
  return NodePath.join(input.projectRoot, normalizeProjectPath(normalizedComponentPath));
}

export function buildPreviewRuntimeWarmupPlan(
  input: PreviewRuntimeWarmupInput,
): PreviewRuntimeWarmupPlan {
  const projectPreviewRoot = NodePath.join(input.projectRoot, ".t3", "preview");
  const previewFilePath = NodePath.join(input.projectRoot, input.previewFileRelativePath);
  const componentFilePath = resolvePreviewComponentPath({
    projectRoot: input.projectRoot,
    previewFilePath,
    componentRelativePath: input.componentRelativePath,
    previewComponentRelativePath: input.previewComponentRelativePath,
  });
  const mockFilePaths = Object.values(input.moduleMocks).map((relativePath) =>
    NodePath.join(input.projectRoot, normalizeProjectPath(relativePath)),
  );
  const optimizerEntryPath = NodePath.join(input.runtimeDir, PREVIEW_OPTIMIZER_ENTRY_RELATIVE_PATH);

  const absoluteWarmupFiles = dedupeStrings([
    NodePath.join(input.runtimeDir, "src", "main.tsx"),
    optimizerEntryPath,
    input.harnessRuntimeModulePath,
    NodePath.join(projectPreviewRoot, "wrapper.tsx"),
    NodePath.join(projectPreviewRoot, "mocks.ts"),
    previewFilePath,
    componentFilePath,
    ...mockFilePaths,
  ]).map(normalizeFsPath);

  const readinessPaths = dedupeStrings([
    "/preview.html",
    "/src/main.tsx",
    `${normalizeViteFsPath(previewFilePath)}?import`,
    `${normalizeViteFsPath(NodePath.join(projectPreviewRoot, "wrapper.tsx"))}?import`,
    `${normalizeViteFsPath(NodePath.join(projectPreviewRoot, "mocks.ts"))}?import`,
    `${normalizeViteFsPath(componentFilePath)}?import`,
    ...mockFilePaths.map((mockFilePath) => `${normalizeViteFsPath(mockFilePath)}?import`),
  ]);

  return {
    cacheDir: buildPreviewRuntimeCacheDir(input),
    optimizeDepsEntries: [PREVIEW_OPTIMIZER_ENTRY_RELATIVE_PATH],
    warmupFiles: absoluteWarmupFiles,
    readinessPaths,
  };
}

export function parsePreviewComponentRelativePath(source: string): string | null {
  const componentMatch = source.match(/component\s*:\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/);
  const rawComponentPath = componentMatch?.[2]?.trim();
  return rawComponentPath && rawComponentPath.length > 0
    ? rawComponentPath.replaceAll("\\", "/")
    : null;
}
