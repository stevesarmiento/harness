import { memo } from "react";
import { Link } from "@tanstack/react-router";

import { APP_BASE_NAME, APP_VERSION } from "../../branding";
import { cn } from "../../lib/utils";
import { LogomarkForma } from "../LogomarkForma";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarAccountControl } from "../clerk/SidebarAccountControl";
import { SidebarFooter, SidebarHeader, SidebarTrigger } from "../ui/sidebar";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { SidebarUpdatePill } from "./SidebarUpdatePill";

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

export const SidebarChromeFooter = memo(function SidebarChromeFooter({
  variant,
}: {
  variant: "v1" | "v2";
}) {
  return (
    <SidebarFooter className="p-[var(--sidebar-content-inset)]">
      <SidebarProviderUpdatePill />
      <SidebarUpdatePill />
      <SidebarAccountControl variant={variant} />
    </SidebarFooter>
  );
});
