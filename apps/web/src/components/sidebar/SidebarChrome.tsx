import { useAtomValue } from "@effect/atom-react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { memo } from "react";
import { Link } from "@tanstack/react-router";

import { APP_BASE_NAME, APP_VERSION } from "../../branding";
import { useEnvironmentIdentificationMode } from "../../hooks/useSettings";
import { shortcutLabelForCommand } from "../../keybindings";
import { cn } from "../../lib/utils";
import {
  navigateHistory,
  useCanNavigateHistory,
  type HistoryDirection,
} from "../../navigationHistory";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { LogomarkForma } from "../LogomarkForma";
import {
  resolveEnvironmentIdentificationPillLabel,
  useEnvironmentStageLabel,
} from "../SidebarStageBackdrop";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarAccountControl } from "../clerk/SidebarAccountControl";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import { SidebarFooter, SidebarMenu, SidebarTrigger } from "../ui/sidebar";
import { SidebarThreadUndoNotice } from "./SidebarThreadUndoNotice";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { SidebarUpdateArchitectureWarning, SidebarUpdatePill } from "./SidebarUpdatePill";
import { observeResize } from "~/lib/observeResize";

export const SidebarChromeHeader = memo(function SidebarChromeHeader({
  isElectron,
}: {
  isElectron: boolean;
}) {
  const stageLabel = useEnvironmentStageLabel();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  // Fork: Forma's header honors the pill mode only; the stage artwork stays out.
  const pillLabel =
    environmentIdentificationMode === "pill"
      ? resolveEnvironmentIdentificationPillLabel(stageLabel)
      : null;

  return (
    // Fork: Forma's titlebar row is a plain element (like upstream's), not a
    // padded SidebarHeader: it aligns to the window controls.
    <div
      className={cn(
        "@container/sidebar-header relative isolate flex shrink-0 flex-row items-center justify-between overflow-hidden",
        isElectron
          ? "h-[42px] gap-2 px-3 py-0 wco:h-[env(titlebar-area-height)] wco:pl-titlebar-area"
          : "gap-3 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-3",
        isElectron && "drag-region",
      )}
      data-sidebar="header"
      data-slot="sidebar-header"
    >
      <SidebarTrigger className="relative z-10 md:hidden" />
      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-1">
        <Tooltip>
          <TooltipTrigger render={<SidebarBrand />} />
          <TooltipPopup side="bottom" sideOffset={2}>
            Version {APP_VERSION}
          </TooltipPopup>
        </Tooltip>
        {isElectron ? (
          <div className="hidden shrink-0 items-center gap-0.5 md:flex">
            <HistoryNavigationButton direction="back" />
            <HistoryNavigationButton direction="forward" />
          </div>
        ) : null}
        {pillLabel ? (
          <Badge data-environment-identification="pill" size="sm" variant="secondary">
            {pillLabel}
          </Badge>
        ) : null}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarTrigger
              className="relative z-10 hidden shrink-0 md:-mr-2 md:inline-flex"
              data-testid="desktop-sidebar-collapse-trigger"
            />
          }
        />
        <TooltipPopup side="bottom">Collapse sidebar</TooltipPopup>
      </Tooltip>
    </div>
  );
});

// Measures the brand plus the header's padding and collapse trigger, so the
// sidebar minimum follows font size and zoom and the wordmark never clips.
export function SidebarBrandWidthProbe({
  isElectron,
  onWidthChange,
}: {
  isElectron: boolean;
  onWidthChange: (width: number) => void;
}) {
  const observeWidth = (probe: HTMLDivElement) => {
    return observeResize(probe, ([entry]) => {
      if (entry) onWidthChange(entry.borderBoxSize[0]?.inlineSize ?? probe.offsetWidth);
    });
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible fixed top-0 left-0 flex w-max items-center gap-2 border-r border-transparent px-4"
      ref={observeWidth}
    >
      <FormaWordmark />
      {isElectron ? (
        // The history buttons' footprint.
        <span className="flex shrink-0 gap-0.5">
          <span className="size-5" />
          <span className="size-5" />
        </span>
      ) : null}
      {/* The collapse trigger's footprint. */}
      <span className="size-7 shrink-0" />
    </div>
  );
}

// Fork: Forma's compact header buttons; the desktop app also forwards these
// as menu actions and swipes, so the buttons are the visible affordance only.
function HistoryNavigationButton({ direction }: { direction: HistoryDirection }) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const enabled = useCanNavigateHistory(direction);
  const label = direction === "back" ? "Go back" : "Go forward";
  const shortcutLabel = shortcutLabelForCommand(
    keybindings,
    direction === "back" ? "navigation.back" : "navigation.forward",
  );
  const Icon = direction === "back" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <SidebarHeaderIconButton
      label={label}
      tooltip={shortcutLabel ? `${label} (${shortcutLabel})` : label}
      className="[-webkit-app-region:no-drag]"
      disabled={!enabled}
      onClick={() => navigateHistory(direction)}
    >
      <Icon className="size-3.5" />
    </SidebarHeaderIconButton>
  );
}

function SidebarBrand() {
  return (
    <Link
      aria-label="Go to threads"
      className="sidebar-brand h-7 w-fit min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md text-foreground outline-hidden ring-ring focus-visible:ring-2 focus-visible:ring-inset"
      to="/"
    >
      <FormaWordmark />
    </Link>
  );
}

function FormaWordmark() {
  return (
    <span
      aria-label={APP_BASE_NAME}
      className="inline-flex shrink-0 items-center gap-2 font-semibold text-lg lowercase tracking-tight"
    >
      <LogomarkForma aria-hidden="true" className="h-5 w-auto shrink-0" />
      <span className="sidebar-brand-name truncate">{APP_BASE_NAME}</span>
    </span>
  );
}

// Fork: Forma's footer carries the account control; the utility row lives in
// its menu. The undo notice sits here so it never covers a thread.
export const SidebarChromeFooter = memo(function SidebarChromeFooter() {
  return (
    <SidebarFooter size="inset">
      <SidebarThreadUndoNotice />
      <SidebarProviderUpdatePill />
      <SidebarUpdateArchitectureWarning />
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <SidebarAccountControl variant="v2" />
        </div>
        <SidebarMenu className="w-auto shrink-0 flex-row">
          <SidebarUpdatePill />
        </SidebarMenu>
      </div>
    </SidebarFooter>
  );
});
