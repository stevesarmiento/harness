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

import {
  PRIMARY_SETTINGS_UNAVAILABLE_MESSAGE,
  usePrimarySettingsAvailable,
} from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { WorkspacePageContainer, type WorkspacePageWidth } from "../WorkspacePageContainer";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

declare module "@tanstack/react-router" {
  interface HistoryState {
    settingsTargetHighlight?: boolean;
  }
}

interface SettingsSearchTargetContextValue {
  readonly targetId: string | null;
  readonly highlightTarget: boolean;
  readonly onTargetHandled: () => void;
}

const noop = () => undefined;
const SettingsSearchTargetContext = createContext<SettingsSearchTargetContextValue>({
  targetId: null,
  highlightTarget: true,
  onTargetHandled: noop,
});

export function SettingsSearchTargetProvider({
  targetId,
  highlightTarget = true,
  onTargetHandled = noop,
  children,
}: {
  targetId: string | null;
  highlightTarget?: boolean;
  onTargetHandled?: () => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ targetId, highlightTarget, onTargetHandled }),
    [highlightTarget, onTargetHandled, targetId],
  );
  return <SettingsSearchTargetContext value={value}>{children}</SettingsSearchTargetContext>;
}

function scrollAndFocusSettingsTarget(target: HTMLElement, highlight = true): void {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const markedScrollTarget =
    typeof target.querySelector === "function"
      ? target.querySelector<HTMLElement>(":scope > [data-settings-scroll-target]")
      : null;
  const scrollTarget =
    markedScrollTarget ??
    (target.tagName === "SECTION" && target.firstElementChild
      ? (target.firstElementChild as HTMLElement)
      : target);

  scrollTarget.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });
  target.focus({ preventScroll: true });
  target.classList.remove("settings-search-target-pulse");
  if (!highlight || prefersReducedMotion) return;
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

export function useSettingsSearchTarget<T extends HTMLElement>(id: string | undefined) {
  const { targetId, highlightTarget, onTargetHandled } = useContext(SettingsSearchTargetContext);
  const isSearchTarget = id !== undefined && id === targetId;
  const targetRef = useCallback(
    (target: T | null) => {
      if (target && isSearchTarget) {
        scrollAndFocusSettingsTarget(target, highlightTarget);
        onTargetHandled();
      }
    },
    [highlightTarget, isSearchTarget, onTargetHandled],
  );

  return targetRef;
}

export function SettingsSearchTarget({
  children,
  ...targetProps
}: ComponentPropsWithoutRef<"div">) {
  const targetRef = useSettingsSearchTarget<HTMLDivElement>(targetProps.id);
  return (
    <div {...targetProps} ref={targetRef} tabIndex={targetProps.id ? -1 : targetProps.tabIndex}>
      {children}
    </div>
  );
}

/**
 * Trigger classes for the composer model/traits pickers when they sit in a
 * settings row: match the `sm` control box (the composer pins them to 28px at
 * every breakpoint) and drop the composer's max-width.
 */
export const SETTINGS_PICKER_TRIGGER_CLASSNAME =
  "h-8 min-h-8 min-w-0 max-w-none shrink-0 text-foreground/90 hover:text-foreground sm:h-7 sm:min-h-7";

