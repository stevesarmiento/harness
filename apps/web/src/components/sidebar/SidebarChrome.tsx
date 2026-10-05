import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { IconArrowTriangleheadPull as PullRequestIcon } from "symbols-react";

import { APP_BASE_NAME, APP_VERSION } from "../../branding";
import { cn } from "../../lib/utils";
import { usePullRequestsSupported } from "../../state/environments";
import { LogomarkForma } from "../LogomarkForma";
import { SettingsHexIcon, UsageChartIcon } from "../icons/custom";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarAccountControl } from "../clerk/SidebarAccountControl";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { isSidebarUtilityPage, useNavigateToMainApp } from "./mainAppLocation";
import { SidebarThreadUndoNotice } from "./SidebarThreadUndoNotice";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { SidebarUpdateArchitectureWarning, SidebarUpdatePill } from "./SidebarUpdatePill";

export const SidebarChromeHeader = memo(function SidebarChromeHeader({
  isElectron,
}: {
  isElectron: boolean;
}) {
  return (
    <SidebarHeader
      className={cn(
        "@container/sidebar-header relative isolate shrink-0 flex-row items-center justify-between overflow-hidden",
        isElectron
          ? "h-[42px] gap-2 px-3 py-0 wco:h-[env(titlebar-area-height)] wco:pl-[calc(env(titlebar-area-x)+1em)]"
          : "gap-3 px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-3",
        isElectron && "drag-region",
      )}
    >
      <SidebarTrigger className="relative z-10 md:hidden" />
      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-2 pl-1">
        <Tooltip>
          <TooltipTrigger render={<SidebarBrand />} />
          <TooltipPopup side="bottom" sideOffset={2}>
            Version {APP_VERSION}
          </TooltipPopup>
        </Tooltip>
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
    </SidebarHeader>
  );
});

// Measures the brand plus the header's padding and collapse trigger, so the
// sidebar minimum follows font size and zoom and the wordmark never clips.
export function SidebarBrandWidthProbe({
  onWidthChange,
}: {
  onWidthChange: (width: number) => void;
}) {
  const observeWidth = useCallback(
    (probe: HTMLDivElement) => {
      const observer = new ResizeObserver(([entry]) => {
        if (entry) onWidthChange(entry.borderBoxSize[0]?.inlineSize ?? probe.offsetWidth);
      });
      observer.observe(probe);
      return () => observer.disconnect();
    },
    [onWidthChange],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible fixed top-0 left-0 flex w-max items-center gap-2 border-r border-transparent px-4"
      ref={observeWidth}
    >
      <FormaWordmark />
      {/* The collapse trigger's footprint. */}
      <span className="size-7 shrink-0" />
    </div>
  );
}

function SidebarBrand() {
  return (
    <Link
      aria-label="Go to threads"
      className="sidebar-brand h-7 w-fit min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-md text-foreground outline-hidden ring-ring focus-visible:ring-2"
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

function SidebarUtilityItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton aria-label={label} onClick={onClick} size="icon">
              {icon}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">{label}</TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}

// Settings / Pull Requests / Usage row, swapped for a Back button on utility pages.
// The thread sidebars carry these in the account menu instead (Forma); the settings
// nav mounts this row directly.
export const SidebarUtilityMenu = memo(function SidebarUtilityMenu() {
  const navigate = useNavigate();
  const navigateToMainApp = useNavigateToMainApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const isOnUtilityPage = useLocation({
    select: (location) => isSidebarUtilityPage(location.pathname),
  });
  const pullRequestsSupported = usePullRequestsSupported();
  const closeMobileSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const handlePullRequestsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({
      to: "/pull-requests",
      search: readPullRequestListPreferences(),
    });
  }, [closeMobileSidebar, navigate]);
  const handleSettingsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/settings" });
  }, [closeMobileSidebar, navigate]);
  const handleUsageClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/usage" });
  }, [closeMobileSidebar, navigate]);
  const handleBackClick = useCallback(() => {
    closeMobileSidebar();
    void navigateToMainApp();
  }, [closeMobileSidebar, navigateToMainApp]);

  return (
    <SidebarMenu className="flex-row items-center">
      {isOnUtilityPage ? (
        <SidebarMenuItem className="min-w-0 flex-1">
          <SidebarMenuButton onClick={handleBackClick}>
            <ArrowLeftIcon />
            <span>Back</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : (
        <>
          <SidebarUtilityItem
            icon={<SettingsHexIcon />}
            label="Settings"
            onClick={handleSettingsClick}
          />
          {pullRequestsSupported ? (
            <SidebarUtilityItem
              icon={<PullRequestIcon className="fill-current" />}
              label="Pull Requests"
              onClick={handlePullRequestsClick}
            />
          ) : null}
          <SidebarUtilityItem
            icon={<UsageChartIcon className="fill-current" />}
            label="Usage"
            onClick={handleUsageClick}
          />
        </>
      )}
      <SidebarUpdatePill />
    </SidebarMenu>
  );
});

export const SidebarChromeFooter = memo(function SidebarChromeFooter({
  variant,
}: {
  variant: "v1" | "v2";
}) {
  return (
    <SidebarFooter className="p-[var(--sidebar-content-inset)]">
      <SidebarThreadUndoNotice />
      <SidebarProviderUpdatePill />
      <SidebarUpdateArchitectureWarning />
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <SidebarAccountControl variant={variant} />
        </div>
        <SidebarMenu className="w-auto shrink-0 flex-row">
          <SidebarUpdatePill />
        </SidebarMenu>
      </div>
    </SidebarFooter>
  );
});
