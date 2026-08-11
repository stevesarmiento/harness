import { UserButton, useUser } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { CloudIcon, LogInIcon, SmartphoneIcon, UserRoundIcon } from "lucide-react";
import { useCallback, useRef, type ComponentType } from "react";

import { resolveCloudPublicConfigState } from "../../cloud/publicConfig";
import { useCloudLinkController } from "../../cloud/useCloudLinkController";
import { usePrimaryEnvironment } from "../../state/environments";
import { cn } from "../../lib/utils";
import {
  IconArrowTriangleheadPull as PullRequestIcon,
  IconCircleLefthalfFilledRighthalfStripedHorizontalInverse as ContrastIcon,
  IconDisplay as DisplayIcon,
  IconEllipsis as EllipsisIcon,
  IconSunMaxFill as SunIcon,
} from "symbols-react";

import { useTheme } from "../../hooks/useTheme";
import type { ThemeMode } from "../../theme";
import {
  NightModeIcon as MoonIcon,
  SettingsHexIcon,
  UsageChartIcon as UsageIcon,
} from "../icons/custom";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { SidebarMenuButton, useSidebar } from "../ui/sidebar";
import { MobileClientsUserProfilePage } from "./MobileClientsUserProfilePage";
import {
  CLERK_UNAVAILABLE_HINT,
  resolveT3ConnectSidebarPresentation,
  type T3ConnectSidebarStatusTone,
} from "./T3ConnectSidebarControl.logic";
import { useT3ConnectAuthPrompt } from "./useT3ConnectAuthPrompt";
import { useT3ConnectClerkAvailability } from "./useT3ConnectClerkAvailability";

const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  highContrast: "High Contrast",
};

const THEME_MODE_ICONS = {
  system: DisplayIcon,
  light: SunIcon,
  dark: MoonIcon,
  highContrast: ContrastIcon,
} as const satisfies Record<ThemeMode, ComponentType<{ className?: string }>>;

const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark", "highContrast"];

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark" || value === "highContrast";
}

const STATUS_DOT_CLASSNAME: Record<T3ConnectSidebarStatusTone, string> = {
  error: "bg-destructive",
  muted: "bg-muted-foreground/45",
  pending: "bg-amber-500",
  success: "bg-emerald-500",
};

type SidebarAccountVariant = "v1" | "v2";

interface SidebarAccountInfo {
  readonly name: string;
  readonly email: string | null;
}

interface SidebarConnectStatus {
  readonly label: string;
  readonly tone: T3ConnectSidebarStatusTone;
  readonly hint: string | null;
  readonly disabled?: boolean;
}

/**
 * Bottom-of-sidebar account row: the Clerk profile button plus name on the
 * left with an always-visible T3 Connect status dot on the avatar corner, and
 * an icon on the right whose menu carries T3 Connect, Settings, and (signed
 * out) a sign-in action.
 */
export function SidebarAccountControl({ variant }: { readonly variant: SidebarAccountVariant }) {
  const configState = resolveCloudPublicConfigState();
  if (!configState.configured) {
    const diagnostic = import.meta.env.DEV
      ? `Missing ${configState.missingKeys.join(", ")}`
      : "See build diagnostics";
    return (
      <SidebarAccountRow
        account={null}
        connect={{ disabled: true, hint: diagnostic, label: "Unavailable", tone: "muted" }}
        onSignIn={null}
        variant={variant}
      />
    );
  }
  return <ConfiguredSidebarAccountControl variant={variant} />;
}

function ConfiguredSidebarAccountControl({ variant }: { readonly variant: SidebarAccountVariant }) {
  const availability = useT3ConnectClerkAvailability();
  const { user } = useUser();
  const { openAuthPrompt } = useT3ConnectAuthPrompt();
  const { linkState, managedTunnelActive, publishAgentActivity, operationError } =
    useCloudLinkController();

  const error = operationError ?? linkState.error;
  const presentation = resolveT3ConnectSidebarPresentation({
    error,
    isPending: linkState.isPending,
    managedTunnelActive,
    publishAgentActivity,
  });

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const account: SidebarAccountInfo | null =
    availability === "signed-in"
      ? { email, name: user?.fullName ?? user?.username ?? email ?? "Account" }
      : null;

  return (
    <SidebarAccountRow
      account={account}
      connect={{
        hint: error ?? (availability === "unavailable" ? CLERK_UNAVAILABLE_HINT : null),
        label: presentation.label,
        tone: presentation.tone,
      }}
      onSignIn={availability === "signed-out" ? openAuthPrompt : null}
      variant={variant}
    />
  );
}

function SidebarAccountStatusDot({ tone }: { readonly tone: T3ConnectSidebarStatusTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -right-px -bottom-px size-2 rounded-full ring-2 ring-sidebar",
        STATUS_DOT_CLASSNAME[tone],
      )}
      data-testid="sidebar-account-status-dot"
    />
  );
}

