import type { OrchestrationV2ThreadProjection } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import { proposedPlanTitle } from "../proposedPlan";
import type { Project, Thread } from "../types";

export interface ThreadMarkdownExportInput {
  readonly thread: Thread;
  /** The thread's V2 detail projection: the transcript, plans, and checkpoints. */
  readonly projection: OrchestrationV2ThreadProjection;
  readonly project?: Pick<Project, "id" | "title" | "workspaceRoot"> | null;
  readonly workspaceRoot?: string | null | undefined;
}

function stableSerialize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSerialize);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).toSorted(([left], [right]) =>
      left.localeCompare(right),
    );
    return Object.fromEntries(entries.map(([key, nested]) => [key, stableSerialize(nested)]));
  }
  return value;
}

function stablePrettyJson(value: unknown): string {
  return JSON.stringify(stableSerialize(value), null, 2);
}

function metadata(label: string, value: string | null | undefined): string {
  return `- ${label}: ${value && value.trim().length > 0 ? value : "n/a"}`;
}

function messagesSection(projection: OrchestrationV2ThreadProjection): string {
  if (projection.messages.length === 0) return "None.";
  return projection.messages
    .map((message, index) => {
      const attachments =
        message.attachments.length === 0
          ? ["Attachments: none"]
          : [
              "Attachments:",
              ...message.attachments.map((attachment) =>
                [
                  `- Type: ${attachment.type}`,
                  `  Name: ${attachment.name}`,
                  `  MIME type: ${attachment.mimeType}`,
                  `  Size bytes: ${String(attachment.sizeBytes)}`,
                ].join("\n"),
              ),
            ];
      return [
        `### Message ${index + 1}`,
        metadata("Role", message.role),
        metadata("Message ID", message.id),
        metadata("Timestamp", DateTime.formatIso(message.createdAt)),
        metadata("Run ID", message.runId),
        ...attachments,
        "Body:",
        "```md",
        message.text,
        "```",
      ].join("\n");
    })
    .join("\n\n");
}

function plansSection(projection: OrchestrationV2ThreadProjection): string {
  const plans = projection.plans.filter((plan) => plan.kind === "proposed_plan");
  if (plans.length === 0) return "None.";
  return plans
    .map((plan, index) =>
      [
        `### Plan ${index + 1}: ${proposedPlanTitle(plan.markdown) ?? "Untitled plan"}`,
        metadata("Plan ID", plan.id),
        metadata("Status", plan.status),
        metadata("Run ID", plan.runId),
        "Body:",
        "```md",
        plan.markdown,
        "```",
      ].join("\n"),
    )
    .join("\n\n");
}

function jsonSection(title: string, value: unknown): string {
  return `## ${title}\n\n\`\`\`json\n${stablePrettyJson(value)}\n\`\`\``;
}

export function buildThreadMarkdownExport(input: ThreadMarkdownExportInput): string {
  const latestRun = input.thread.latestRun;
  const latestRunSummary = latestRun
    ? [
        `run=${latestRun.runId}`,
        `status=${latestRun.status}`,
        `requestedAt=${latestRun.requestedAt ?? "n/a"}`,
        `startedAt=${latestRun.startedAt ?? "n/a"}`,
        `completedAt=${latestRun.completedAt ?? "n/a"}`,
      ].join("; ")
    : null;

  return [
    `# ${input.thread.title}`,
    "",
    "## Metadata",
    "",
    metadata("Thread ID", input.thread.id),
    metadata("Environment ID", input.thread.environmentId),
    metadata("Project ID", input.project?.id ?? input.thread.projectId),
    metadata("Project name", input.project?.title),
    metadata("Project cwd", input.project?.workspaceRoot),
    metadata("Branch", input.thread.branch),
    metadata("Worktree path", input.thread.worktreePath),
    metadata("Workspace root", input.workspaceRoot ?? input.thread.worktreePath),
    metadata("Provider instance", input.thread.modelSelection.instanceId),
    metadata("Model", input.thread.modelSelection.model),
    metadata(
      "Model options",
      input.thread.modelSelection.options
        ? stablePrettyJson(input.thread.modelSelection.options)
        : null,
    ),
    metadata("Runtime mode", input.thread.runtimeMode),
    metadata("Interaction mode", input.thread.interactionMode),
    metadata("Runtime status", input.thread.runtime?.status),
    metadata("Created At", input.thread.createdAt),
    metadata("Updated At", input.thread.updatedAt),
    metadata("Archived At", input.thread.archivedAt),
    metadata("Latest run summary", latestRunSummary),
    "",
    "## Messages",
    "",
    messagesSection(input.projection),
    "",
    "## Proposed Plans",
    "",
    plansSection(input.projection),
    "",
    jsonSection(
      "Checkpoints",
      input.projection.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        runId: checkpoint.runId,
        status: checkpoint.status,
        ref: checkpoint.ref,
        capturedAt: DateTime.formatIso(checkpoint.capturedAt),
        files: checkpoint.files,
      })),
    ),
    "",
  ].join("\n");
}

export function threadMarkdownFilename(title: string, threadId: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `${slug || "thread"}-${threadId.slice(0, 8)}.md`;
}

export function downloadThreadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
