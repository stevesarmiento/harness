import {
  createContext,
  use,
  useMemo,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";

import { cn } from "~/lib/utils";

/**
 * Fork: the Forma meta row under the composer carries the composer's runtime
 * mode and context meter. The row mounts the slot element; the composer
 * portals into it and falls back to its own footer when no row is mounted.
 */
interface ComposerMetaSlotState {
  readonly element: HTMLDivElement | null;
  readonly setElement: Dispatch<SetStateAction<HTMLDivElement | null>>;
}

const ComposerMetaSlotContext = createContext<ComposerMetaSlotState | null>(null);

/** The meta row's trailing slot element, or null when no meta row is mounted. */
export function useComposerMetaSlotElement(): HTMLDivElement | null {
  return use(ComposerMetaSlotContext)?.element ?? null;
}

/** Ref callback for the meta row's trailing slot; undefined outside a composer shell. */
export function useComposerMetaSlotRef():
  | Dispatch<SetStateAction<HTMLDivElement | null>>
  | undefined {
  return use(ComposerMetaSlotContext)?.setElement;
}

// Fork: Forma paints the composer as one opaque surface (`.chat-composer-surface`)
// with a plain meta row below it, so the shell carries no shared glass backdrop.
// The glass custom properties stay defined because attached banners read them.
function Shell({
  contextStrip = false,
  className,
  ...props
}: ComponentProps<"div"> & { contextStrip?: boolean }) {
  const [metaSlotElement, setMetaSlotElement] = useState<HTMLDivElement | null>(null);
  const metaSlot = useMemo(
    () => ({ element: metaSlotElement, setElement: setMetaSlotElement }),
    [metaSlotElement],
  );
  return (
    <ComposerMetaSlotContext value={metaSlot}>
      <div
        data-slot="composer-shell"
        data-with-context={contextStrip || undefined}
        className={cn(
          "@container/composer-surface group/composer-surface relative isolate mx-auto w-full max-w-(--chat-content-max-width)",
          "[--chat-composer-drawer-inset:1.375rem] [--chat-composer-glass-surface:var(--card)] [--chat-composer-outline:var(--composer-banner-border)]",
          "dark:[--chat-composer-glass-surface:var(--surface-raised)]",
          className,
        )}
        {...props}
      />
    </ComposerMetaSlotContext>
  );
}

function Host({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="composer-host" className={cn("relative z-10 w-full", className)} {...props} />
  );
}

function Main({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-chat-composer-main-surface="true"
      className={cn(
        "group relative z-10 rounded-3xl p-px transition-colors duration-(--motion-duration-ui) ease-(--motion-ease-out) motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

/** Forma's meta row: environment, workspace and branch on the left, run settings on the right. */
function ContextStrip({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-context-strip"
      data-composer-meta-bar="true"
      className={cn(
        "group/composer-context relative mx-auto mt-1 flex w-full items-center gap-x-3 gap-y-1 overflow-x-clip overflow-y-visible px-0.5",
        className,
      )}
      {...props}
    />
  );
}

export const ComposerSurface = { Shell, Host, Main, ContextStrip };
