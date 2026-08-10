import { IconArrowTurnUpLeft as Undo2Icon, IconInfoCircle as InfoIcon } from "symbols-react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  createContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface SettingsSearchTargetContextValue {
  readonly targetId: string | null;
  readonly onTargetHandled: () => void;
}

const noop = () => undefined;
const SettingsSearchTargetContext = createContext<SettingsSearchTargetContextValue>({
  targetId: null,
  onTargetHandled: noop,
});

export function SettingsSearchTargetProvider({
  targetId,
  onTargetHandled = noop,
  children,
}: {
  targetId: string | null;
  onTargetHandled?: () => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ targetId, onTargetHandled }), [onTargetHandled, targetId]);
  return <SettingsSearchTargetContext value={value}>{children}</SettingsSearchTargetContext>;
}

function scrollAndFocusSettingsTarget(target: HTMLElement): void {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollTarget =
    target.tagName === "SECTION" && target.firstElementChild
      ? (target.firstElementChild as HTMLElement)
      : target;

  scrollTarget.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });
  target.focus({ preventScroll: true });
  target.classList.remove("settings-search-target-pulse");
  if (prefersReducedMotion) return;
  void target.offsetWidth;
  target.classList.add("settings-search-target-pulse");
  // The class also suppresses the focus outline (the pulse is the destination
  // indicator), so drop it once the element is no longer the destination.
  target.addEventListener("blur", () => target.classList.remove("settings-search-target-pulse"), {
    once: true,
  });
}

/** The row id a settings-search jump is currently trying to reach, if any. */
export function useSettingsSearchTargetId(): string | null {
  return useContext(SettingsSearchTargetContext).targetId;
}

function useSettingsSearchTarget<T extends HTMLElement>(id: string | undefined) {
  const { targetId, onTargetHandled } = useContext(SettingsSearchTargetContext);
  const isSearchTarget = id !== undefined && id === targetId;
  const targetRef = useCallback(
    (target: T | null) => {
      if (target && isSearchTarget) {
        scrollAndFocusSettingsTarget(target);
        onTargetHandled();
      }
    },
    [isSearchTarget, onTargetHandled],
  );

  return targetRef;
}

/** Info affordance explaining how a setting interacts with the shared background policy. */
export function PolicyTooltip({ children }: { readonly children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label="Background policy details"
          >
            <InfoIcon className="size-3.5" />
          </button>
        }
      />
      <TooltipPopup side="top" className="max-w-72">
        {children}
      </TooltipPopup>
    </Tooltip>
  );
}

/** Re-render every `intervalMs`; return a stable timestamp snapshot for render-time relative labels. */
export function useRelativeTimeTick(intervalMs = 1_000) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return nowMs;
}

export function SettingsSection({
  title,
  icon,
  headerAction,
  children,
  className,
  ...sectionProps
}: ComponentPropsWithoutRef<"section"> & {
  title: string;
  icon?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const targetRef = useSettingsSearchTarget<HTMLElement>(sectionProps.id);

  return (
    <section
      {...sectionProps}
      ref={targetRef}
      tabIndex={sectionProps.id ? -1 : sectionProps.tabIndex}
      className={cn("space-y-2.5", className)}
    >
      <div className="flex min-h-8 items-center justify-between gap-4 px-1">
        <h2 className="text-ui-xs flex items-center gap-2 font-semibold uppercase tracking-[0.08em] text-foreground/50">
          <span aria-hidden className="inline-block h-px w-3 bg-border" />
          {icon}
          {title}
        </h2>
        {headerAction}
      </div>
      <div className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm/4 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:shadow-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
  className,
  ...rowProps
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
}) {
  const targetRef = useSettingsSearchTarget<HTMLDivElement>(rowProps.id);

  return (
    <div
      {...rowProps}
      ref={targetRef}
      tabIndex={rowProps.id ? -1 : rowProps.tabIndex}
      className={cn(
        "border-t border-border/60 px-4 first:border-t-0 sm:px-5",
        children ? "pt-4 pb-0" : "py-4",
        className,
      )}
    >
      <SettingsRowBody
        control={control}
        description={description}
        resetAction={resetAction}
        status={status}
        title={title}
      />
      {children}
    </div>
  );
}

function SettingsRowBody({
  title,
  description,
  status,
  resetAction,
  control,
}: {
  title: ReactNode;
  description: ReactNode;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-h-5 items-center gap-1.5">
          <h3 className="text-ui-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
            {resetAction}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground/80">{description}</p>
        {status ? <div className="text-ui-xs pt-0.5 text-muted-foreground">{status}</div> : null}
      </div>
      {control ? (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
          {control}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsSubRows({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 -mx-4 sm:-mx-5" data-settings-subrows>
      {children}
    </div>
  );
}

export function SettingsSubRow({
  title,
  description,
  status,
  control,
}: {
  title: ReactNode;
  description: ReactNode;
  status?: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="border-t border-border/60 px-4 py-4 sm:px-5" data-settings-subrow>
      <SettingsRowBody control={control} description={description} status={status} title={title} />
    </div>
  );
}

export function SettingResetButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            disabled={disabled}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">Reset to default</TooltipPopup>
    </Tooltip>
  );
}

export function SettingsPageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });
  const targetId = hash.replace(/^#/, "") || null;
  const clearTargetHash = useCallback(() => {
    void navigate({ hash: "", replace: true, resetScroll: false, hashScrollIntoView: false });
  }, [navigate]);

  return (
    <SettingsSearchTargetProvider targetId={targetId} onTargetHandled={clearTargetHash}>
      <div className="settings-page-scroll-fade scrollbar-gutter-both flex-1 overflow-y-auto px-4 pt-10 pb-7 sm:px-8 sm:pt-12 sm:pb-10">
        <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-8", className)}>
          {children}
        </div>
      </div>
    </SettingsSearchTargetProvider>
  );
}

export function scrollToSettingsTarget(targetId: string): boolean {
  const target = document.getElementById(targetId);
  if (!target) return false;
  scrollAndFocusSettingsTarget(target);
  return true;
}
