import { type EnvironmentId, type ProjectId, type ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import type { SidebarThreadSortOrder } from "@t3tools/contracts/settings";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useNavigate } from "@tanstack/react-router";
import {
  IconBubbleLeftAndTextBubbleRight as ThreadIcon,
  IconCheckmark as CheckIcon,
  IconChevronDown as ChevronDownIcon,
  IconChevronRight as ChevronRightIcon,
  IconCube as CubeIcon,
  IconPlus as PlusIcon,
} from "symbols-react";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { openCommandPalette } from "~/commandPaletteBus";
import { useClientSettings } from "~/hooks/useSettings";
import { useThreadActionMenu } from "~/hooks/useThreadActionMenu";
import { cn } from "~/lib/utils";
import { sortThreads } from "~/lib/threadSort";
import { readLocalApi } from "~/localApi";
import { useThreadShells } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { DesktopSidebarReopenButton } from "../sidebar/DesktopSidebarReopenButton";
import { THREAD_BREADCRUMB_SEPARATOR_ICON_CLASS_NAME } from "../ThreadBreadcrumb";
import { Badge } from "../ui/badge";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarTrigger } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// Fork: Forma's header — sidebar reopen button, a flat project pill that opens
// the project switcher, and a thread pill that opens the project's thread
// switcher — over upstream's header behaviour (inline rename on double-click,
// the thread action menu on right-click, project settings for drafts).
interface ChatHeaderProps {
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  /** Drafts have no server thread yet, so the title carries no action menu. */
  isServerThread: boolean;
  activeProject: EnvironmentProject | null;
  /** Omitted while git status is unknown; false shows the "No Git" badge. */
  isGitRepo?: boolean;
  /** Reserves room for the wider titlebar control cluster shown with an inline right panel. */
  rightPanelOpen: boolean;
  /** Rendered after the breadcrumb, before the titlebar control cluster (e.g. the actions menu). */
  actions?: ReactNode;
  onNewThreadInProject: () => void;
  onOpenProjectSettings?: (() => void) | undefined;
}

/**
 * Rename commit rule shared with the sidebar's inline rename: trim, reject
 * empty (the caller toasts), and skip the mutation when nothing changed.
 */
export function resolveRenameCommit(input: {
  readonly title: string;
  readonly originalTitle: string;
}): { action: "commit"; title: string } | { action: "reject-empty" } | { action: "noop" } {
  const trimmed = input.title.trim();
  if (trimmed.length === 0) return { action: "reject-empty" };
  if (trimmed === input.originalTitle) return { action: "noop" };
  return { action: "commit", title: trimmed };
}

/** Unarchived threads of one project in one environment, in the sidebar's order. */
export function selectHeaderThreads(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  environmentId: EnvironmentId,
  projectId: ProjectId,
  sortOrder: SidebarThreadSortOrder,
): ReadonlyArray<EnvironmentThreadShell> {
  return sortThreads(
    threads.filter(
      (thread) =>
        thread.archivedAt === null &&
        thread.environmentId === environmentId &&
        thread.projectId === projectId,
    ),
    sortOrder,
  );
}

const HEADER_PILL_CLASS_NAME =
  "flex h-6 cursor-pointer items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [-webkit-app-region:no-drag]";

