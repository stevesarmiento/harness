import type {
  ContextMenuItem,
  EnvironmentId,
  PreviewSessionSnapshot,
  ProjectId,
  PullRequestState,
} from "@t3tools/contracts";
import { getTerminalLabel } from "@t3tools/shared/terminalLabels";
// Fork: surface icons come from ./icons/custom; lucide is only used where no Forma glyph exists.
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  Plus,
  Volume2,
  VolumeOff,
  X,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { DesktopPreviewOverlay } from "~/previewStateStore";
import type { RightPanelSurface } from "~/rightPanelStore";
import { cn } from "~/lib/utils";
import { readLocalApi } from "~/localApi";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { Kbd } from "~/components/ui/kbd";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "~/components/ui/menu";
import { useBrowserDefaults } from "~/browser/browserDefaults";
import { ScrollArea } from "~/components/ui/scroll-area";
import { faviconUrlForOrigin } from "~/lib/favicon";
import { useTheme } from "~/hooks/useTheme";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useEnvironmentQuery } from "~/state/query";

import {
  PreviewPanelShell,
  type InlinePanelResizable,
  type PreviewPanelMode,
} from "./preview/PreviewPanelShell";
import { FaviconImage } from "./preview/PreviewFaviconIcon";
import { previewBridge } from "./preview/previewBridge";
import { ActionCard } from "./ActionCard";
import { PierreEntryIcon } from "./chat/PierreEntryIcon";
import { LogomarkFormaAnimated } from "./LogomarkFormaAnimated";
import { resolvePullRequestState } from "./pullRequest/pullRequestPresentation";
import {
  BrowserSurfaceIcon,
  ComponentPreviewSurfaceIcon,
  DiffSurfaceIcon,
  FilesSurfaceIcon,
  TerminalSurfaceIcon,
  AgentsSurfaceIcon,
} from "./icons/custom";

// Fork: the tab strip is a standalone export so ChatView can host it in the
// workspace chrome header; RightPanelTabs wraps it with PreviewPanelShell.
export interface RightPanelTabStripProps {
  layoutControls?: ReactNode;
  surfaces: readonly RightPanelSurface[];
  /** Fallback environment for surfaces that do not carry their own. */
  environmentId: EnvironmentId | null;
  activeSurfaceId: string | null;
  pendingSurfaceIds: ReadonlySet<string>;
  previewSessions: Readonly<Record<string, PreviewSessionSnapshot>>;
  desktopByTabId: Readonly<Record<string, DesktopPreviewOverlay>>;
  /**
   * Maps a server session tab id to the desktop runtime tab id the Electron
   * preview manager is keyed by. Session ids are only unique within one server
   * process, so desktop operations must not be addressed with them.
   */
  previewRuntimeTabId?: ((tabId: string) => string) | undefined;
  terminalLabelsById: ReadonlyMap<string, string>;
  onActivate: (surface: RightPanelSurface) => void;
  onCloseSurface: (surface: RightPanelSurface) => void;
  onCloseOtherSurfaces: (surface: RightPanelSurface) => void;
  onCloseSurfacesToRight: (surface: RightPanelSurface) => void;
  onCloseAllSurfaces: () => void;
  onCopyFilePath: (relativePath: string) => void;
  onAddBrowser: () => void;
  /**
   * Separate from `onAddBrowser` on purpose: that one is passed directly as a
   * DOM click handler, and a `(profileId?: string)` signature would silently
   * accept the MouseEvent as a profile id.
   */
  onAddBrowserInProfile: (profileId: string) => void;
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
  pullRequestStatusSeeds?: Readonly<Record<string, PullRequestTabStatusSeed>>;
  /** Running + waiting subagents; badges the Agents card in the empty state. */
  liveAgentCount: number;
  className?: string;
}

