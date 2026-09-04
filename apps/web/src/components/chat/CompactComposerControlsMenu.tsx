import type {
  FormaInteractionMode,
  ServerProviderSupportedInteractionMode,
} from "@t3tools/contracts";
import { memo, type ReactNode } from "react";
import { IconEllipsis as EllipsisIcon } from "symbols-react";
import { Button } from "../ui/button";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { composerFloatingLayerProps } from "./composerEventScope";
import { composerInteractionModeConfig } from "./composerInteractionMode";
import { useComposerMenuState } from "./useComposerMenuState";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  interactionMode: FormaInteractionMode;
  supportedInteractionModes: ReadonlyArray<ServerProviderSupportedInteractionMode>;
  showInteractionModeToggle: boolean;
  traitsMenuContent?: ReactNode;
  size?: "sm" | "xs";
  /**
   * The resting strip keeps this menu mounted out of flow while every block
   * fits inline. Its portaled popup would outlive that transition, so an
   * open menu closes when its trigger hides.
   */
  hidden?: boolean;
  onInteractionModeChange: (mode: FormaInteractionMode) => void;
}) {
  const size = props.size ?? "sm";
  const [open, setOpen] = useComposerMenuState(props.hidden);
  const interactionModeDescription =
    composerInteractionModeConfig[props.interactionMode].description;
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={
          <Button
            size={size === "xs" ? "xs" : "sm"}
            variant="ghost"
            className="shrink-0 px-2 text-muted-foreground/70 hover:text-foreground/80"
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start" {...composerFloatingLayerProps}>
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            <MenuDivider />
          </>
        ) : null}
        {props.showInteractionModeToggle ? (
          <>
            <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
            <div className="px-2 pb-1 text-xs text-muted-foreground/70">
              {interactionModeDescription}
            </div>
            <MenuRadioGroup
              value={props.interactionMode}
              onValueChange={(value) => {
                if (!value || value === props.interactionMode) return;
                props.onInteractionModeChange(value as FormaInteractionMode);
              }}
            >
              <MenuRadioItem value="default">
                {(() => {
                  const Icon = composerInteractionModeConfig.default.icon;
                  return <Icon className="size-3.5 fill-current" />;
                })()}
                Build
              </MenuRadioItem>
              {props.supportedInteractionModes.includes("ask") ? (
                <MenuRadioItem value="ask">
                  {(() => {
                    const Icon = composerInteractionModeConfig.ask.icon;
                    return <Icon className="size-3.5 fill-current" />;
                  })()}
                  Ask
                </MenuRadioItem>
              ) : null}
              <MenuRadioItem value="plan">
                {(() => {
                  const Icon = composerInteractionModeConfig.plan.icon;
                  return <Icon className="size-3.5 fill-current" />;
                })()}
                Plan
              </MenuRadioItem>
            </MenuRadioGroup>
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