/** Info affordance explaining how a setting interacts with the shared background policy. */
export function PolicyTooltip({ children }: { readonly children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={200}
        render={
          <Button size="icon-micro" variant="ghost-muted" aria-label="Background policy details">
            <InfoIcon className="size-3.5" />
          </Button>
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
  description,
  hideTitle = false,
  icon,
  headerAction,
  variant = "grouped",
  children,
  className,
  ...sectionProps
}: ComponentPropsWithoutRef<"section"> & {
  title: string;
  description?: ReactNode;
  hideTitle?: boolean;
  icon?: ReactNode;
  headerAction?: ReactNode;
  variant?: "grouped" | "plain";
  children: ReactNode;
}) {
  const targetRef = useSettingsSearchTarget<HTMLElement>(sectionProps.id);

  return (
    <section
      {...sectionProps}
      ref={targetRef}
      tabIndex={sectionProps.id ? -1 : sectionProps.tabIndex}
      className={cn(!hideTitle && "space-y-2.5", className)}
    >
      {hideTitle ? (
        <h2 className="sr-only">{title}</h2>
      ) : (
        <div
          data-settings-scroll-target
          className="flex min-h-8 items-start justify-between gap-4 px-1"
        >
          <div className="min-w-0">
            <h2 className="text-ui-xs flex min-h-8 items-center gap-2 font-semibold uppercase tracking-[0.08em] text-foreground/50">
              <span aria-hidden className="inline-block h-px w-3 bg-border" />
              {icon}
              {title}
            </h2>
            {description ? (
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.45] text-muted-foreground/80">
                {description}
              </div>
            ) : null}
          </div>
          <div className="flex min-h-8 min-w-7 items-center justify-end">{headerAction}</div>
        </div>
      )}
      <div
        data-settings-scroll-target={hideTitle ? "" : undefined}
        className={cn(
          variant === "grouped"
            ? "relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm/4 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:shadow-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]"
            : "space-y-1",
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * One setting. `serverScoped` marks rows whose value lives in the primary
 * environment's settings.json; where there is no primary (the hosted app)
 * the control goes inert with a tooltip instead of showing an editable
 * default that would never save.
 *
 * Control sizing across settings follows three tiers so rows share a baseline:
 * - `control` slot: `size="sm"` (Button, Select, Input, NumberField) or `icon-sm`.
 * - Section `headerAction`s and buttons inside list items, cards, toolbars: `xs` / `icon-xs`.
 * - Inline affordances (reset arrows, info tooltips, table-cell buttons): `icon-micro`.
 * Dialog footers keep the app-wide default button size.
 */
export function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  serverScoped = false,
  children,
  className,
  ...rowProps
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  serverScoped?: boolean;
  children?: ReactNode;
}) {
  const targetRef = useSettingsSearchTarget<HTMLDivElement>(rowProps.id);
  const primarySettingsAvailable = usePrimarySettingsAvailable();
  const unavailable = serverScoped && !primarySettingsAvailable;
  const renderedReset = unavailable ? null : resetAction;
  const renderedControl =
    unavailable && control ? (
      <Tooltip>
        <TooltipTrigger
          render={
            // Focusable so keyboard users can still reach the explanation.
            <span
              tabIndex={0}
              className="flex w-full items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
            />
          }
        >
          <div inert className="flex w-full items-center gap-2 opacity-50 sm:w-auto">
            {control}
          </div>
        </TooltipTrigger>
        <TooltipPopup side="top" className="max-w-72">
          {PRIMARY_SETTINGS_UNAVAILABLE_MESSAGE}
        </TooltipPopup>
      </Tooltip>
    ) : (
      control
    );

  return (
    <div
      {...rowProps}
      ref={targetRef}
      tabIndex={rowProps.id ? -1 : rowProps.tabIndex}
      data-slot="settings-row"
      className={cn(
        "border-t border-border/60 px-4 first:border-t-0 sm:px-5",
        children ? "pt-4 pb-0" : "py-4",
        className,
      )}
    >
      <SettingsRowBody
        control={renderedControl}
        description={description}
        resetAction={renderedReset}
        status={status}
        title={title}
      />
      {unavailable && children ? (
        <div inert className="opacity-50">
          {children}
        </div>
      ) : (
        children
      )}
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
            size="icon-micro"
            variant="ghost-muted"
            aria-label={`Reset ${label} to default`}
            disabled={disabled}
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
  width = "readable",
}: {
  children: ReactNode;
  className?: string;
  width?: WorkspacePageWidth;
}) {
  const navigate = useNavigate();
  const hash = useLocation({ select: (location) => location.hash });
  const highlightTarget = useLocation({
    select: (location) => location.state.settingsTargetHighlight !== false,
  });
  const targetId = hash.replace(/^#/, "") || null;
  const clearTargetHash = useCallback(() => {
    void navigate({
      hash: "",
      replace: true,
      resetScroll: false,
      hashScrollIntoView: false,
      state: { settingsTargetHighlight: true },
    });
  }, [navigate]);

  return (
    <SettingsSearchTargetProvider
      targetId={targetId}
      highlightTarget={highlightTarget}
      onTargetHandled={clearTargetHash}
    >
      <div
        className="settings-page-scroll-fade scrollbar-gutter-both flex-1 overflow-y-auto"
        data-settings-page-scroll
      >
        <WorkspacePageContainer
          width={width}
          className={cn("gap-8 px-4 pt-10 pb-7 sm:px-8 sm:pt-12 sm:pb-10", className)}
        >
          {children}
        </WorkspacePageContainer>
      </div>
    </SettingsSearchTargetProvider>
  );
}

export function scrollToSettingsTarget(
  targetId: string,
  { highlight = true }: { readonly highlight?: boolean } = {},
): boolean {
  const target = document.getElementById(targetId);
  if (!target) return false;
  scrollAndFocusSettingsTarget(target, highlight);
  return true;
}
