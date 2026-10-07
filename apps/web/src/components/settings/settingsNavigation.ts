import type { ComponentType } from "react";
import { ShieldIcon } from "lucide-react";
import {
  IconArrowTriangleheadBranch as SourceControlIcon,
  IconCalendarBadgeClock as ScheduledTasksIcon,
  IconFolder as ProjectsIcon,
  IconInternaldrive as StorageIcon,
  IconPuzzlepieceExtension as IntegrationsIcon,
  IconViewfinder as SnapShotIcon,
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
  | "/settings/threads"
  | "/settings/notifications"
  | "/settings/projects"
  | "/settings/providers"
  | "/settings/integrations"
  | "/settings/scheduled-tasks"
  | "/settings/snap-shot"
  | "/settings/safety"
  | "/settings/source-control"
  | "/settings/storage"
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
  // Fork: Projects only shows while a project/checkout scope is selected
  // (filtered in SettingsSidebarNav).
  {
    label: "Projects",
    to: "/settings/projects",
    icon: ProjectsIcon,
    iconUsesFill: true,
    restoreScope: null,
  },
  {
    label: "Providers",
    to: "/settings/providers",
    icon: ProvidersIcon,
    iconUsesFill: true,
    restoreScope: "providers",
  },
  {
    label: "Integrations",
    to: "/settings/integrations",
    icon: IntegrationsIcon,
    iconUsesFill: true,
    restoreScope: null,
  },
  {
    label: "Scheduled Tasks",
    to: "/settings/scheduled-tasks",
    icon: ScheduledTasksIcon,
    iconUsesFill: true,
    restoreScope: null,
  },
  {
    label: "SnapShots",
    to: "/settings/snap-shot",
    icon: SnapShotIcon,
    iconUsesFill: true,
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
    iconUsesFill: true,
    restoreScope: null,
  },
  {
    label: "Storage",
    to: "/settings/storage",
    icon: StorageIcon,
    iconUsesFill: true,
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
