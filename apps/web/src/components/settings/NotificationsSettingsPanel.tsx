import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";
import { Switch } from "../ui/switch";
import { NotificationSettings } from "./NotificationSettings";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

/**
 * Forma's Notifications page. Thread attention alerts are driven by upstream's
 * device-local `notificationMode` (system notifications and/or sound) and
 * `inAppNotificationsEnabled` (focused-app toasts).
 */
export function NotificationsSettingsPanel() {
  const inAppNotificationsEnabled = useClientSettings(
    (settings) => settings.inAppNotificationsEnabled,
  );
  const updateClientSettings = useUpdateClientSettings();

  return (
    <SettingsPageContainer>
      <SettingsSection title="Thread attention">
        <NotificationSettings />
        <SettingsRow
          {...searchableSetting("in-app-notifications")}
          description="Show a toast when another thread finishes, fails, or needs input or approval while Forma is focused."
          resetAction={
            inAppNotificationsEnabled !== DEFAULT_UNIFIED_SETTINGS.inAppNotificationsEnabled ? (
              <SettingResetButton
                label="in-app notifications"
                onClick={() =>
                  updateClientSettings({
                    inAppNotificationsEnabled: DEFAULT_UNIFIED_SETTINGS.inAppNotificationsEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={inAppNotificationsEnabled}
              onCheckedChange={(checked) =>
                updateClientSettings({ inAppNotificationsEnabled: Boolean(checked) })
              }
              aria-label="In-app notifications"
            />
          }
        />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
