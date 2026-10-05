import type { ComponentType } from "react";
import {
  BlocksIcon,
  CalendarClockIcon,
  createLucideIcon,
  GitPullRequestIcon as SourceControlIcon,
  HardDriveIcon,
  PanelsTopLeftIcon,
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

const SnapShotIcon = createLucideIcon("snap-shot", [
  [
    "path",
    {
      d: "M8 3H6a3 3 0 0 0-3 3v2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2",
      key: "capture-frame",
    },
  ],
  ["rect", { width: "10", height: "8", x: "7", y: "8", rx: "2", key: "window" }],
  ["circle", { cx: "12", cy: "12", r: "1.5", key: "lens" }],
]);

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
    icon: PanelsTopLeftIcon,
    iconUsesFill: false,
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
    icon: BlocksIcon,
    iconUsesFill: false,
    restoreScope: null,
  },
  {
    label: "Scheduled Tasks",
    to: "/settings/scheduled-tasks",
    icon: CalendarClockIcon,
    iconUsesFill: false,
    restoreScope: null,
  },
  {
    label: "SnapShots",
    to: "/settings/snap-shot",
    icon: SnapShotIcon,
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
    label: "Storage",
    to: "/settings/storage",
    icon: HardDriveIcon,
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
