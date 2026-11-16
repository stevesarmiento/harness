import { createFileRoute } from "@tanstack/react-router";

import { SafetySettingsPanel } from "../components/settings/SafetySettingsPanel";

// Fork: protected paths and the event stream live on their own settings page.
export const Route = createFileRoute("/_chat/settings/safety")({
  component: SafetySettingsPanel,
});
