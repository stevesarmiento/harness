import { createFileRoute, Link } from "@tanstack/react-router";
import { LinkIcon, PlusIcon } from "lucide-react";

import { isLocalEnvironmentDisabled } from "../localEnvironment";
import { NoActiveThreadState } from "../components/NoActiveThreadState";
import { DesktopSidebarReopenButton } from "../components/sidebar/DesktopSidebarReopenButton";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset, SidebarInsetCard, SidebarTrigger } from "../components/ui/sidebar";
import { LogomarkForma } from "../components/LogomarkForma";
import { WorkspaceHeaderTitle } from "../components/WorkspaceHeaderTitle";
import { useAllEnvironmentShellsBootstrapped } from "../state/entities";
import { useEnvironments } from "../state/environments";
import { APP_DISPLAY_NAME } from "~/branding";
import { hasCloudPublicConfig } from "~/cloud/publicConfig";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments, isReady } = useEnvironments();

  if (authGateState.status === "hosted-static") {
    if (!isReady) return null;
    if (environments.length === 0) return <HostedStaticOnboardingState />;
  }

  return <IndexOverview />;
}

/**
 * Landing on the index route shows the workspace overview: quick actions,
 * open pull requests, and recent threads or projects.
 */
function IndexOverview() {
  const bootstrapped = useAllEnvironmentShellsBootstrapped();

  if (!bootstrapped) {
    return null;
  }
  return <NoActiveThreadState />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

function HostedStaticOnboardingState() {
  const cloudEnabled = hasCloudPublicConfig();
  const localEnvironmentOff = isLocalEnvironmentDisabled();
  const description = localEnvironmentOff
    ? "The local environment is turned off. Connect a remote environment, or turn the local environment back on in Connections."
    : cloudEnabled
      ? "Enable T3 Connect on that machine, then open Connections here to sign in with the same account. You can also add the machine using a pairing link."
      : "Open Connections and add that machine using its pairing link. This app must be able to reach it.";

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none text-foreground md:h-auto">
      <header className="workspace-topbar border-b border-border bg-background px-3 sm:px-5 md:border-b-0 md:bg-transparent md:pl-0 [--workspace-topbar-height:40px]">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-7 shrink-0 md:hidden" />
          <DesktopSidebarReopenButton className="md:ml-0" />
          <WorkspaceHeaderTitle
            icon={<LogomarkForma className="size-3.5 shrink-0 opacity-50" aria-hidden />}
          >
            {APP_DISPLAY_NAME}
          </WorkspaceHeaderTitle>
        </div>
      </header>

      <SidebarInsetCard className="overflow-x-hidden">
        <Empty className="flex-1">
          <div className="w-full max-w-xl rounded-3xl border border-border/55 bg-card/20 px-8 py-12 shadow-sm/5">
            <EmptyHeader className="max-w-none">
              <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground">
                <LinkIcon className="size-5" />
              </div>
              <EmptyTitle>Connect to a computer running T3 Code</EmptyTitle>
              <EmptyDescription>
                This app connects to T3 Code running on your computer or a server. Start the T3 Code
                desktop app or command-line server on that machine and keep it running.
              </EmptyDescription>
              <EmptyDescription>{description}</EmptyDescription>
              <div className="mt-6 flex justify-center">
                <Button render={<Link to="/settings/connections" />} size="sm">
                  <PlusIcon className="size-4" />
                  Open Connections
                </Button>
              </div>
            </EmptyHeader>
          </div>
        </Empty>
      </SidebarInsetCard>
    </SidebarInset>
  );
}
