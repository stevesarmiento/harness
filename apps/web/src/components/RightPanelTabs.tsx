import type { ContextMenuItem, PreviewSessionSnapshot, PullRequestState } from "@t3tools/contracts";
import { getTerminalLabel } from "@t3tools/shared/terminalLabels";
import { GitPullRequest, Plus, X } from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { RightPanelSurface } from "~/rightPanelStore";
import { cn } from "~/lib/utils";
import { readLocalApi } from "~/localApi";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import { faviconUrlForOrigin } from "~/lib/favicon";
import { useTheme } from "~/hooks/useTheme";

import {
  PreviewPanelShell,
  type InlinePanelResizable,
  type PreviewPanelMode,
} from "./preview/PreviewPanelShell";
import { ActionCard } from "./ActionCard";
import { PierreEntryIcon } from "./chat/PierreEntryIcon";
import { LogomarkFormaAnimated } from "./LogomarkFormaAnimated";
import {
  BrowserSurfaceIcon,
  ComponentPreviewSurfaceIcon,
  DiffSurfaceIcon,
  FilesSurfaceIcon,
  TerminalSurfaceIcon,
  AgentsSurfaceIcon,
} from "./icons/custom";

export interface RightPanelTabStripProps {
  layoutControls?: ReactNode;
  surfaces: readonly RightPanelSurface[];
  activeSurfaceId: string | null;
  pendingSurfaceIds: ReadonlySet<string>;
  previewSessions: Readonly<Record<string, PreviewSessionSnapshot>>;
  terminalLabelsById: ReadonlyMap<string, string>;
  onActivate: (surface: RightPanelSurface) => void;
  onCloseSurface: (surface: RightPanelSurface) => void;
  onCloseOtherSurfaces: (surface: RightPanelSurface) => void;
  onCloseSurfacesToRight: (surface: RightPanelSurface) => void;
  onCloseAllSurfaces: () => void;
  onCopyFilePath: (relativePath: string) => void;
  onAddBrowser: () => void;
  onAddTerminal: () => void;
  onAddDiff: () => void;
  onAddFiles: () => void;
  onAddComponentPreview?: () => void;
  onAddPullRequest: () => void;
  onAddAgents: () => void;
  browserAvailable: boolean;
  terminalAvailable: boolean;
  diffAvailable: boolean;
  filesAvailable: boolean;
  componentPreviewAvailable?: boolean;
  pullRequestAvailable: boolean;
  agentsAvailable: boolean;
  pullRequestStatuses?: Readonly<Record<string, PullRequestTabStatus>>;
  /** Running + waiting subagents; badges the Agents card in the empty state. */
  liveAgentCount: number;
  className?: string;
}

interface RightPanelTabsProps extends Omit<RightPanelTabStripProps, "className"> {
  mode: PreviewPanelMode;
  maximized?: boolean;
  /** Forwarded to PreviewPanelShell so this surface persists its own width. */
  widthStorageKey?: string;
  /** Forwarded to PreviewPanelShell as the initial width before a user resize. */
  defaultWidth?: number;
  /** Hide the internal tab strip when the parent renders RightPanelTabStrip elsewhere (e.g. in the chrome header). */
  hideTabBar?: boolean;
  /** Parent-owned inline width state so external chrome can width-sync with the panel. */
  inlineResizable?: InlinePanelResizable;
  children: ReactNode;
}

export interface PullRequestTabStatus {
  projectId: string;
  repository: string;
  number: number;
  state: PullRequestState;
  isDraft: boolean;
}

const SURFACE_DISABLED_REASONS = {
  browser: "Browser previews are only available in the T3 Code desktop app.",
  terminal: "Terminal surfaces are only available from a project thread.",
  files: "Files are only available when a project is open.",
  diff: "Diff is only available for server threads in Git repositories.",
  componentPreview: "Component previews are only available for server threads.",
  pullRequest: "This thread's branch has no pull request yet.",
  agents: "Agents are only available from a thread.",
} as const;

type TabContextMenuAction = "copy-path" | "close" | "close-others" | "close-to-right" | "close-all";

