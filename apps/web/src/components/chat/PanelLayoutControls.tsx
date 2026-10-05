import { PanelBottomIcon, SquareMenuIcon } from "lucide-react";
import { memo, type ReactElement } from "react";

import type { ThreadPanelPresentation } from "../../rightPanelLayout";
import { HeaderIconActionButton } from "../HeaderIconActionButton";
import { PopoverCreateHandle, PopoverTrigger } from "../ui/popover";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { PanelCollapseIcon, PanelExpandIcon, SidebarPanelIcon } from "../icons/custom";

export interface PanelLayoutControlsProps {
  showThreadPanelControl?: boolean;
  showTerminalControl?: boolean;
  showRightPanelControl?: boolean;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalShortcutLabel: string | null;
  threadPanelOpen: boolean;
  threadPanelPresentation: ThreadPanelPresentation;
  threadPanelPopoverHandle?: ReturnType<typeof PopoverCreateHandle>;
  threadPanelShortcutLabel: string | null;
  threadPanelHasAttention: boolean;
  rightPanelAvailable: boolean;
  rightPanelOpen: boolean;
  rightPanelShortcutLabel: string | null;
  rightPanelUnavailableLabel?: string;
  /** Fork: running + waiting subagents in this thread; badges the right panel toggle. */
  liveAgentCount?: number;
  onToggleTerminal: () => void;
  onToggleThreadPanel: () => void;
  onToggleRightPanel: () => void;
}

export const PanelLayoutControls = memo(function PanelLayoutControls({
  showThreadPanelControl = true,
  showTerminalControl = true,
  showRightPanelControl = true,
  terminalAvailable,
  terminalOpen,
  terminalShortcutLabel,
  threadPanelOpen,
  threadPanelPresentation,
  threadPanelPopoverHandle,
  threadPanelShortcutLabel,
  threadPanelHasAttention,
  rightPanelAvailable,
  rightPanelOpen,
  rightPanelShortcutLabel,
  rightPanelUnavailableLabel = "Right panel is unavailable",
  liveAgentCount = 0,
  onToggleTerminal,
  onToggleThreadPanel,
  onToggleRightPanel,
}: PanelLayoutControlsProps) {
  const threadPanelToggle = (
    <Toggle
      className="relative shrink-0 [-webkit-app-region:no-drag]"
      pressed={threadPanelOpen}
      aria-label="Toggle thread details panel"
      variant="ghost"
      size="sm"
    >
      <SquareMenuIcon className="size-4" />
      {threadPanelHasAttention ? (
        <span
          className="absolute right-1 top-1 size-1.5 rounded-full bg-warning ring-2 ring-background"
          aria-hidden="true"
        />
      ) : null}
    </Toggle>
  );
  const threadPanelTooltip = (trigger: ReactElement) => (
    <Tooltip>
      <TooltipTrigger
        render={trigger}
        {...(threadPanelPresentation === "popover" ? {} : { onClick: onToggleThreadPanel })}
      />
      <TooltipPopup side="bottom">
        Toggle thread details
        {threadPanelShortcutLabel ? ` (${threadPanelShortcutLabel})` : ""}
      </TooltipPopup>
    </Tooltip>
  );

  return (
    <div
      className="flex h-full shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
      data-panel-layout-controls
    >
      {showThreadPanelControl
        ? threadPanelPresentation === "popover"
          ? threadPanelTooltip(
              <PopoverTrigger handle={threadPanelPopoverHandle} render={threadPanelToggle} />,
            )
          : threadPanelTooltip(threadPanelToggle)
        : null}
      {showTerminalControl ? (
        <TerminalDrawerToggleControl
          available={terminalAvailable}
          open={terminalOpen}
          shortcutLabel={terminalShortcutLabel}
          onToggle={onToggleTerminal}
        />
      ) : null}
      {showRightPanelControl ? (
        <RightPanelToggleControl
          available={rightPanelAvailable}
          open={rightPanelOpen}
          shortcutLabel={rightPanelShortcutLabel}
          unavailableLabel={rightPanelUnavailableLabel}
          liveAgentCount={liveAgentCount}
          onToggle={onToggleRightPanel}
        />
      ) : null}
    </div>
  );
});

export const TerminalDrawerToggleControl = memo(function TerminalDrawerToggleControl({
  available,
  open,
  shortcutLabel,
  onToggle,
}: {
  available: boolean;
  open: boolean;
  shortcutLabel: string | null;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className="shrink-0 [-webkit-app-region:no-drag]"
            pressed={open}
            onPressedChange={onToggle}
            aria-label="Toggle terminal drawer"
            variant="ghost"
            size="sm"
            disabled={!available}
          >
            <PanelBottomIcon className="size-3.5" />
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">
        {available
          ? `Toggle terminal drawer${shortcutLabel ? ` (${shortcutLabel})` : ""}`
          : "Terminal drawer is unavailable"}
      </TooltipPopup>
    </Tooltip>
  );
});

export const RightPanelToggleControl = memo(function RightPanelToggleControl({
  available,
  open,
  shortcutLabel,
  unavailableLabel = "Right panel is unavailable",
  liveAgentCount = 0,
  onToggle,
}: {
  available: boolean;
  open: boolean;
  shortcutLabel: string | null;
  unavailableLabel?: string;
  liveAgentCount?: number;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className="relative shrink-0 [-webkit-app-region:no-drag]"
            pressed={open}
            onPressedChange={onToggle}
            aria-label={
              liveAgentCount > 0
                ? `${open ? "Close" : "Open"} right panel, ${liveAgentCount} ${liveAgentCount === 1 ? "agent" : "agents"} working`
                : open
                  ? "Close right panel"
                  : "Open right panel"
            }
            variant="ghost"
            size="sm"
            disabled={!available}
          >
            <SidebarPanelIcon filled={open} className="size-4 rotate-180" />
            {liveAgentCount > 0 ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-info px-1 text-3xs font-semibold tabular-nums text-white"
              >
                {liveAgentCount}
              </span>
            ) : null}
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">
        {available
          ? `${open ? "Close" : "Open"} right panel${shortcutLabel ? ` (${shortcutLabel})` : ""}${
              liveAgentCount > 0
                ? ` · ${liveAgentCount} ${liveAgentCount === 1 ? "agent" : "agents"} working`
                : ""
            }`
          : unavailableLabel}
      </TooltipPopup>
    </Tooltip>
  );
});

export const RightPanelMaximizeControl = memo(function RightPanelMaximizeControl({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  const label = maximized ? "Restore panel size" : "Maximize panel";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // HeaderIconActionButton (not Toggle): matches the size and hover
          // treatment of the sibling header controls it sits inline with.
          <HeaderIconActionButton
            aria-label={label}
            pressed={maximized}
            className="[-webkit-app-region:no-drag]"
            onClick={onToggle}
          />
        }
      >
        {maximized ? (
          <PanelCollapseIcon className="size-4" aria-hidden />
        ) : (
          <PanelExpandIcon className="size-4" aria-hidden />
        )}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
});
