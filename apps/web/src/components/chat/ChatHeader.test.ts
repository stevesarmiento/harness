import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resolveRenameCommit, selectHeaderThreads } from "./ChatHeader";

describe("resolveRenameCommit", () => {
  it("commits a trimmed changed title", () => {
    expect(resolveRenameCommit({ title: "  New title ", originalTitle: "Old" })).toEqual({
      action: "commit",
      title: "New title",
    });
  });

  it("rejects empty and whitespace-only titles", () => {
    expect(resolveRenameCommit({ title: "   ", originalTitle: "Old" })).toEqual({
      action: "reject-empty",
    });
  });

  it("no-ops when the trimmed title is unchanged", () => {
    expect(resolveRenameCommit({ title: " Old ", originalTitle: "Old" })).toEqual({
      action: "noop",
    });
  });
});

// Fork: Forma's header thread switcher lists the project's sibling threads.
describe("selectHeaderThreads", () => {
  const environmentId = EnvironmentId.make("environment-primary");
  const projectId = ProjectId.make("project-one");
  const shell = (
    id: string,
    overrides: Partial<EnvironmentThreadShell> = {},
  ): EnvironmentThreadShell =>
    ({
      environmentId,
      id: ThreadId.make(id),
      projectId,
      title: id,
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      latestUserMessageAt: null,
      ...overrides,
    }) as EnvironmentThreadShell;

  it("keeps active siblings scoped to the physical project and environment", () => {
    const siblings = selectHeaderThreads(
      [
        shell("older", { updatedAt: "2026-01-02T00:00:00.000Z" }),
        shell("newer", { updatedAt: "2026-01-03T00:00:00.000Z" }),
        shell("archived", { archivedAt: "2026-01-04T00:00:00.000Z" }),
        shell("other-project", { projectId: ProjectId.make("project-two") }),
        shell("other-environment", {
          environmentId: EnvironmentId.make("environment-remote"),
        }),
      ],
      environmentId,
      projectId,
      "updated_at",
    );

    expect(siblings.map((thread) => thread.id)).toEqual([
      ThreadId.make("newer"),
      ThreadId.make("older"),
    ]);
  });

  it("respects the configured created-at ordering", () => {
    const siblings = selectHeaderThreads(
      [
        shell("older", { createdAt: "2026-01-02T00:00:00.000Z" }),
        shell("newer", { createdAt: "2026-01-03T00:00:00.000Z" }),
      ],
      environmentId,
      projectId,
      "created_at",
    );

    expect(siblings.map((thread) => thread.id)).toEqual([
      ThreadId.make("newer"),
      ThreadId.make("older"),
    ]);
  });
});
