import { IconArrowCounterclockwise as RotateCcwIcon, IconGearshape } from "symbols-react";
import {
  Outlet,
  createFileRoute,
  redirect,
  useCanGoBack,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { useSettingsRestore } from "../components/settings/SettingsPanels";
import { SETTINGS_DEFAULT_PATH } from "../components/settings/settingsNavigation";
import { DesktopSidebarReopenButton } from "../components/sidebar/DesktopSidebarReopenButton";
import { Button } from "../components/ui/button";
import { SidebarInset, SidebarInsetCard, SidebarTrigger } from "../components/ui/sidebar";
import { WorkspaceHeaderTitle } from "../components/WorkspaceHeaderTitle";
import { isElectron } from "../env";

function RestoreDefaultsButton({ onRestored }: { onRestored: () => void }) {
  const { changedSettingLabels, restoreDefaults } = useSettingsRestore(onRestored);

  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={changedSettingLabels.length === 0}
      onClick={() => void restoreDefaults()}
    >
      <RotateCcwIcon className="mx-1 size-3.5" />
      Restore defaults
    </Button>
  );
}

function SettingsContentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const [restoreSignal, setRestoreSignal] = useState(0);
  const showRestoreDefaults = location.pathname === "/settings/general";
  const handleRestored = () => setRestoreSignal((value) => value + 1);
  const navigateBackWithinApp = useCallback(() => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }

        navigateBackWithinApp();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigateBackWithinApp]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none text-foreground isolate md:h-auto">
      {!isElectron && (
        <header className="workspace-topbar border-b border-border bg-background px-3 sm:px-5 md:border-b-0 md:bg-transparent md:pl-0 [--workspace-topbar-height:40px]">
          <div className="flex min-w-0 w-full items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0 md:hidden" />
            <DesktopSidebarReopenButton className="md:ml-0" />
            <WorkspaceHeaderTitle
              icon={
                <IconGearshape className="size-3.5 shrink-0 fill-current opacity-50" aria-hidden />
              }
            >
              Settings
            </WorkspaceHeaderTitle>
            {showRestoreDefaults ? (
              <div className="ms-auto flex items-center gap-2">
                <RestoreDefaultsButton onRestored={handleRestored} />
              </div>
            ) : null}
          </div>
        </header>
      )}

      {isElectron && (
        <div className="workspace-topbar drag-region border-b border-border bg-background px-3 sm:px-5 md:border-b-0 md:bg-transparent md:pl-0 [--workspace-topbar-height:39px] wco:pr-[var(--workspace-native-controls-inset)]">
          <div className="flex min-w-0 items-center gap-2">
            <DesktopSidebarReopenButton className="md:ml-0" />
            <WorkspaceHeaderTitle
              icon={
                <IconGearshape className="size-3.5 shrink-0 fill-current opacity-50" aria-hidden />
              }
            >
              Settings
            </WorkspaceHeaderTitle>
          </div>
          {showRestoreDefaults ? (
            <div className="ms-auto flex items-center gap-2 [-webkit-app-region:no-drag]">
              <RestoreDefaultsButton onRestored={handleRestored} />
            </div>
          ) : null}
        </div>
      )}

      <SidebarInsetCard>
        <div key={restoreSignal} className="min-h-0 flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInsetCard>
    </SidebarInset>
  );
}

function SettingsRouteLayout() {
  return <SettingsContentLayout />;
}

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context, location }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }

    if (location.pathname === "/settings") {
      throw redirect({ to: SETTINGS_DEFAULT_PATH, replace: true });
    }
  },
  component: SettingsRouteLayout,
});
