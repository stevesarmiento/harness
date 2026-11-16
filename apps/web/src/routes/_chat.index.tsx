import { createFileRoute } from "@tanstack/react-router";

import { NoActiveThreadState } from "../components/NoActiveThreadState";
import { HostedEmptyState } from "../components/HostedEmptyState";
import { useAllEnvironmentShellsBootstrapped } from "../state/entities";
import { useEnvironments } from "../state/environments";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments, isReady } = useEnvironments();

  if (authGateState.status === "hosted-static") {
    if (!isReady) return null;
    if (environments.length === 0) return <HostedEmptyState />;
  }

  return <IndexOverview />;
}

/**
 * Fork: landing on the index route shows the workspace overview (quick
 * actions, open pull requests, and recent threads or projects) instead of
 * upstream's auto-started draft thread.
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
