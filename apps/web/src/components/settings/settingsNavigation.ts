import type { ComponentType } from "react";
import {
  BlocksIcon as IntegrationsIcon,
  GitPullRequestIcon as SourceControlIcon,
  KeyboardIcon as KeybindingsIcon,
  ShieldIcon,
} from "lucide-react";
import {
  IconWifi as ConnectionsIcon,
  IconSwatchpalette as InterfaceIcon,
  IconTextBubble as ThreadsIcon,
} from "symbols-react";
import {
  AdvancedSettingsIcon as AdvancedIcon,
  NotificationsSettingsIcon as NotificationsIcon,
  ProvidersSettingsIcon as ProvidersIcon,
} from "../icons/custom";

export type SettingsRestoreScope =
  | "interface"
  | "threads"
  | "notifications"
  | "providers"
  | "safety";

export type SettingsSectionPath =
  | "/settings/interface"
  | "/settings/keybindings"
  | "/settings/threads"
  | "/settings/notifications"
  | "/settings/providers"
  | "/settings/integrations"
  | "/settings/safety"
  | "/settings/source-control"
  | "/settings/connections"
  | "/settings/advanced";

export const SETTINGS_DEFAULT_PATH: SettingsSectionPath = "/settings/interface";

export const LEGACY_SETTINGS_PATH_REDIRECTS = {
  "/settings/general": "/settings/interface",
  "/settings/archived": "/settings/threads",
} as const;

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  label: string;
  to: SettingsSectionPath;
  icon: ComponentType<{ className?: string }>;
  iconUsesFill: boolean;
  restoreScope: SettingsRestoreScope | null;
}> = [
  {
    label: "Interface",
    to: "/settings/interface",
    icon: InterfaceIcon,
    iconUsesFill: true,
    restoreScope: "interface",
  },
  {
    // Upstream #8532 surfaces keybinding rows on a dedicated page; it sits
    // next to Interface because bindings are an input/interface concern.
    label: "Keybindings",
    to: "/settings/keybindings",
    icon: KeybindingsIcon,
    iconUsesFill: false,
    restoreScope: null,
  },
  {
    label: "Threads",
    to: "/settings/threads",
    icon: ThreadsIcon,
    iconUsesFill: true,
    restoreScope: "threads",
  },
  {
    label: "Notifications",
    to: "/settings/notifications",
    icon: NotificationsIcon,
    iconUsesFill: true,
    restoreScope: "notifications",
  },
  {
    label: "Providers",
    to: "/settings/providers",
    icon: ProvidersIcon,
    iconUsesFill: true,
    restoreScope: "providers",
  },
  {
    // Upstream's Integrations page (browser defaults, profiles, link target).
    label: "Integrations",
    to: "/settings/integrations",
    icon: IntegrationsIcon,
    iconUsesFill: false,
    restoreScope: null,
  },
  {
    label: "Safety",
    to: "/settings/safety",
    icon: ShieldIcon,
    iconUsesFill: false,
    restoreScope: "safety",
  },
  {
    label: "Source Control",
    to: "/settings/source-control",
    icon: SourceControlIcon,
    iconUsesFill: false,
    restoreScope: null,
  },
  {
    label: "Connections",
    to: "/settings/connections",
    icon: ConnectionsIcon,
    iconUsesFill: true,
    restoreScope: null,
  },
  {
    label: "Advanced",
    to: "/settings/advanced",
    icon: AdvancedIcon,
    iconUsesFill: true,
    restoreScope: null,
  },
] as const;

export function resolveSettingsPathname(pathname: string): SettingsSectionPath | null {
  const canonicalPathname =
    pathname in LEGACY_SETTINGS_PATH_REDIRECTS
      ? LEGACY_SETTINGS_PATH_REDIRECTS[pathname as keyof typeof LEGACY_SETTINGS_PATH_REDIRECTS]
      : pathname;

  return SETTINGS_NAV_ITEMS.find((item) => item.to === canonicalPathname)?.to ?? null;
}

export function getSettingsRestoreScope(pathname: string): SettingsRestoreScope | null {
  const currentPath = resolveSettingsPathname(pathname);
  return SETTINGS_NAV_ITEMS.find((item) => item.to === currentPath)?.restoreScope ?? null;
}
