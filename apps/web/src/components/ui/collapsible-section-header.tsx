import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const tones = {
  muted: { label: "text-sidebar-muted-foreground", line: "bg-sidebar-border/50" },
  // Fork: the Forma sidebar's snoozed shelves.
  info: { label: "text-blue-600 dark:text-blue-400", line: "bg-blue-500/20 dark:bg-blue-400/15" },
  emphasized: { label: "text-sidebar-foreground/80", line: "bg-sidebar-foreground/25" },
  accent: { label: "text-primary", line: "bg-primary/50" },
} as const;

export function CollapsibleSectionHeader({
  children,
  expanded,
  tone = "muted",
  variant = "default",
  accessory,
  ...buttonProps
}: Omit<ComponentProps<"button">, "className" | "style" | "aria-expanded"> & {
  expanded: boolean;
  tone?: keyof typeof tones;
  // Fork: `sidebar` is the Forma sidebar's shelf look (quieter muted tone,
  // chevron flips when collapsed).
  variant?: "default" | "panel" | "sidebar";
  accessory?: ReactNode;
}) {
  return (
    <button
      {...buttonProps}
      type="button"
      aria-expanded={expanded}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
        variant === "panel" ? "ps-2 pe-2.5" : "px-2",
        variant === "sidebar" && tone === "muted"
          ? "text-sidebar-muted-foreground/60"
          : tones[tone].label,
      )}
    >
      <span className="shrink-0">{children}</span>
      <span
        aria-hidden
        // A header with a trailing count drops its rule so it doesn't read as a leader.
        className={cn(
          "h-px min-w-2 flex-1",
          variant === "sidebar" && tone === "muted" ? "bg-sidebar-border/60" : tones[tone].line,
          accessory && "invisible",
        )}
      />
      {accessory}
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0 transition-transform",
          !expanded && (variant === "sidebar" ? "rotate-180" : "-rotate-90"),
        )}
      />
    </button>
  );
}

export function SectionHeaderStatus({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-3xs leading-none text-destructive-foreground">{children}</span>
  );
}
