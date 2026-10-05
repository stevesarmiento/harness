/**
 * The sidebar header: a search pill above a label row holding project scope,
 * new project and new thread.
 *
 * Fork: Forma's legacy-style layout. Search is a bordered pill on the accent
 * surface; the controls sit in a compact label row whose label names the
 * current scope ("Projects" or the scoped project), so the scope icon can
 * stay Forma's filter mark instead of swapping to the project favicon.
 *
 * The scope picker itself is passed in: its combobox state lives with the rest
 * of the sidebar's scope logic. `scopeAnchorRef` lands on the label row so the
 * picker's popup can anchor to that width rather than to its small trigger.
 */
import { PlusIcon, XIcon } from "lucide-react";
import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { IconMagnifyingglass as SearchIcon } from "symbols-react";

import { NewThreadIcon } from "../icons/custom";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface SidebarThreadHeaderProps {
  /** Lands on the label row so the scope popup can anchor to its width. */
  scopeAnchorRef?: RefObject<HTMLDivElement | null>;
  /** Names the current scope: the scoped project, or "Projects". */
  scopeLabel: string;
  /** Without projects there is nothing to scope, so those controls stay out. */
  hasProjects: boolean;
  /** The project scope combobox, rendered as the first icon of the group. */
  projectScope: ReactNode;
  onNewProject: () => void;
  /** Receives the click so Shift+click can skip the project picker. */
  onNewThread: (event: ReactMouseEvent) => void;
  newThreadDisabled: boolean;
  newThreadShortcutLabel: string | null | undefined;
  newThreadInProjectShortcutLabel: string | null | undefined;
  /** Shift+click only matters once there is more than one project to pick. */
  showNewThreadInProjectHint: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  isSearching: boolean;
  searchResultCount: number;
  activeSearchResultIndex: number;
  onClearSearch: () => void;
}

export function SidebarThreadHeader({
  scopeAnchorRef,
  scopeLabel,
  hasProjects,
  projectScope,
  onNewProject,
  onNewThread,
  newThreadDisabled,
  newThreadShortcutLabel,
  newThreadInProjectShortcutLabel,
  showNewThreadInProjectHint,
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  onSearchKeyDown,
  isSearching,
  searchResultCount,
  activeSearchResultIndex,
  onClearSearch,
}: SidebarThreadHeaderProps) {
  const resultsVisible = isSearching && searchResultCount > 0;
  // Results shrink as the query narrows, so the active index can outrun the
  // list; pointing aria-activedescendant at a removed option strands the
  // screen reader on nothing.
  const activeResultExists = resultsVisible && activeSearchResultIndex < searchResultCount;
  const newThreadLabel = newThreadShortcutLabel
    ? `New thread (${newThreadShortcutLabel})`
    : "New thread";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-9 min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-accent/70 px-2.5 py-1.5 text-muted-foreground/70 shadow-sm/5 transition-colors focus-within:border-border hover:bg-accent/85 hover:text-foreground">
        <SearchIcon aria-hidden className="size-3.5 shrink-0 fill-current" />
        {/* A plain input: the pill owns the field chrome, and the sidebar
            input's text-sm would outsize Forma's text-xs search. */}
        <input
          ref={searchInputRef}
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search"
          aria-label="Search threads"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={resultsVisible}
          aria-controls={resultsVisible ? "sidebar-thread-search-results" : undefined}
          aria-activedescendant={
            activeResultExists
              ? `sidebar-thread-search-result-${activeSearchResultIndex}`
              : undefined
          }
          className="min-w-0 flex-1 bg-transparent p-0 text-xs font-medium leading-normal text-sidebar-foreground outline-none placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {isSearching ? (
          <Button
            type="button"
            size="icon-micro"
            variant="ghost-muted"
            className="shrink-0"
            aria-label="Clear thread search"
            onClick={() => {
              onClearSearch();
              searchInputRef.current?.focus();
            }}
          >
            <XIcon className="size-3" />
          </Button>
        ) : null}
      </div>
      <div ref={scopeAnchorRef} className="mt-1 flex items-center justify-between gap-2 pl-2 pr-1">
        <span className="min-w-0 truncate text-ui-2xs font-medium uppercase tracking-wider text-muted-foreground/60">
          {scopeLabel}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {hasProjects ? (
            <>
              {projectScope}
              <SidebarHeaderIconButton label="Add project" onClick={onNewProject}>
                <PlusIcon className="size-3.5" />
              </SidebarHeaderIconButton>
            </>
          ) : null}
          <SidebarHeaderIconButton
            label="New thread"
            tooltip={
              showNewThreadInProjectHint ? (
                <span className="flex flex-col gap-0.5">
                  <span>{newThreadLabel}</span>
                  <span className="text-muted-foreground">
                    New thread in current project: Shift+click
                    {newThreadInProjectShortcutLabel ? ` (${newThreadInProjectShortcutLabel})` : ""}
                  </span>
                </span>
              ) : (
                newThreadLabel
              )
            }
            disabled={newThreadDisabled}
            onClick={onNewThread}
          >
            <NewThreadIcon className="size-3.5" />
          </SidebarHeaderIconButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact icon button with a tooltip, sized for the header's label row. Spreads
 * unknown props through so it can serve as a popup trigger's render target,
 * which injects its own handlers, ref and aria state.
 *
 * Fork: Forma's compact size-5 ghost buttons (upstream: 28px sidebar menu
 * buttons); Button carries the coarse-pointer hit area itself.
 */
export function SidebarHeaderIconButton({
  label,
  tooltip = label,
  className,
  children,
  ...rest
}: {
  /** Accessible name; also the tooltip unless `tooltip` says more. */
  label: string;
  tooltip?: ReactNode;
  className?: string | undefined;
  children?: ReactNode;
} & Omit<
  ComponentProps<typeof Button>,
  "children" | "className" | "aria-label" | "size" | "variant"
>) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-micro"
            variant="ghost-muted"
            type="button"
            aria-label={label}
            {...rest}
            className={className}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup side="top">{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
