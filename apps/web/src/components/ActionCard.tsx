import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Button } from "./ui/button";

const ACTION_CARD_CLASS_NAME =
  "relative isolate h-auto min-h-[11.5rem] w-full overflow-hidden rounded-[20px] border-border/60 bg-background px-5 py-5 text-left whitespace-normal shadow-sm shadow-black/5 transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out before:rounded-[19px] hover:-translate-y-0.5 hover:border-border/85 hover:bg-accent/16 hover:shadow-md hover:ring-4 hover:ring-foreground/5 hover:ring-offset-4 hover:ring-offset-background active:translate-y-0 active:scale-[0.985] active:shadow-sm";

interface ActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  testId?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ActionCard({
  title,
  description,
  icon,
  testId,
  disabled = false,
  className,
  onClick,
}: ActionCardProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xl"
      data-testid={testId}
      aria-disabled={disabled || undefined}
      className={cn(
        ACTION_CARD_CLASS_NAME,
        disabled &&
          "cursor-not-allowed opacity-40 hover:translate-y-0 hover:border-border/60 hover:bg-background hover:shadow-sm hover:ring-0 hover:ring-offset-0 active:scale-100",
        className,
      )}
      onClick={disabled ? undefined : onClick}
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
