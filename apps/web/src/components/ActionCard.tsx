import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Button } from "./ui/button";

interface ActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  testId?: string;
  className?: string;
  onClick?: () => void;
}

export function ActionCard({
  title,
  description,
  icon,
  testId,
  className,
  onClick,
}: ActionCardProps) {
  return (
    <Button
      type="button"
      variant="card"
      size="xl"
      data-testid={testId}
      className={cn(
        "relative isolate h-auto min-h-[11.5rem] w-full overflow-hidden text-left whitespace-normal hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985]",
        className,
      )}
      onClick={onClick}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 text-foreground/[0.06] opacity-70"
        style={{
          backgroundImage: "radial-gradient(currentColor 0.8px, transparent 0.8px)",
          backgroundSize: "12px 12px",
        }}
      />
      <span className="relative z-10 flex h-full w-full flex-col justify-between gap-2">
        <span className="inline-flex size-12 shrink-0">{icon}</span>
        <span className="flex min-h-[4.75rem] flex-col items-start gap-1.5">
          <span className="text-base font-semibold leading-6 text-foreground">{title}</span>
          <span className="max-w-[28ch] text-sm leading-6 text-muted-foreground/88">
            {description}
          </span>
        </span>
      </span>
    </Button>
  );
}
