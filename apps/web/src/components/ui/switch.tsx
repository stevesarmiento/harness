"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "~/lib/utils";

/**
 * `mixed` renders the thumb centred on a muted track for a selection whose
 * targets disagree (the macOS mixed-state convention). It is presentational:
 * the caller still decides what a click sets, usually on for everyone.
 */
function Switch({
  className,
  size = "default",
  mixed = false,
  ...props
}: SwitchPrimitive.Root.Props & { size?: "default" | "sm"; mixed?: boolean }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "inline-flex h-[calc(var(--thumb-size)+4px)] w-[calc(var(--thumb-size)*2+4px)] shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none transition-[background-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:cursor-not-allowed data-disabled:opacity-64 data-[mixed]:bg-input",
        size === "sm" ? "[--thumb-size:12px]" : "[--thumb-size:14px]",
        className,
      )}
      data-size={size}
      data-slot="switch"
      data-mixed={mixed ? "" : undefined}
      // Base UI copies every key we pass, even `undefined`, over its own
      // aria-checked. Only pass the attribute when mixed so the real state
      // survives for screen readers.
      {...(mixed ? { "aria-checked": "mixed" as const } : {})}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block aspect-square size-[var(--thumb-size)] origin-left rounded-(--thumb-size) bg-white shadow-sm/10 will-change-transform in-[[role=switch]:hover,[data-slot=label]:hover,[data-slot=field-label]:hover,[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:not-data-disabled:scale-x-115 in-[[role=switch]:hover,[data-slot=label]:hover,[data-slot=field-label]:hover,[role=switch]:active,[data-slot=label]:active,[data-slot=field-label]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.15)] [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s] data-checked:origin-[var(--thumb-size)_50%] data-checked:translate-x-[var(--thumb-size)]",
          mixed &&
            "translate-x-[calc(var(--thumb-size)/2)] opacity-70 data-checked:translate-x-[calc(var(--thumb-size)/2)]",
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