export const ChatHeader = memo(function ChatHeader({
  activeThreadEnvironmentId,
  activeThreadId,
  activeThreadTitle,
  isServerThread,
  activeProject,
  isGitRepo,
  rightPanelOpen,
  actions,
  onNewThreadInProject,
  onOpenProjectSettings,
}: ChatHeaderProps) {
  const activeProjectName = activeProject?.title;
  const activeProjectCwd = activeProject?.workspaceRoot ?? null;
  const activeThreadRef = useMemo(
    () => scopeThreadRef(activeThreadEnvironmentId, activeThreadId),
    [activeThreadEnvironmentId, activeThreadId],
  );
  const updateThreadMetadata = useAtomCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  // Inline rename, keyed by thread: navigating away drops an in-progress
  // rename instead of committing stale text. Cleared on thread change (not
  // just hidden) so returning to the thread doesn't revive the old draft.
  const [renaming, setRenaming] = useState<{
    threadId: ThreadId;
    environmentId: EnvironmentId;
    title: string;
  } | null>(null);
  if (
    renaming !== null &&
    (renaming.threadId !== activeThreadId || renaming.environmentId !== activeThreadEnvironmentId)
  ) {
    setRenaming(null);
  }
  const renamingTitle = renaming?.threadId === activeThreadId ? renaming.title : null;
  const renameCommittedRef = useRef(false);
  const startRename = useCallback(() => {
    renameCommittedRef.current = false;
    setRenaming({
      threadId: activeThreadId,
      environmentId: activeThreadEnvironmentId,
      title: activeThreadTitle,
    });
  }, [activeThreadEnvironmentId, activeThreadId, activeThreadTitle]);
  const commitRename = useCallback(
    (title: string) => {
      setRenaming(null);
      const resolution = resolveRenameCommit({ title, originalTitle: activeThreadTitle });
      if (resolution.action === "reject-empty") {
        toastManager.add({ type: "warning", title: "Thread title cannot be empty" });
        return;
      }
      if (resolution.action === "noop") return;
      void updateThreadMetadata({
        environmentId: activeThreadEnvironmentId,
        input: { threadId: activeThreadId, title: resolution.title },
      }).then((result) => {
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          const error = squashAtomCommandFailure(result);
          toastManager.add({
            type: "error",
            title: "Failed to rename thread",
            description: error instanceof Error ? error.message : "An error occurred.",
          });
        }
      });
    },
    [activeThreadEnvironmentId, activeThreadId, activeThreadTitle, updateThreadMetadata],
  );
  const { openMenu, closeMenu } = useThreadActionMenu({
    threadRef: isServerThread ? activeThreadRef : null,
    projectCwd: activeProjectCwd,
    onStartRename: startRename,
  });
  const handleTitleDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!isServerThread) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // The chevron is the explicit switcher affordance; only the title text renames.
      if ((event.target as HTMLElement).closest("[data-thread-title-chevron]") !== null) return;
      closeMenu();
      startRename();
    },
    [closeMenu, isServerThread, startRename],
  );
  const handleHeaderContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if (renamingTitle !== null) return;
      if (!isServerThread && onOpenProjectSettings === undefined) return;
      event.preventDefault();
      if (!isServerThread) {
        const api = readLocalApi();
        if (!api) return;
        void api.contextMenu
          .show([{ id: "project-settings", label: "Project settings", icon: "settings" }], {
            x: event.clientX,
            y: event.clientY,
          })
          .then((action) => {
            if (action === "project-settings") onOpenProjectSettings?.();
          });
        return;
      }
      openMenu({ x: event.clientX, y: event.clientY });
    },
    [isServerThread, onOpenProjectSettings, openMenu, renamingTitle],
  );
  const handleRenameKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter") {
        renameCommittedRef.current = true;
        commitRename(event.currentTarget.value);
      } else if (event.key === "Escape") {
        renameCommittedRef.current = true;
        setRenaming(null);
      }
    },
    [commitRename],
  );

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        // Clear of the fixed titlebar control cluster at the header's end.
        rightPanelOpen ? "pr-32" : "pr-24",
      )}
      onContextMenu={handleHeaderContextMenu}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3 md:overflow-visible">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        <DesktopSidebarReopenButton className="md:ml-0" />
        <nav aria-label="Thread breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* The project always leads the header: knowing which project a
              thread lives in is priority zero, and the thread title alone
              doesn't answer it. */}
          {activeProject ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Switch project"
                      aria-haspopup="dialog"
                      onClick={() => openCommandPalette({ open: "switch-project" })}
                      className={cn(HEADER_PILL_CLASS_NAME, "min-w-0 max-w-48 shrink-0")}
                    />
                  }
                >
                  <CubeIcon className="size-3.5 shrink-0 fill-current opacity-50" aria-hidden />
                  <span className="min-w-0 truncate">{activeProjectName}</span>
                </TooltipTrigger>
                <TooltipPopup side="bottom">Switch project · {activeProjectName}</TooltipPopup>
              </Tooltip>
              <ChevronRightIcon
                className={THREAD_BREADCRUMB_SEPARATOR_ICON_CLASS_NAME}
                aria-hidden
              />
            </>
          ) : null}
          {renamingTitle !== null ? (
            <input
              autoFocus
              aria-label="Thread title"
              className="h-6 min-w-0 flex-1 rounded-md bg-muted/40 px-2 text-xs font-medium text-foreground outline-none ring-1 ring-ring/50 focus:ring-ring [-webkit-app-region:no-drag]"
              defaultValue={renamingTitle}
              onBlur={(event) => {
                if (renameCommittedRef.current) return;
                // Focus landing on a navigation button means the rename was
                // abandoned — discard it rather than persisting a half-draft.
                if (
                  event.relatedTarget instanceof HTMLElement &&
                  event.relatedTarget.closest("button")
                ) {
                  setRenaming(null);
                  return;
                }
                commitRename(event.currentTarget.value);
              }}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={handleRenameKeyDown}
            />
          ) : activeProject ? (
            <ThreadTitleMenu
              activeThreadEnvironmentId={activeThreadEnvironmentId}
              activeThreadId={activeThreadId}
              activeThreadTitle={activeThreadTitle}
              activeProjectId={activeProject.id}
              onNewThreadInProject={onNewThreadInProject}
              onDoubleClick={handleTitleDoubleClick}
            />
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <h2
                    aria-label={activeThreadTitle}
                    className="min-w-0 flex-1 truncate px-2 py-0.5 text-sm font-medium text-foreground"
                    onDoubleClick={handleTitleDoubleClick}
                  />
                }
              >
                {activeThreadTitle}
              </TooltipTrigger>
              <TooltipPopup side="bottom">{activeThreadTitle}</TooltipPopup>
            </Tooltip>
          )}
        </nav>
        {activeProject && isGitRepo === false ? (
          <Badge variant="warning" className="shrink-0">
            No Git
          </Badge>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center justify-end gap-2 [-webkit-app-region:no-drag]">
          {actions}
        </div>
      ) : null}
    </div>
  );
});

