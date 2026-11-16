import type { RuntimeMode } from "@t3tools/contracts";
import { useRef } from "react";

import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ComposerControl, ComposerControlChevron, ComposerControlIcon } from "./ComposerControl";
import { focusRequestedPermission, useComposerMenuProps } from "./composerEventScope";
import { ComposerPermissionsSection, type RuntimeModeOption } from "./ComposerFooterControls";
import { runtimeModeConfig } from "./runtimeModeConfig";

const supervisedRuntimeModeOption: RuntimeModeOption = {
  mode: "approval-required",
  ...runtimeModeConfig["approval-required"],
};

// Fork: Forma's meta row names the access mode under the composer; the popup is
// upstream's Permissions section so the behaviour matches the model picker's footer.
export function ComposerRuntimeModeControl(props: {
  runtimeMode: RuntimeMode;
  options: ReadonlyArray<RuntimeModeOption>;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}) {
  const composerMenuProps = useComposerMenuProps();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected =
    props.options.find((option) => option.mode === props.runtimeMode) ??
    supervisedRuntimeModeOption;
  return (
    <Menu onOpenChangeComplete={(open) => focusRequestedPermission(open, triggerRef.current)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <ComposerControl
                  ref={triggerRef}
                  size="xs"
                  className="min-w-0 shrink-0"
                  aria-label={`Access mode: ${selected.label}`}
                  data-composer-context-control
                  data-composer-runtime-mode={props.runtimeMode}
                />
              }
            />
          }
        >
          <ComposerControlIcon icon={selected.icon} size="xs" />
          <span data-composer-control-label>{selected.label}</span>
          <ComposerControlChevron size="xs" />
        </TooltipTrigger>
        <TooltipPopup side="top">{selected.description}</TooltipPopup>
      </Tooltip>
      <MenuPopup side="top" align="end" {...composerMenuProps}>
        <ComposerPermissionsSection
          runtimeMode={props.runtimeMode}
          runtimeModeOptions={props.options}
          onRuntimeModeChange={props.onRuntimeModeChange}
        />
      </MenuPopup>
    </Menu>
  );
}
