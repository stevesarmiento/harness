import { UserButton } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { CloudIcon, LogInIcon, SmartphoneIcon, UserRoundIcon } from "lucide-react";
import { useCallback } from "react";

import { resolveCloudPublicConfigState } from "../../cloud/publicConfig";
import { useCloudLinkController } from "../../cloud/useCloudLinkController";
import { cn } from "../../lib/utils";
import { SettingsHexIcon } from "../icons/custom";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarMenuButton, useSidebar } from "../ui/sidebar";
import { MobileClientsUserProfilePage } from "./MobileClientsUserProfilePage";
import {
  CLERK_UNAVAILABLE_HINT,
  resolveT3ConnectSidebarPresentation,
  type T3ConnectSidebarStatusTone,
} from "./T3ConnectSidebarControl.logic";
import { useT3ConnectAuthPrompt } from "./useT3ConnectAuthPrompt";
import { useT3ConnectClerkAvailability } from "./useT3ConnectClerkAvailability";

const STATUS_DOT_CLASSNAME: Record<T3ConnectSidebarStatusTone, string> = {
  error: "bg-destructive",
  muted: "bg-muted-foreground/45",
  pending: "bg-amber-500",
  success: "bg-emerald-500",
};

type SidebarAccountVariant = "v1" | "v2";

interface SidebarConnectStatus {
  readonly label: string;
  readonly tone: T3ConnectSidebarStatusTone;
  readonly hint: string | null;
  readonly disabled?: boolean;
}

/**
 * Bottom-of-sidebar account row: the Clerk profile button on the left with an
 * always-visible T3 Connect status dot on its corner, and an icon on the right
 * whose menu carries T3 Connect, Settings, and (signed out) a sign-in action.
 */
export function SidebarAccountControl({ variant }: { readonly variant: SidebarAccountVariant }) {
  const configState = resolveCloudPublicConfigState();
  if (!configState.configured) {
    const diagnostic = import.meta.env.DEV
      ? `Missing ${configState.missingKeys.join(", ")}`
      : "See build diagnostics";
    return (
      <SidebarAccountRow
        connect={{ disabled: true, hint: diagnostic, label: "Unavailable", tone: "muted" }}
        onSignIn={null}
        signedIn={false}
        variant={variant}
      />
    );
  }
  return <ConfiguredSidebarAccountControl variant={variant} />;
}

function ConfiguredSidebarAccountControl({ variant }: { readonly variant: SidebarAccountVariant }) {
  const availability = useT3ConnectClerkAvailability();
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

  return (
    <SidebarAccountRow
      connect={{
        hint: error ?? (availability === "unavailable" ? CLERK_UNAVAILABLE_HINT : null),
        label: presentation.label,
        tone: presentation.tone,
      }}
      onSignIn={availability === "signed-out" ? openAuthPrompt : null}
      signedIn={availability === "signed-in"}
      variant={variant}
    />
  );
}

function SidebarAccountRow({
  connect,
  onSignIn,
  signedIn,
  variant,
}: {
  readonly connect: SidebarConnectStatus;
  readonly onSignIn: (() => void) | null;
  readonly signedIn: boolean;
  readonly variant: SidebarAccountVariant;
}) {
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();

  const navigateTo = useCallback(
    (to: "/settings" | "/settings/connections") => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to });
    },
    [isMobile, navigate, setOpenMobile],
  );

  const statusTitle = connect.hint ?? `T3 Connect: ${connect.label}`;

  return (
    <div className="flex items-center justify-between gap-1" data-testid="sidebar-account-row">
      <span className="relative inline-flex" title={statusTitle}>
        {signedIn ? (
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-7",
                userButtonTrigger: "rounded-lg p-1 hover:bg-sidebar-row-hover",
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
        ) : (
          <button
            aria-label={onSignIn ? "Sign in to T3 Connect" : "Account"}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg p-1",
              onSignIn ? "cursor-pointer hover:bg-sidebar-row-hover" : "cursor-default opacity-70",
            )}
            data-testid="sidebar-account-sign-in"
            disabled={!onSignIn}
            onClick={onSignIn ?? undefined}
            type="button"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserRoundIcon className="size-4" />
            </span>
          </button>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-0.5 bottom-0.5 size-2 rounded-full ring-2 ring-sidebar",
            STATUS_DOT_CLASSNAME[connect.tone],
          )}
          data-testid="sidebar-account-status-dot"
        />
      </span>
      <Menu>
        <MenuTrigger
          render={
            <SidebarMenuButton
              aria-label="Connect and settings"
              className={cn(
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
          <SettingsHexIcon className="size-4" />
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
