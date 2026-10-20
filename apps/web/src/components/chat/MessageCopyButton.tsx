import { memo, useRef, type ComponentType } from "react";
import { IconCheckmark as CheckIcon } from "symbols-react";
import { Button } from "../ui/button";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import {
  ANCHORED_COPY_TOAST_TIMEOUT_MS,
  showAnchoredCopyErrorToast,
  showAnchoredCopySuccessToast,
} from "../ui/anchoredCopyToast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { MessageCopyIcon } from "../icons/custom";

export const MessageCopyButton = memo(function MessageCopyButton({
  text,
  label = "Copy message",
  icon: Icon = MessageCopyIcon,
  extraFlavors,
  size = "xs",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  icon?: ComponentType<{ className?: string }>;
  extraFlavors?: Readonly<Record<string, string>>;
  size?: "xs" | "icon-xs";
  /** "subtle" is Forma's quiet outline for message actions. */
  variant?: "outline" | "ghost" | "subtle";
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const { copyToClipboard, isCopied } = useCopyToClipboard<void>({
    onCopy: () => showAnchoredCopySuccessToast(ref),
    onError: (error: Error) => showAnchoredCopyErrorToast(ref, error),
    timeout: ANCHORED_COPY_TOAST_TIMEOUT_MS,
    ...(extraFlavors ? { extraFlavors } : {}),
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={isCopied}
            onClick={() => copyToClipboard(text)}
            ref={ref}
            type="button"
            size={size}
            variant={
              variant === "ghost"
                ? "ghost-muted"
                : variant === "subtle"
                  ? "subtle-outline"
                  : variant
            }
            className={className}
          />
        }
      >
        {isCopied ? (
          <CheckIcon className="size-3 fill-success text-success" />
        ) : (
          <Icon className="size-3 fill-current" />
        )}
      </TooltipTrigger>
      <TooltipPopup>
        <p>{label}</p>
      </TooltipPopup>
    </Tooltip>
  );
});