function ThreadTitleMenu({
  activeThreadEnvironmentId,
  activeThreadId,
  activeThreadTitle,
  activeProjectId,
  onNewThreadInProject,
  onDoubleClick,
}: {
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  activeProjectId: ProjectId;
  onNewThreadInProject: () => void;
  onDoubleClick: (event: ReactMouseEvent) => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <button
                  type="button"
                  aria-label="Switch thread"
                  onDoubleClick={onDoubleClick}
                  className={cn(HEADER_PILL_CLASS_NAME, "group min-w-0 shrink text-left")}
                />
              }
            />
          }
        >
          <ThreadIcon className="size-3.5 shrink-0 fill-current opacity-50" aria-hidden />
          <h2 className="min-w-0 truncate">{activeThreadTitle}</h2>
          <ChevronDownIcon
            aria-hidden
            data-thread-title-chevron
            className="size-2.5 shrink-0 fill-muted-foreground/60 transition-colors group-hover:fill-foreground/70"
          />
        </TooltipTrigger>
        <TooltipPopup side="bottom">{activeThreadTitle}</TooltipPopup>
      </Tooltip>
      <MenuPopup align="start" className="w-80">
        {/* Mounted only while open, so the header does not re-render on every
            thread shell change in the environment. */}
        <ThreadSwitcherItems
          activeThreadEnvironmentId={activeThreadEnvironmentId}
          activeThreadId={activeThreadId}
          activeProjectId={activeProjectId}
        />
        <MenuSeparator />
        <MenuItem onClick={onNewThreadInProject}>
          <PlusIcon className="size-3.5" aria-hidden />
          New thread
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

function ThreadSwitcherItems({
  activeThreadEnvironmentId,
  activeThreadId,
  activeProjectId,
}: {
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  activeProjectId: ProjectId;
}) {
  const navigate = useNavigate();
  const threadShells = useThreadShells();
  const threadSortOrder = useClientSettings((settings) => settings.sidebarThreadSortOrder);
  const visibleThreads = useMemo(
    () =>
      selectHeaderThreads(
        threadShells,
        activeThreadEnvironmentId,
        activeProjectId,
        threadSortOrder,
      ),
    [activeProjectId, activeThreadEnvironmentId, threadShells, threadSortOrder],
  );

  if (visibleThreads.length === 0) {
    return <MenuItem disabled>No active threads</MenuItem>;
  }
  return visibleThreads.map((thread) => {
    const isActive = thread.id === activeThreadId;
    return (
      <MenuItem
        key={`${thread.environmentId}:${thread.id}`}
        className="grid grid-cols-[1rem_1fr]"
        onClick={() => {
          if (isActive) return;
          void navigate({
            to: "/$environmentId/$threadId",
            params: buildThreadRouteParams(scopeThreadRef(thread.environmentId, thread.id)),
          });
        }}
      >
        <span className="flex items-center justify-center">
          {isActive ? <CheckIcon className="size-3 fill-current" /> : null}
        </span>
        <span className="min-w-0 truncate">{thread.title}</span>
      </MenuItem>
    );
  });
}
