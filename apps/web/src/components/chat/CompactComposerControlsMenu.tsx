import { ProviderInteractionMode, RuntimeMode } from "@t3tools/contracts";
import { memo, useRef } from "react";
import { IconEllipsis as EllipsisIcon } from "symbols-react";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { cn } from "~/lib/utils";
import { ComposerControl } from "./ComposerControl";
import { composerInteractionModeConfig } from "./composerInteractionMode";
import { focusRequestedPermission, useComposerMenuProps } from "./composerEventScope";
import { useComposerMenuState } from "./useComposerMenuState";
import { ComposerPermissionsSection, type RuntimeModeOption } from "./ComposerFooterControls";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  runtimeModeOptions: ReadonlyArray<RuntimeModeOption>;
  showInteractionModeToggle: boolean;
  showPermissions?: boolean;
  size?: "sm" | "xs";
  /** Close the portaled popup when its trigger hides. */
  hidden?: boolean;
  onToggleInteractionMode: () => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const composerFloatingLayerProps = useComposerMenuProps();
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const interactionModeDescription =
    composerInteractionModeConfig[props.interactionMode].description;
  const BuildModeIcon = composerInteractionModeConfig.default.icon;
  const PlanModeIcon = composerInteractionModeConfig.plan.icon;

  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => focusRequestedPermission(isOpen, triggerRef.current)}
    >
      <MenuTrigger
        render={
          <ComposerControl
            ref={triggerRef}
            size={size}
            className="shrink-0"
            aria-label="More composer controls"
            data-composer-shortcut={props.showPermissions !== false ? "composer.mode" : undefined}
          />
        }
      >
        {/* Fork: symbols-react icons don't fit ComposerControlIcon's SVGProps type. */}
        <EllipsisIcon
          aria-hidden="true"
          className={cn("shrink-0 fill-current", size === "xs" ? "size-3" : "size-4")}
          data-composer-control-icon
        />
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        {props.showInteractionModeToggle ? (
          <>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
            {/* Fork: Forma names the modes Build/Plan with their icons and a description. */}
            <div className="px-2 pb-1 text-xs text-muted-foreground/70">
              {interactionModeDescription}
            </div>
            <MenuRadioGroup
              value={props.interactionMode}
              onValueChange={(value) => {
                if (!value || value === props.interactionMode) return;
                props.onToggleInteractionMode();
              }}
            >
              <MenuRadioItem value="default">
                <BuildModeIcon className="size-3.5 fill-current" />
                {composerInteractionModeConfig.default.label}
              </MenuRadioItem>
              <MenuRadioItem value="plan">
                <PlanModeIcon className="size-3.5 fill-current" />
                {composerInteractionModeConfig.plan.label}
              </MenuRadioItem>
            </MenuRadioGroup>
            {props.showPermissions !== false ? <MenuDivider /> : null}
          </>
        ) : null}
        {props.showPermissions === false ? null : (
          <ComposerPermissionsSection
            runtimeMode={props.runtimeMode}
            runtimeModeOptions={props.runtimeModeOptions}
            onRuntimeModeChange={props.onRuntimeModeChange}
          />
        )}
      </MenuPopup>
    </Menu>
  );
});