interface RightPanelTabsProps extends Omit<RightPanelTabStripProps, "className"> {
  mode: PreviewPanelMode;
  maximized?: boolean;
  /** Forwarded to PreviewPanelShell so the inline panel can animate open/closed. */
  open?: boolean;
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

export type PullRequestTabStatusSeed = Pick<PullRequestTabStatus, "state" | "isDraft">;

export function shouldOpenDefaultBrowserProfileFromMenuClick(
  pointerType: string | undefined,
): boolean {
  return pointerType !== "touch";
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

/** Overlays that must win over the launcher's letter shortcuts. */
const LAUNCHER_SHORTCUT_BLOCKING_LAYERS = [
  '[data-slot="dialog-popup"]',
  '[data-slot="alert-dialog-popup"]',
  '[data-slot="command-dialog-popup"]',
  '[data-slot="menu-popup"]',
  '[data-slot="select-popup"]',
  '[data-slot="popover-popup"]',
  '[data-slot="combobox-popup"]',
  '[data-slot="autocomplete-popup"]',
].join(",");

/** One-line unavailability hints for the empty-state cards. */
const SURFACE_UNAVAILABLE_HINTS = {
  browser: "Only available in the desktop app.",
  terminal: "Available when a project is open.",
  files: "Available when a project is open.",
  diff: "Available for Git repositories.",
  pullRequest: "No pull request on this branch yet.",
  agents: "Available from a thread.",
} as const;

type TabContextMenuAction =
  | "copy-path"
  | "toggle-mute"
  | "close"
  | "close-others"
  | "close-to-right"
  | "close-all";

const TAB_SCROLL_EDGE_TOLERANCE = 1;

function tabScrollViewport(root: HTMLDivElement | null): HTMLDivElement | null {
  return root?.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? null;
}

/**
 * Desktop preview tab backing a surface, or null for non-preview surfaces, the
 * "new browser tab" placeholder, and the web build where no desktop tab exists.
 */
function previewTabIdOf(
  surface: RightPanelSurface,
  sessions: Readonly<Record<string, PreviewSessionSnapshot>>,
): string | null {
  if (surface.kind !== "preview" || !surface.resourceId) return null;
  return sessions[surface.resourceId]?.tabId ?? null;
}

/**
 * Label and enabled state for a preview tab's mute menu entry.
 * Stays disabled until desktop overlay state arrives: a server session id can
 * resolve while the preview manager's createTab is still in flight, and muting
 * then fails with a PreviewTabNotFoundError nothing surfaces to the user.
 */
export function tabMuteMenuItem(input: {
  overlay: DesktopPreviewOverlay | null;
  canResolveRuntimeTabId: boolean;
}): { label: string; disabled: boolean } {
  const muted = input.overlay?.audioMuted ?? false;
  return {
    label: muted ? "Unmute tab" : "Mute tab",
    disabled: input.overlay === null || !input.canResolveRuntimeTabId,
  };
}

type TabAudioState = "none" | "audible" | "muted";

/**
 * A muted tab that is not making sound shows nothing: mute is armed silently,
 * and the indicator only appears once there is audio to speak of.
 */
function tabAudioState(overlay: DesktopPreviewOverlay | null): TabAudioState {
  if (!overlay?.audible) return "none";
  return overlay.audioMuted ? "muted" : "audible";
}

type SurfaceShortcutEvent = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "defaultPrevented" | "isComposing" | "key" | "metaKey"
>;

export function surfaceShortcutActionForKey<
  const Action extends { available: boolean; shortcut: string },
>(actions: readonly Action[], event: SurfaceShortcutEvent): Action | null {
  if (event.defaultPrevented || event.isComposing) return null;
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  return (
    actions.find(
      (action) => action.available && action.shortcut.toLowerCase() === event.key.toLowerCase(),
    ) ?? null
  );
}

/**
 * A focused editable is a typing context whether or not it has text yet: an
 * empty chat composer at rest is still where the user's next keystrokes are
 * meant to land, and claiming launcher letters from it would redirect prompts
 * into whatever surface opens. The `:not` clause lets `closest` see past
 * non-editable islands (`contenteditable="false"`) to an editable host around
 * them, matching ComposerPendingUserInputPanel's typing guard.
 */
export function surfaceShortcutTargetsTypingContext(
  target: { closest(selectors: string): unknown } | null,
): boolean {
  return (
    target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !=
    null
  );
}

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
  shortcut: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const item = (
    <MenuItem
      className={!props.available ? "data-disabled:pointer-events-auto" : undefined}
      onClick={props.onClick}
      disabled={!props.available}
      aria-keyshortcuts={props.shortcut}
    >
      {props.children}
      <MenuShortcut>{props.shortcut}</MenuShortcut>
    </MenuItem>
  );
  if (props.available || !props.disabledReason) return item;
  return <DisabledReasonTooltip reason={props.disabledReason} trigger={item} />;
}

/**
 * Card launcher shown when the right panel has no surfaces. Keyboard-first
 * without palette chrome: a surface's letter opens it directly from anywhere
 * outside a typing context, and arrows plus Enter work while the launcher is
 * focused. The highlight only appears on hover or arrow use. Unavailable
 * surfaces stay visible with a one-line reason.
 */
function RightPanelEmptyState(props: {
  onAddBrowser: () => void;
  onAddBrowserInProfile: (profileId: string) => void;
  browserProfiles: ReadonlyArray<{ readonly id: string; readonly name: string }>;
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
  // -1 means no highlight: it only appears on hover or arrow use.
  const [highlight, setHighlight] = useState(-1);

  const actions = [
    {
      label: "Browser",
      description: "Open a local app or URL.",
      icon: BrowserSurfaceIcon,
      shortcut: "B",
      available: props.browserAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.browser,
      onClick: props.onAddBrowser,
      badgeCount: 0,
    },
    {
      label: "Terminal",
      description: "Start a shell in this workspace.",
      icon: TerminalSurfaceIcon,
      shortcut: "T",
      available: props.terminalAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.terminal,
      onClick: props.onAddTerminal,
      badgeCount: 0,
    },
    {
      label: "Files",
      description: "Browse and read workspace files.",
      icon: FilesSurfaceIcon,
      shortcut: "F",
      available: props.filesAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.files,
      onClick: props.onAddFiles,
      badgeCount: 0,
    },
    {
      label: "Diff",
      description: "Review changes in this thread.",
      icon: DiffSurfaceIcon,
      shortcut: "D",
      available: props.diffAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.diff,
      onClick: props.onAddDiff,
      badgeCount: 0,
    },
    {
      label: "Pull request",
      description: "Open this branch's pull request.",
      icon: GitPullRequest,
      shortcut: "P",
      available: props.pullRequestAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.pullRequest,
      onClick: props.onAddPullRequest,
      badgeCount: 0,
    },
    {
      label: "Component preview",
      description: "Render project components live.",
      icon: ComponentPreviewSurfaceIcon,
      // Fork: component preview is a Forma-only surface; C is its launcher key.
      shortcut: "C",
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
      shortcut: "A",
      available: props.agentsAvailable,
      disabledReason: SURFACE_UNAVAILABLE_HINTS.agents,
      onClick: props.onAddAgents,
      badgeCount: props.liveAgentCount,
    },
  ] as const;

  type SurfaceAction = (typeof actions)[number];

  const availableActions = actions.filter((action) => action.available);
  const highlightIndex =
    availableActions.length === 0 ? -1 : Math.min(highlight, availableActions.length - 1);

  // Letter shortcuts work while the launcher is visible, not only while it
  // is focused; focus moves around too easily (stray clicks) to carry them.
  // Capture phase so app-level key handlers cannot swallow the event first;
  // typing contexts and already-handled events are left alone.
  const shortcutActionsRef = useRef(availableActions);
  useEffect(() => {
    shortcutActionsRef.current = availableActions;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const action = surfaceShortcutActionForKey(shortcutActionsRef.current, event);
      if (!action) return;
      if (document.querySelector(LAUNCHER_SHORTCUT_BLOCKING_LAYERS)) return;
      const target = event.target;
      if (target instanceof Element && surfaceShortcutTargetsTypingContext(target)) return;
      event.preventDefault();
      event.stopPropagation();
      action.onClick();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (availableActions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      setHighlight((highlightIndex + 1) % availableActions.length);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      setHighlight(
        highlightIndex === -1
          ? availableActions.length - 1
          : (highlightIndex - 1 + availableActions.length) % availableActions.length,
      );
      return;
    }
    if (event.key === "Enter") {
      // A focused card button owns its own activation; only open from the
      // highlight when the container itself has focus.
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      const action = availableActions[highlightIndex];
      if (!action) return;
      event.preventDefault();
      action.onClick();
    }
  };

  // Stable identity so React only runs this callback ref on mount/unmount;
  // an inline arrow would re-attach and re-focus on every render.
  const focusOnMount = useCallback((node: HTMLDivElement | null) => {
    node?.focus();
  }, []);

  const isHighlighted = (action: SurfaceAction) =>
    highlightIndex !== -1 && availableActions[highlightIndex] === action;

  const actionIcon = (action: SurfaceAction, iconClassName = "size-4") => {
    const Icon = action.icon;
    return (
      <span className="relative inline-flex shrink-0">
        <Icon className={iconClassName} />
        {action.badgeCount > 0 ? (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-info px-1 text-[9px] font-semibold tabular-nums text-white"
          >
            {action.badgeCount}
          </span>
        ) : null}
      </span>
    );
  };

  // Fork: upstream's launcher keyboard behavior applied to Forma's ActionCard
  // grid and logomark header.
  const highlightedCardClass =
    "border-border/85 bg-accent/16 shadow-md ring-4 ring-foreground/5 ring-offset-4 ring-offset-background";

  return (
    <div
      ref={focusOnMount}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Open a surface"
      data-surface-launcher-keys={availableActions.map((action) => action.shortcut).join("")}
      className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6 outline-none"
    >
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
            const card = (
              <ActionCard
                title={action.label}
                description={action.description}
                icon={actionIcon(action, "size-6")}
                disabled={!action.available}
                className={cn("min-h-40 px-4 py-4", isHighlighted(action) && highlightedCardClass)}
                onClick={action.onClick}
              />
            );
            if (!action.available) {
              return (
                <DisabledReasonTooltip
                  key={action.label}
                  reason={action.disabledReason}
                  trigger={card}
                />
              );
            }
            return (
              // The card is itself a button, so the shortcut hint and profile
              // chooser sit beside it in a wrapper rather than inside it.
              // Hover lives on the wrapper: the chooser overlays the card, and
              // a pointer moving onto it must not read as leaving the card.
              <div
                key={action.label}
                className="group relative"
                onMouseEnter={() => setHighlight(availableActions.indexOf(action))}
                onMouseLeave={() =>
                  setHighlight((current) =>
                    current === availableActions.indexOf(action) ? -1 : current,
                  )
                }
              >
                {card}
                <Kbd className="pointer-events-none absolute top-4 right-4">{action.shortcut}</Kbd>
                {/*
                  Same choice the tab bar's "+" menu offers: the card opens the
                  default profile, the chevron picks another. Only worth showing
                  once there is something to choose between.
                */}
                {action.label === "Browser" && props.browserProfiles.length > 1 ? (
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          aria-label="Open browser in a profile"
                          className="absolute right-4 bottom-4 [--control-icon-color:currentColor]"
                          size="icon-xs"
                          variant="ghost-muted"
                        />
                      }
                    >
                      <ChevronDown className="size-3.5" />
                    </MenuTrigger>
                    <MenuPopup
                      align="end"
                      side="bottom"
                      sideOffset={6}
                      className="min-w-40 max-w-56"
                    >
                      {props.browserProfiles.map((profile) => (
                        <MenuItem
                          key={profile.id}
                          onClick={() => props.onAddBrowserInProfile(profile.id)}
                        >
                          <span className="min-w-0 truncate">{profile.name}</span>
                        </MenuItem>
                      ))}
                    </MenuPopup>
                  </Menu>
                ) : null}
              </div>
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
      return surface.relativePath.slice(
        Math.max(surface.relativePath.lastIndexOf("/"), surface.relativePath.lastIndexOf("\\")) + 1,
      );
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

function PreviewFavicon({ capturedUrl, url }: { capturedUrl: string | null; url: string | null }) {
  const publicProviderUrl = faviconUrlForOrigin(url, 32);
  return (
    <FaviconImage
      sources={[capturedUrl, publicProviderUrl]}
      // Fork: Forma browser glyph as the no-favicon fallback.
      fallback={<BrowserSurfaceIcon className="size-3.5 shrink-0" />}
      className="size-3 shrink-0 rounded-sm object-contain"
    />
  );
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function SurfaceIcon({
  surface,
  sessions,
  desktopByTabId,
  theme,
  environmentId,
  pullRequestStatusSeeds,
}: {
  surface: RightPanelSurface;
  sessions: Readonly<Record<string, PreviewSessionSnapshot>>;
  desktopByTabId: Readonly<Record<string, DesktopPreviewOverlay>>;
  theme: "light" | "dark";
  environmentId: EnvironmentId | null;
  pullRequestStatusSeeds: Readonly<Record<string, PullRequestTabStatusSeed>> | undefined;
}) {
  switch (surface.kind) {
    case "preview": {
      const snapshot = surface.resourceId ? sessions[surface.resourceId] : null;
      const url = !snapshot || snapshot.navStatus._tag === "Idle" ? null : snapshot.navStatus.url;
      const favicon = snapshot ? (desktopByTabId[snapshot.tabId]?.favicon ?? null) : null;
      const capturedUrl =
        favicon && url && sameOrigin(favicon.pageUrl, url) ? favicon.dataUrl : null;
      return <PreviewFavicon capturedUrl={capturedUrl} url={url} />;
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
    case "pull-request":
      return (
        <PullRequestSurfaceIcon
          surface={surface}
          environmentId={environmentId}
          seed={pullRequestStatusSeeds?.[surface.id]}
        />
      );
    case "agents":
      return <AgentsSurfaceIcon className="size-3.5 shrink-0" />;
  }
}

function PullRequestSurfaceIcon({
  surface,
  environmentId,
  seed,
}: {
  surface: Extract<RightPanelSurface, { kind: "pull-request" }>;
  environmentId: EnvironmentId | null;
  seed: PullRequestTabStatusSeed | undefined;
}) {
  const resolvedEnvironmentId =
    (surface.environmentId as EnvironmentId | undefined) ?? environmentId;
  const detail = useEnvironmentQuery(
    resolvedEnvironmentId === null
      ? null
      : pullRequestEnvironment.detail({
          environmentId: resolvedEnvironmentId,
          input: {
            projectId: surface.projectId as ProjectId,
            repository: surface.repository,
            number: surface.number,
          },
        }),
  ).data;
  // Only state and draft reach the tab. A list seed cannot know mergeability, so feeding the
  // full detail would flip an open tab to the conflict glyph the moment its read lands.
  const status =
    detail === null ? (seed ?? null) : { state: detail.state, isDraft: detail.isDraft };
  if (status === null) {
    // Fork: size-3.5 matches the other tab glyphs in the breadcrumb strip.
    return <GitPullRequest className="size-3.5 shrink-0 text-muted-foreground" />;
  }
  const presentation = resolvePullRequestState(status);
  return <presentation.Icon className={cn("size-3.5 shrink-0", presentation.toneClassName)} />;
}

export function RightPanelTabStrip(props: RightPanelTabStripProps) {
  const browserProfiles = useBrowserDefaults().profiles;
  const { resolvedTheme } = useTheme();
  const tabListRef = useRef<HTMLDivElement>(null);
  const [addSurfaceMenuOpen, setAddSurfaceMenuOpen] = useState(false);
  const [tabScrollState, setTabScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  const updateTabScrollState = useCallback(() => {
    const viewport = tabScrollViewport(tabListRef.current);
    if (!viewport) return;

    const hasOverflow = viewport.scrollWidth - viewport.clientWidth > TAB_SCROLL_EDGE_TOLERANCE;
    const canScrollLeft = hasOverflow && viewport.scrollLeft > TAB_SCROLL_EDGE_TOLERANCE;
    const canScrollRight =
      hasOverflow &&
      viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - TAB_SCROLL_EDGE_TOLERANCE;
    setTabScrollState((current) => {
      if (
        current.hasOverflow === hasOverflow &&
        current.canScrollLeft === canScrollLeft &&
        current.canScrollRight === canScrollRight
      ) {
        return current;
      }
      return { hasOverflow, canScrollLeft, canScrollRight };
    });
  }, []);

  const scrollTabs = useCallback((direction: -1 | 1) => {
    const viewport = tabScrollViewport(tabListRef.current);
    if (!viewport) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({
      left: direction * Math.max(120, viewport.clientWidth * 0.75),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  // Fork: same actions as upstream's "+" menu, drawn with Forma surface icons,
  // plus the Forma-only component preview surface (hidden without a handler).
  const addSurfaceActions = [
    {
      label: "Browser",
      icon: BrowserSurfaceIcon,
      shortcut: "B",
      available: props.browserAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.browser,
      onClick: props.onAddBrowser,
      hidden: false,
    },
    {
      label: "Terminal",
      icon: TerminalSurfaceIcon,
      shortcut: "T",
      available: props.terminalAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.terminal,
      onClick: props.onAddTerminal,
      hidden: false,
    },
    {
      label: "Files",
      icon: FilesSurfaceIcon,
      shortcut: "F",
      available: props.filesAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.files,
      onClick: props.onAddFiles,
      hidden: false,
    },
    {
      label: "Diff",
      icon: DiffSurfaceIcon,
      shortcut: "D",
      available: props.diffAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.diff,
      onClick: props.onAddDiff,
      hidden: false,
    },
    {
      label: "Pull request",
      icon: GitPullRequest,
      shortcut: "P",
      available: props.pullRequestAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.pullRequest,
      onClick: props.onAddPullRequest,
      hidden: false,
    },
    {
      label: "Component preview",
      icon: ComponentPreviewSurfaceIcon,
      shortcut: "C",
      available: props.onAddComponentPreview ? (props.componentPreviewAvailable ?? false) : false,
      disabledReason: SURFACE_DISABLED_REASONS.componentPreview,
      onClick: props.onAddComponentPreview ?? (() => {}),
      hidden: props.onAddComponentPreview === undefined,
    },
    {
      label: "Agents",
      icon: AgentsSurfaceIcon,
      shortcut: "A",
      available: props.agentsAvailable,
      disabledReason: SURFACE_DISABLED_REASONS.agents,
      onClick: props.onAddAgents,
      hidden: false,
    },
  ] as const;

  const handleAddSurfaceMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const action = surfaceShortcutActionForKey(addSurfaceActions, event.nativeEvent);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    setAddSurfaceMenuOpen(false);
    action.onClick();
  };

  const handleTabContextMenu = useCallback(
    async (event: ReactMouseEvent, surface: RightPanelSurface) => {
      event.preventDefault();
      event.stopPropagation();

      const api = readLocalApi();
      if (!api) return;

      const surfaceIndex = props.surfaces.findIndex((entry) => entry.id === surface.id);
      if (surfaceIndex < 0) return;

      const items: ContextMenuItem<TabContextMenuAction>[] = [];
      if (surface.kind === "file" && surface.attachment === undefined) {
        items.push({ id: "copy-path", label: "Copy path" });
      }
      const menuPreviewTabId = previewTabIdOf(surface, props.previewSessions);
      // Desktop overlay state only arrives once the preview manager has created
      // the tab. A server session id alone can still be ahead of that, and
      // muting then fails with PreviewTabNotFoundError that nobody surfaces.
      const menuOverlay = menuPreviewTabId
        ? (props.desktopByTabId[menuPreviewTabId] ?? null)
        : null;
      const menuMuted = menuOverlay?.audioMuted ?? false;
      if (surface.kind === "preview") {
        // Not gated on audibility: silencing a quiet tab ahead of time is the
        // point, so the item is offered whenever the tab is mutable at all.
        items.push({
          id: "toggle-mute",
          ...tabMuteMenuItem({
            overlay: menuOverlay,
            canResolveRuntimeTabId: props.previewRuntimeTabId !== undefined,
          }),
        });
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
          if (surface.kind === "file" && surface.attachment === undefined) {
            props.onCopyFilePath(surface.relativePath);
          }
          break;
        case "toggle-mute": {
          // menuOverlay repeats the disabled gate above: the desktop tab must
          // exist before it can be addressed, however the menu was dismissed.
          const runtimeTabId =
            menuPreviewTabId && menuOverlay
              ? (props.previewRuntimeTabId?.(menuPreviewTabId) ?? null)
              : null;
          if (runtimeTabId) {
            void previewBridge?.setAudioMuted(runtimeTabId, !menuMuted).catch(() => undefined);
          }
          break;
        }
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
    if (!props.activeSurfaceId || !tabScrollState.hasOverflow) return;
    const activeTab = tabListRef.current?.querySelector<HTMLElement>("[data-active-tab='true']");
    activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [props.activeSurfaceId, tabScrollState.hasOverflow]);

  useEffect(() => {
    const viewport = tabScrollViewport(tabListRef.current);
    if (!viewport) return;

    const content = viewport.firstElementChild;
    const resizeObserver = new ResizeObserver(updateTabScrollState);
    resizeObserver.observe(viewport);
    if (content) resizeObserver.observe(content);
    viewport.addEventListener("scroll", updateTabScrollState, { passive: true });
    updateTabScrollState();

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateTabScrollState);
    };
  }, [updateTabScrollState]);

  useEffect(() => {
    const viewport = tabScrollViewport(tabListRef.current);
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= viewport.clientWidth;
      if (delta === 0) return;

      const previousScrollLeft = viewport.scrollLeft;
      viewport.scrollLeft += delta;
      if (viewport.scrollLeft === previousScrollLeft) return;
      event.preventDefault();
      updateTabScrollState();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [updateTabScrollState]);

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
            const previewTabId = previewTabIdOf(surface, props.previewSessions);
            // Desktop state is keyed by the session id, but desktop actions
            // must be addressed with the runtime id.
            const audio = tabAudioState(
              previewTabId ? (props.desktopByTabId[previewTabId] ?? null) : null,
            );
            const audioRuntimeTabId = previewTabId
              ? (props.previewRuntimeTabId?.(previewTabId) ?? null)
              : null;
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
                            desktopByTabId={props.desktopByTabId}
                            theme={resolvedTheme}
                            environmentId={props.environmentId}
                            pullRequestStatusSeeds={props.pullRequestStatusSeeds}
                          />
                        </span>
                        <span className="truncate">{title}</span>
                      </button>
                    }
                  />
                  <TooltipPopup>{title}</TooltipPopup>
                </Tooltip>
                {audio === "none" || !audioRuntimeTabId ? null : (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm hover:bg-muted"
                          aria-label={audio === "muted" ? `Unmute ${title}` : `Mute ${title}`}
                          onClick={(event) => {
                            // Sibling of the close button, inside a tab that
                            // activates on click: keep this to the toggle.
                            event.stopPropagation();
                            void previewBridge
                              ?.setAudioMuted(audioRuntimeTabId, audio !== "muted")
                              .catch(() => undefined);
                          }}
                        >
                          {audio === "muted" ? (
                            <VolumeOff className="size-3" />
                          ) : (
                            <Volume2 className="size-3" />
                          )}
                        </button>
                      }
                    />
                    <TooltipPopup>{audio === "muted" ? "Unmute tab" : "Mute tab"}</TooltipPopup>
                  </Tooltip>
                )}
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
            <Menu open={addSurfaceMenuOpen} onOpenChange={setAddSurfaceMenuOpen}>
              <MenuTrigger
                className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Add panel surface"
              >
                <Plus className="size-4" />
              </MenuTrigger>
              <MenuPopup
                align="start"
                side="bottom"
                sideOffset={6}
                className="min-w-44"
                onKeyDownCapture={handleAddSurfaceMenuKeyDown}
              >
                {addSurfaceActions
                  .filter((action) => !action.hidden)
                  .map((action) => {
                    const Icon = action.icon;
                    // Browser collapses into one row: clicking the trigger opens
                    // the default profile (the common case stays one click),
                    // while hover or arrow reveals the profiles. The choice
                    // lives at open time because a tab's profile is fixed then —
                    // Electron only honours a partition before attach.
                    if (action.label === "Browser" && action.available) {
                      return (
                        <MenuSub key={action.label}>
                          <MenuSubTrigger
                            className="[&>svg:last-child]:ms-0"
                            aria-keyshortcuts={action.shortcut}
                            onClick={(event) => {
                              const pointerType =
                                "pointerType" in event.nativeEvent &&
                                typeof event.nativeEvent.pointerType === "string"
                                  ? event.nativeEvent.pointerType
                                  : undefined;
                              // Touch has no hover path to the profile choices:
                              // its first tap opens the submenu, then a profile
                              // is selected there. Mouse click keeps the common
                              // default-profile action at one click.
                              if (!shouldOpenDefaultBrowserProfileFromMenuClick(pointerType))
                                return;
                              setAddSurfaceMenuOpen(false);
                              action.onClick();
                            }}
                          >
                            <Icon />
                            {action.label}
                            <MenuShortcut>{action.shortcut}</MenuShortcut>
                          </MenuSubTrigger>
                          {/*
                            Capped and truncated: profile names are user-supplied
                            and run to 48 characters, which would otherwise widen
                            the popup to fit-content and wrap.
                          */}
                          <MenuSubPopup className="min-w-40 max-w-56">
                            {browserProfiles.map((profile) => (
                              <MenuItem
                                key={profile.id}
                                onClick={() => props.onAddBrowserInProfile(profile.id)}
                              >
                                <span className="min-w-0 truncate">{profile.name}</span>
                              </MenuItem>
                            ))}
                          </MenuSubPopup>
                        </MenuSub>
                      );
                    }
                    return (
                      <SurfaceMenuItem
                        key={action.label}
                        available={action.available}
                        disabledReason={action.disabledReason}
                        shortcut={action.shortcut}
                        onClick={action.onClick}
                      >
                        <Icon />
                        {action.label}
                      </SurfaceMenuItem>
                    );
                  })}
              </MenuPopup>
            </Menu>
          ) : null}
        </div>
      </ScrollArea>
      {tabScrollState.hasOverflow ? (
        <div
          className="flex shrink-0 items-center gap-0.5 [-webkit-app-region:no-drag]"
          role="group"
          aria-label="Scroll panel tabs"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    aria-label="Scroll tabs left"
                    disabled={!tabScrollState.canScrollLeft}
                    onClick={() => scrollTabs(-1)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <ChevronLeft />
                  </Button>
                </span>
              }
            />
            <TooltipPopup>Scroll tabs left</TooltipPopup>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <Button
                    aria-label="Scroll tabs right"
                    disabled={!tabScrollState.canScrollRight}
                    onClick={() => scrollTabs(1)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <ChevronRight />
                  </Button>
                </span>
              }
            />
            <TooltipPopup>Scroll tabs right</TooltipPopup>
          </Tooltip>
        </div>
      ) : null}
      {props.layoutControls}
    </div>
  );
}

export function RightPanelTabs(props: RightPanelTabsProps) {
  const {
    mode,
    maximized,
    open,
    widthStorageKey,
    defaultWidth,
    hideTabBar,
    inlineResizable,
    children,
    ...stripProps
  } = props;
  const browserProfiles = useBrowserDefaults().profiles;
  return (
    <PreviewPanelShell
      mode={mode}
      {...(maximized !== undefined ? { maximized } : {})}
      {...(open !== undefined ? { open } : {})}
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
      <div className="flex min-h-0 flex-1 flex-col" data-right-panel-surface-content>
        {props.activeSurfaceId === null ? (
          <RightPanelEmptyState
            onAddBrowser={props.onAddBrowser}
            onAddBrowserInProfile={props.onAddBrowserInProfile}
            browserProfiles={browserProfiles}
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
