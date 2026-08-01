import { useClerk, useUser } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { CloudIcon, LogInIcon, LogOutIcon, SmartphoneIcon, UserRoundIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { resolveCloudPublicConfigState } from "../../cloud/publicConfig";
import { useCloudLinkController } from "../../cloud/useCloudLinkController";
import { cn } from "../../lib/utils";
import { SettingsHexIcon } from "../icons/custom";
import { Dialog, DialogPopup } from "../ui/dialog";
import { Menu, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../ui/sidebar";
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

interface SidebarAccountInfo {
  readonly name: string;
  readonly email: string | null;
  readonly imageUrl: string | null;
  readonly onManageAccount: () => void;
  readonly onSignOut: () => void;
}

interface SidebarConnectStatus {
  readonly label: string;
  readonly tone: T3ConnectSidebarStatusTone;
  readonly hint: string | null;
  readonly disabled?: boolean;
}

/**
 * Bottom-of-sidebar account row. Always a single profile-style row whose menu
 * carries the T3 Connect status, Settings, and — depending on the Clerk
 * session — either the account actions or a sign-in item.
 */
export function SidebarAccountControl({ variant }: { readonly variant: SidebarAccountVariant }) {
  const configState = resolveCloudPublicConfigState();
  if (!configState.configured) {
    const diagnostic = import.meta.env.DEV
      ? `Missing ${configState.missingKeys.join(", ")}`
      : "See build diagnostics";
    return (
      <SidebarAccountMenuView
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
  const clerk = useClerk();
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
      ? {
          email,
          imageUrl: user?.imageUrl ?? null,
          name: user?.fullName ?? user?.username ?? email ?? "Account",
          onManageAccount: () => clerk.openUserProfile(),
          onSignOut: () => void clerk.signOut(),
        }
      : null;

  return (
    <SidebarAccountMenuView
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

function SidebarAccountMenuView({
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
  const [mobileClientsOpen, setMobileClientsOpen] = useState(false);

  const navigateTo = useCallback(
    (to: "/settings" | "/settings/connections") => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to });
    },
    [isMobile, navigate, setOpenMobile],
  );

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <Menu>
            <MenuTrigger
              render={
                <SidebarMenuButton
                  className={cn(
                    "gap-2 px-2 py-1.5",
                    variant === "v1" &&
                      "text-muted-foreground/70 hover:bg-accent hover:text-foreground",
                  )}
                  data-testid="sidebar-account-menu-trigger"
                  size={variant === "v1" ? "sm" : "default"}
                  title={connect.hint ?? `T3 Connect: ${connect.label}`}
                />
              }
            >
              {account?.imageUrl ? (
                <img
                  alt=""
                  className="size-5 shrink-0 rounded-full"
                  referrerPolicy="no-referrer"
                  src={account.imageUrl}
                />
              ) : (
                <UserRoundIcon className="size-3.5" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">{account?.name ?? "Account"}</span>
              <span
                aria-hidden="true"
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASSNAME[connect.tone])}
              />
            </MenuTrigger>
            <MenuPopup align="start" className="w-60" side="top" sideOffset={6}>
              {account ? (
                <>
                  <MenuGroupLabel>
                    <span className="block truncate">{account.name}</span>
                    {account.email && account.email !== account.name ? (
                      <span className="block truncate font-normal text-muted-foreground/80">
                        {account.email}
                      </span>
                    ) : null}
                  </MenuGroupLabel>
                  <MenuSeparator />
                </>
              ) : null}
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
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      STATUS_DOT_CLASSNAME[connect.tone],
                    )}
                  />
                  {connect.label}
                </span>
              </MenuItem>
              {account ? (
                <MenuItem onClick={() => setMobileClientsOpen(true)}>
                  <SmartphoneIcon />
                  Mobile clients
                </MenuItem>
              ) : null}
              <MenuItem onClick={() => navigateTo("/settings")}>
                <SettingsHexIcon />
                Settings
              </MenuItem>
              {account ? (
                <>
                  <MenuSeparator />
                  <MenuItem onClick={account.onManageAccount}>
                    <UserRoundIcon />
                    Manage account
                  </MenuItem>
                  <MenuItem onClick={account.onSignOut}>
                    <LogOutIcon />
                    Sign out
                  </MenuItem>
                </>
              ) : onSignIn ? (
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
        </SidebarMenuItem>
      </SidebarMenu>
      {account ? (
        <Dialog onOpenChange={setMobileClientsOpen} open={mobileClientsOpen}>
          <DialogPopup className="max-w-xl overflow-hidden sm:[&_header]:pe-12">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MobileClientsUserProfilePage />
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}
    </>
  );
}