function DisabledReasonTooltip(props: { reason: string; trigger: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={props.trigger} />
      <TooltipPopup side="top">{props.reason}</TooltipPopup>
    </Tooltip>
  );
}

function SurfaceMenuItem(props: {
  available: boolean;
  disabledReason?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const item = (
    <MenuItem
      className={!props.available ? "data-disabled:pointer-events-auto" : undefined}
      onClick={props.onClick}
      disabled={!props.available}
    >
      {props.children}
    </MenuItem>
  );
  if (props.available || !props.disabledReason) return item;
  return <DisabledReasonTooltip reason={props.disabledReason} trigger={item} />;
}

function RightPanelEmptyState(props: {
  onAddBrowser: () => void;
  onAddTerminal: () => void;
  onAddDiff: () => void;
  onAddFiles: () => void;
  onAddComponentPreview?: () => void;
  onAddPullRequest: () => void;
  onAddAgents: () => void;
  browserAvailable: boolean;
  terminalAvailable: boolean;
  diffAvailable: boolean;
  filesAvailable: boolean;
  componentPreviewAvailable?: boolean;
  pullRequestAvailable: boolean;
  agentsAvailable: boolean;
  liveAgentCount: number;
}) {
  const actions = [
    {
      label: "Browser",
      description: "Open a local app or URL.",
      icon: BrowserSurfaceIcon,
      available: props.browserAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.browser,
      onClick: props.onAddBrowser,
      badgeCount: 0,
    },
    {
      label: "Terminal",
      description: "Start a shell in this workspace.",
      icon: TerminalSurfaceIcon,
      available: props.terminalAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.terminal,
      onClick: props.onAddTerminal,
      badgeCount: 0,
    },
    {
      label: "Files",
      description: "Browse and read workspace files.",
      icon: FilesSurfaceIcon,
      available: props.filesAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.files,
      onClick: props.onAddFiles,
      badgeCount: 0,
    },
    {
      label: "Diff",
      description: "Review changes in this thread.",
      icon: DiffSurfaceIcon,
      available: props.diffAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.diff,
      onClick: props.onAddDiff,
      badgeCount: 0,
    },
    {
      label: "Pull request",
      description: "Open the pull request for this thread's branch.",
      icon: GitPullRequest,
      available: props.pullRequestAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.pullRequest,
      onClick: props.onAddPullRequest,
      badgeCount: 0,
    },
    {
      label: "Component preview",
      description: "Render project components live.",
      icon: ComponentPreviewSurfaceIcon,
      available: props.componentPreviewAvailable ?? false,
      disabledReason: SURFACE_DISABLED_REASONS.componentPreview,
      onClick: props.onAddComponentPreview ?? (() => {}),
      badgeCount: 0,
    },
    {
      id: "agents" as const,
      label: "Agents",
      description: "Watch subagents and workflows run.",
      icon: AgentsSurfaceIcon,
      available: props.agentsAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.agents,
      onClick: props.onAddAgents,
      badgeCount: props.liveAgentCount,
    },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-5 text-center">
          <LogomarkFormaAnimated
            aria-hidden
            className="pointer-events-none mx-auto h-40 w-auto text-foreground/5 [mask-image:linear-gradient(to_bottom,black_30%,transparent_80%)]"
          />
          <h3 className="text-base font-medium text-foreground">Open a surface</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose what to show in the right panel.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            const card = (
              <ActionCard
                title={action.label}
                description={action.description}
                icon={
                  <span className="relative inline-flex">
                    <Icon className="size-6" />
                    {action.badgeCount > 0 ? (
                      <span
                        aria-hidden
                        className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-info px-1 text-[9px] font-semibold tabular-nums text-white"
                      >
                        {action.badgeCount}
                      </span>
                    ) : null}
                  </span>
                }
                disabled={!action.available}
                className="min-h-40 px-4 py-4"
                onClick={action.onClick}
              />
            );
            if (action.available) {
              return <div key={action.label}>{card}</div>;
            }
            return (
              <DisabledReasonTooltip
                key={action.label}
                reason={action.disabledReason}
                trigger={card}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function surfaceTitle(
  surface: RightPanelSurface,
  sessions: Readonly<Record<string, PreviewSessionSnapshot>>,
  terminalLabelsById: ReadonlyMap<string, string>,
): string {
  switch (surface.kind) {
    case "diff":
      return "Diff";
    case "files":
      return "Files";
    case "file":
      return surface.relativePath.slice(surface.relativePath.lastIndexOf("/") + 1);
    case "terminal":
      return (
        terminalLabelsById.get(surface.activeTerminalId) ??
        getTerminalLabel(surface.activeTerminalId)
      );
    case "componentPreview":
      return "Component preview";
    case "pull-request":
      return `#${surface.number}`;
    case "agents":
      return "Agents";
    case "preview": {
      const snapshot = surface.resourceId ? sessions[surface.resourceId] : null;
      if (!snapshot || snapshot.navStatus._tag === "Idle") return "Browser";
      if (snapshot.navStatus.title.trim().length > 0) return snapshot.navStatus.title;
      try {
        return new URL(snapshot.navStatus.url).host || "Browser";
      } catch {
        return "Browser";
      }
    }
  }
}

function PreviewFavicon({ url }: { url: string | null }) {
  const faviconUrl = faviconUrlForOrigin(url, 32);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!faviconUrl || failedUrl === faviconUrl)
    return <BrowserSurfaceIcon className="size-3.5 shrink-0" />;
  return (
    <img
      src={faviconUrl}
      alt=""
      aria-hidden
      draggable={false}
      className="size-3 shrink-0 rounded-sm"
      onError={() => setFailedUrl(faviconUrl)}
    />
  );
}

function SurfaceIcon({
  surface,
  sessions,
  theme,
  pullRequestStatuses,
}: {
  surface: RightPanelSurface;
  sessions: Readonly<Record<string, PreviewSessionSnapshot>>;
  theme: "light" | "dark";
  pullRequestStatuses: Readonly<Record<string, PullRequestTabStatus>> | undefined;
}) {
  switch (surface.kind) {
    case "preview": {
      const snapshot = surface.resourceId ? sessions[surface.resourceId] : null;
      const url = !snapshot || snapshot.navStatus._tag === "Idle" ? null : snapshot.navStatus.url;
      return <PreviewFavicon url={url} />;
    }
    case "diff":
      return <DiffSurfaceIcon className="size-3.5 shrink-0" />;
    case "files":
      return <FilesSurfaceIcon className="size-3.5 shrink-0" />;
    case "file":
      return (
        <PierreEntryIcon
          pathValue={surface.relativePath}
          kind="file"
          theme={theme}
          className="size-3"
        />
      );
    case "terminal":
      return <TerminalSurfaceIcon className="size-3.5 shrink-0" />;
    case "componentPreview":
      return <ComponentPreviewSurfaceIcon className="size-3.5 shrink-0" />;
    case "pull-request": {
      const status = pullRequestStatuses?.[surface.id] ?? null;
      const toneClassName =
        status?.state === "merged"
          ? "text-violet-600 dark:text-violet-300/90"
          : status?.state === "closed"
            ? "text-red-600 dark:text-red-300/90"
            : status?.isDraft
              ? "text-zinc-500 dark:text-zinc-400/80"
              : status?.state === "open"
                ? "text-emerald-600 dark:text-emerald-300/90"
                : "text-muted-foreground";
      return <GitPullRequest className={cn("size-3.5 shrink-0", toneClassName)} />;
    }
    case "agents":
      return <AgentsSurfaceIcon className="size-3.5 shrink-0" />;
  }
}

export function RightPanelTabStrip(props: RightPanelTabStripProps) {
  const { resolvedTheme } = useTheme();
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleTabContextMenu = useCallback(
    async (event: ReactMouseEvent, surface: RightPanelSurface) => {
      event.preventDefault();
      event.stopPropagation();

      const api = readLocalApi();
      if (!api) return;

      const surfaceIndex = props.surfaces.findIndex((entry) => entry.id === surface.id);
      if (surfaceIndex < 0) return;

      const items: ContextMenuItem<TabContextMenuAction>[] = [];
      if (surface.kind === "file") {
        items.push({ id: "copy-path", label: "Copy path" });
      }
      items.push(
        { id: "close", label: "Close" },
        {
          id: "close-others",
          label: "Close others",
          disabled: props.surfaces.length <= 1,
        },
        {
          id: "close-to-right",
          label: "Close to the right",
          disabled: surfaceIndex >= props.surfaces.length - 1,
        },
        {
          id: "close-all",
          label: "Close all",
          disabled: props.surfaces.length === 0,
        },
      );

      const action = await api.contextMenu.show(items, { x: event.clientX, y: event.clientY });
      switch (action) {
        case "copy-path":
          if (surface.kind === "file") props.onCopyFilePath(surface.relativePath);
          break;
        case "close":
          props.onCloseSurface(surface);
          break;
        case "close-others":
          props.onCloseOtherSurfaces(surface);
          break;
        case "close-to-right":
          props.onCloseSurfacesToRight(surface);
          break;
        case "close-all":
          props.onCloseAllSurfaces();
          break;
        case null:
          break;
      }
    },
    [props],
  );
  const handleTabMouseDown = useCallback((event: ReactMouseEvent) => {
    if (event.button !== 1) return;
    event.preventDefault();
  }, []);
  const handleTabAuxClick = useCallback(
    (event: ReactMouseEvent, surface: RightPanelSurface) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      props.onCloseSurface(surface);
    },
    [props],
  );

  useEffect(() => {
    const activeTab = tabListRef.current?.querySelector<HTMLElement>("[data-active-tab='true']");
    activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [props.activeSurfaceId]);

  return (
    <div
      className={cn(
        // No height var here: the strip inherits --workspace-topbar-height
        // from its host (the internal usage pins 40px; the chrome header's
        // zone passes its own 39/40px through).
        "workspace-topbar gap-1 border-b border-border/70 bg-background pl-2 pr-3",
        props.className,
      )}
      data-right-panel-tabbar
    >
      <ScrollArea
        ref={tabListRef}
        hideScrollbars
        scrollFade
        className="min-w-0 flex-1 rounded-none"
        data-right-panel-tab-list
      >
        <div className="flex h-full w-max min-w-full items-center gap-1">
          {props.surfaces.map((surface) => {
            const active = surface.id === props.activeSurfaceId;
            const pending = props.pendingSurfaceIds.has(surface.id);
            const title = surfaceTitle(surface, props.previewSessions, props.terminalLabelsById);
            return (
              <div
                key={surface.id}
                data-active-tab={active}
                onMouseDown={handleTabMouseDown}
                onAuxClick={(event) => handleTabAuxClick(event, surface)}
                onContextMenu={(event) => void handleTabContextMenu(event, surface)}
                className={cn(
                  "group flex h-6 min-w-24 max-w-42 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs",
                  active
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1.5"
                        onClick={() => props.onActivate(surface)}
                      >
                        <span className="flex shrink-0 items-center opacity-50" aria-hidden>
                          <SurfaceIcon
                            surface={surface}
                            sessions={props.previewSessions}
                            theme={resolvedTheme}
                            pullRequestStatuses={props.pullRequestStatuses}
                          />
                        </span>
                        <span className="truncate">{title}</span>
                      </button>
                    }
                  />
                  <TooltipPopup>{title}</TooltipPopup>
                </Tooltip>
                <button
                  type="button"
                  className={cn(
                    "relative flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted focus:opacity-100",
                    pending ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label={`Close ${title}`}
                  onClick={() => props.onCloseSurface(surface)}
                >
                  {pending ? (
                    <>
                      <span
                        className="size-2 rounded-full bg-current group-hover:hidden"
                        aria-hidden
                      />
                      <X className="hidden size-3 group-hover:block" />
                    </>
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              </div>
            );
          })}
          {props.surfaces.length > 0 ? (
            <Menu>
              <MenuTrigger
                className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Add panel surface"
              >
                <Plus className="size-4" />
              </MenuTrigger>
              <MenuPopup align="start" side="bottom" sideOffset={6} className="min-w-44">
                <SurfaceMenuItem
                  available={props.browserAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.browser}
                  onClick={props.onAddBrowser}
                >
                  <BrowserSurfaceIcon />
                  Browser
                </SurfaceMenuItem>
                <SurfaceMenuItem
                  available={props.terminalAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.terminal}
                  onClick={props.onAddTerminal}
                >
                  <TerminalSurfaceIcon />
                  Terminal
                </SurfaceMenuItem>
                <SurfaceMenuItem
                  available={props.filesAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.files}
                  onClick={props.onAddFiles}
                >
                  <FilesSurfaceIcon />
                  Files
                </SurfaceMenuItem>
                <SurfaceMenuItem
                  available={props.diffAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.diff}
                  onClick={props.onAddDiff}
                >
                  <DiffSurfaceIcon />
                  Diff
                </SurfaceMenuItem>
                <SurfaceMenuItem
                  available={props.pullRequestAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.pullRequest}
                  onClick={props.onAddPullRequest}
                >
                  <GitPullRequest />
                  Pull request
                </SurfaceMenuItem>
                {props.onAddComponentPreview ? (
                  <SurfaceMenuItem
                    available={props.componentPreviewAvailable ?? false}
                    disabledReason={SURFACE_DISABLED_REASONS.componentPreview}
                    onClick={props.onAddComponentPreview}
                  >
                    <ComponentPreviewSurfaceIcon />
                    Component preview
                  </SurfaceMenuItem>
                ) : null}
                <SurfaceMenuItem
                  available={props.agentsAvailable}
                  disabledReason={SURFACE_DISABLED_REASONS.agents}
                  onClick={props.onAddAgents}
                >
                  <AgentsSurfaceIcon />
                  Agents
                </SurfaceMenuItem>
              </MenuPopup>
            </Menu>
          ) : null}
        </div>
      </ScrollArea>
      {props.layoutControls}
    </div>
  );
}

export function RightPanelTabs(props: RightPanelTabsProps) {
  const {
    mode,
    maximized,
    widthStorageKey,
    defaultWidth,
    hideTabBar,
    inlineResizable,
    children,
    ...stripProps
  } = props;
  return (
    <PreviewPanelShell
      mode={mode}
      {...(maximized !== undefined ? { maximized } : {})}
      {...(widthStorageKey !== undefined ? { widthStorageKey } : {})}
      {...(defaultWidth !== undefined ? { defaultWidth } : {})}
      {...(inlineResizable ? { inlineResizable } : {})}
    >
      {hideTabBar ? null : (
        <RightPanelTabStrip
          {...stripProps}
          className={cn("[--workspace-topbar-height:40px]", mode === "inline" ? "pr-2" : "pr-3")}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {props.activeSurfaceId === null ? (
          <RightPanelEmptyState
            onAddBrowser={props.onAddBrowser}
            onAddTerminal={props.onAddTerminal}
            onAddDiff={props.onAddDiff}
            onAddFiles={props.onAddFiles}
            {...(props.onAddComponentPreview
              ? { onAddComponentPreview: props.onAddComponentPreview }
              : {})}
            onAddPullRequest={props.onAddPullRequest}
            onAddAgents={props.onAddAgents}
            browserAvailable={props.browserAvailable}
            terminalAvailable={props.terminalAvailable}
            diffAvailable={props.diffAvailable}
            filesAvailable={props.filesAvailable}
            {...(props.componentPreviewAvailable !== undefined
              ? { componentPreviewAvailable: props.componentPreviewAvailable }
              : {})}
            pullRequestAvailable={props.pullRequestAvailable}
            agentsAvailable={props.agentsAvailable}
            liveAgentCount={props.liveAgentCount}
          />
        ) : (
          children
        )}
      </div>
    </PreviewPanelShell>
  );
}
