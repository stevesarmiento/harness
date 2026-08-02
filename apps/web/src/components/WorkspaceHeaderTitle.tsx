import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Uniform route label for workspace headers that lack the project breadcrumb
 * (home, onboarding, settings). Renders as a non-interactive flat pill
 * matching the breadcrumb chips and right-panel surface tabs.
 */
export function WorkspaceHeaderTitle({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