function SidebarThemeSubmenu() {
  const { themeSettings, setThemeMode } = useTheme();
  const ActiveThemeIcon = THEME_MODE_ICONS[themeSettings.mode];

  return (
    <MenuSub>
      <MenuSubTrigger data-testid="sidebar-theme-submenu-trigger">
        <ActiveThemeIcon className="size-3.5 shrink-0 fill-current opacity-60" />
        Theme
        <span className="ms-auto truncate text-muted-foreground text-xs">
          {THEME_MODE_LABELS[themeSettings.mode]}
        </span>
      </MenuSubTrigger>
      <MenuSubPopup className="w-44">
        <MenuRadioGroup
          value={themeSettings.mode}
          onValueChange={(value) => {
            if (isThemeMode(value)) {
              setThemeMode(value);
            }
          }}
        >
          {THEME_MODES.map((mode) => {
            const Icon = THEME_MODE_ICONS[mode];
            return (
              <MenuRadioItem key={mode} value={mode} closeOnClick>
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0 fill-current opacity-60" />
                  {THEME_MODE_LABELS[mode]}
                </span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuSubPopup>
    </MenuSub>
  );
}

function SidebarAccountRow({
  account,
  connect,
  onSignIn,
  variant,
}: {
  readonly account: SidebarAccountInfo | null;
  readonly connect: SidebarConnectStatus;
  readonly onSignIn: (() => void) | null;
  readonly variant: SidebarAccountVariant;
}) {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const primaryEnvironment = usePrimaryEnvironment();
  const pullRequestsSupported =
    primaryEnvironment?.serverConfig?.environment.capabilities.pullRequests === true;
  const handlePullRequestsClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/pull-requests", search: { involvement: "all", state: "open" } });
  }, [isMobile, navigate, setOpenMobile]);
  const handleUsageClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/usage" });
  }, [isMobile, navigate, setOpenMobile]);
  const profileRef = useRef<HTMLDivElement>(null);

  const navigateTo = useCallback(
    (to: "/settings" | "/settings/connections") => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to });
    },
    [isMobile, navigate, setOpenMobile],
  );

  // Clicking the name/email area toggles the Clerk menu just like the avatar.
  const forwardToClerkTrigger = useCallback((event: React.MouseEvent) => {
    const trigger = profileRef.current?.querySelector<HTMLButtonElement>(
      "button.cl-userButtonTrigger",
    );
    if (trigger && !trigger.contains(event.target as Node)) {
      trigger.click();
    }
  }, []);

  const statusTitle = connect.hint ?? `T3 Connect: ${connect.label}`;

  return (
    <div className="flex items-center justify-between gap-1" data-testid="sidebar-account-row">
      {account ? (
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg p-1 hover:bg-sidebar-row-hover"
          data-testid="sidebar-account-profile"
          onClick={forwardToClerkTrigger}
          ref={profileRef}
          title={statusTitle}
        >
          <span className="relative inline-flex shrink-0">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "size-7",
                  userButtonTrigger: "rounded-full",
                },
              }}
            >
              <UserButton.UserProfilePage
                label="Mobile clients"
                labelIcon={<SmartphoneIcon className="size-4" />}
                url="mobile-clients"
              >
                <MobileClientsUserProfilePage />
              </UserButton.UserProfilePage>
            </UserButton>
            <SidebarAccountStatusDot tone={connect.tone} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-medium text-sidebar-foreground/90 text-xs">
              {account.name}
            </span>
            {account.email && account.email !== account.name ? (
              <span className="block truncate text-muted-foreground text-ui-2xs">
                {account.email}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <button
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left",
            onSignIn ? "cursor-pointer hover:bg-sidebar-row-hover" : "cursor-default opacity-70",
          )}
          data-testid="sidebar-account-sign-in"
          disabled={!onSignIn}
          onClick={onSignIn ?? undefined}
          title={statusTitle}
          type="button"
        >
          <span className="relative inline-flex shrink-0">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserRoundIcon className="size-4" />
            </span>
            <SidebarAccountStatusDot tone={connect.tone} />
          </span>
          <span className="min-w-0 truncate text-muted-foreground text-xs">
            {onSignIn ? "Sign in" : "Not signed in"}
          </span>
        </button>
      )}
      <Menu>
        <MenuTrigger
          render={
            <SidebarMenuButton
              aria-label="Connect and settings"
              className={cn(
                "shrink-0",
                variant === "v1"
                  ? "size-7 rounded-lg text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  : "size-8",
              )}
              data-testid="sidebar-connect-settings-trigger"
              size="icon"
              title={statusTitle}
            />
          }
        >
          <EllipsisIcon className="size-3 rotate-90 fill-current" />
        </MenuTrigger>
        <MenuPopup align="end" className="w-56" side="top" sideOffset={6}>
          <MenuItem
            data-testid="sidebar-account-t3-connect"
            disabled={connect.disabled}
            onClick={connect.disabled ? undefined : () => navigateTo("/settings/connections")}
            title={connect.hint ?? undefined}
          >
            <CloudIcon />
            <span className="min-w-0 flex-1 truncate">T3 Connect</span>
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
              <span
                aria-hidden="true"
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASSNAME[connect.tone])}
              />
              {connect.label}
            </span>
          </MenuItem>
          <SidebarThemeSubmenu />
          {pullRequestsSupported ? (
            <MenuItem onClick={handlePullRequestsClick}>
              <PullRequestIcon className="fill-current" />
              Pull Requests
            </MenuItem>
          ) : null}
          <MenuItem onClick={handleUsageClick}>
            <UsageIcon className="fill-current" />
            Usage
          </MenuItem>
          <MenuItem onClick={() => navigateTo("/settings")}>
            <SettingsHexIcon />
            Settings
          </MenuItem>
          {onSignIn ? (
            <>
              <MenuSeparator />
              <MenuItem data-testid="t3-connect-sign-in" onClick={onSignIn}>
                <LogInIcon />
                Sign in to T3 Connect
              </MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>
    </div>
  );
}
