import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/utils";

const PILL_CLASS_NAME =
  "inline-flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground";
const INTERACTIVE_PILL_CLASS_NAME =
  "cursor-pointer transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [-webkit-app-region:no-drag]";

/**
 * Uniform route label for workspace headers that lack the project breadcrumb
 * (home, onboarding, settings). Renders as a flat pill matching the
 * breadcrumb chips and right-panel surface tabs; pass onClick to make it a
 * trigger with the same hover treatment as the breadcrumb pills.
 */
export function WorkspaceHeaderTitle({
  icon,
  children,
  className,
  onClick,
  ...buttonProps
}: {
  icon: ReactNode;
  children: string;
  className?: string;
  onClick?: () => void;
} & Omit<ComponentProps<"button">, "children" | "className" | "onClick">) {
  if (onClick) {
    return (
      <button
        type="button"
        className={cn(PILL_CLASS_NAME, INTERACTIVE_PILL_CLASS_NAME, className)}
        onClick={onClick}
        {...buttonProps}
      >
        {icon}
        <span className="min-w-0 truncate">{children}</span>
      </button>
    );
  }
  return (
    <span className={cn(PILL_CLASS_NAME, className)}>
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
