# Deliberately skipped upstream work

Upstream changes this fork has intentionally rejected. When a future sync
re-presents conflicts in these areas, resolve them per the policy below
instead of re-deriving the decision. Companion to the `// Fork:` comment
convention used inside upstream files.

## Modular theme library (#5226, v0.0.32)

Upstream's theme engine (`apps/web/src/themePalette.ts`,
`vscodeThemeImport.ts`, `hooks/useCustomThemes.ts`,
`components/settings/Theme*.tsx`, `themeEditorStore`/`themeInspector`, the
`themeEditor.toggle` keybinding, the theme-boot script in `index.html`, and
the `html[data-theme-id]` token-mapping block in `index.css`). The fork has
its own theme system (`apps/web/src/theme.ts`, `themeBootstrap.ts`,
`interfaceAppearance.ts`) surfaced through the Forma Interface settings
panel.

**Resolution policy:** delete the theme-library web files, keep the fork side of
`hooks/useTheme.ts`, `index.html`, and `index.css`, and strip
theme-editor/keybinding/command-palette references. Gate:
`git grep -nE "themePalette\b|vscodeThemeImport|useCustomThemes|ThemeEditor|ThemeLibrary" -- apps/web/src`
must return nothing (imports of the kept shared `@t3tools/shared/themePalettes`
data plane, e.g. the standard palette for agent HTML renders, are allowed).

Since the V2 sync the theme library also lives outside the web app
(`packages/shared/src/themePalettes.ts`, server `environmentTheme.ts` and
`cli/theme.ts`, the `environmentThemes` capability). That data plane is
**kept**: the server needs it and released mobile clients consume it. Only
the web UI is excised, which is why the gate is scoped to `apps/web/src`.
Later theme-library web additions are excised the same way (`openVsxThemes`,
`useEnvironmentTheme`, `useDefaultTheme`, `ThemeSearchSection`, the
`ThemeEditorHost` mount in `__root.tsx`). Upstream's `index.html` boot script
for `data-theme-id` stays out; Forma's `themeBootstrap.ts` is the first import
of upstream's single `/src/bootstrap.ts` entry (a second module entry breaks
the bundled-dev React refresh preamble).

## Theme-aware sidebar artwork (#5636, v0.0.32)

Depends on the theme library (`getThemeDefinition` /
`getThemePreviewSidebarArtwork`). `useEnvironmentIdentificationMode` in
`apps/web/src/hooks/useSettings.ts` is simplified to skip the palette-theme
suppression logic.

## Sidebar v2 as default (#5672, v0.0.32) — partially adopted

The file rename was **adopted** (Forma sidebar now lives in
`LegacySidebar.tsx`; upstream's v2 owns `Sidebar.tsx`) so future merges
three-way cleanly. What is skipped is the default flip: the fork pins
`legacySidebarEnabled` to a decoding default of `true` in
`packages/contracts/src/settings.ts` and holds legacy during settings
hydration in `useLegacySidebarEnabled`, so the Forma sidebar remains the
default UI. Sidebar v2 stays available as an explicit opt-out in Settings →
Advanced → Legacy features. While collapsed, upstream's floating sidebar
trigger is shown except on pages whose Forma header mounts its own reopen
button (`AppSidebarLayout.tsx`).

Not yet ported onto v2 (opt-in surface only; the default Forma sidebar has
them): "Export as Markdown" and "Fork thread" context-menu items
(`buildThreadActionMenuItems`), and the fork's `NewThreadIcon`.

## Upstream design overhaul (#24865, #25778) — adopted except the sidebar

Since the 2026-10-27 sync, upstream's redesign is the only design and the fork
takes it for the composer, chat view, header, panels, timeline, Settings and
Usage. Settings and Usage are upstream's modals (#24847); Forma-only pages
(Safety, app icons, Interface appearance, Legacy features) live inside them.

The **sidebar** is the exception: `Sidebar.tsx`, `LegacySidebar.tsx`,
`sidebar/*` and `ui/sidebar.tsx` keep Forma's look and behaviour (grouped
projects with drag-reorder, shelves, compact rows, Forma status icons). Take
upstream's behaviour and performance fixes there, never its styling.

Forma features that survive the redesign and must be re-applied on top of
upstream rewrites: right-panel tabs in the header breadcrumb
(`RightPanelTabStrip`), the `PixelGridLoader` working row with no pulse,
project-local agents, file entry mutations and versioned saves, Markdown
export and fork actions.

## Theme-library follow-ups (v0.0.33) — same policy as #5226

Rejected in the v0.0.33 sync, all touching deleted theme-library files or the
excised `html[data-theme-id]` CSS block: #6000 built-in theme contrast (incl.
its 2-line `index.html` boot tweak), #6013 duplicate-theme action, #5964
theme button icons, #5928 restore-defaults after theme mix (its `themeHalves`
tracking), #5860 theme button styles, #5938 update-pill theme foregrounds.
The re-presented theme mapping block in `index.css` was rejected again.

Also of note from that sync: upstream centralized diff styling in
`components/diffs/StyledDiffCodeView.tsx` (`DIFF_VIEW_UNSAFE_CSS`); the Forma
diff palette now lives there as a `/* Fork: ... */` block instead of
`DiffPanel`'s old `DIFF_PANEL_UNSAFE_CSS` option.

## Mobile workspace exclusion (standing fork policy)

`apps/mobile` is excluded from the pnpm workspace (`!apps/mobile`). Since the
V2 sync, `pnpm-workspace.yaml` keeps upstream's `patchedDependencies` list
verbatim and sets `allowUnusedPatches: true` so the React Native patches with
no installed target don't fail installs. Don't hand-prune that list anymore.

## Orchestration V2 sync (#2829, synced 2026-10-05)

Upstream replaced the V1 orchestration layer (`apps/server/src/orchestration/`,
the V1 provider adapters, `Projection*` persistence, `contracts/orchestration.ts`)
with `apps/server/src/orchestration-v2/`. The fork adopted V2 wholesale.

- **Dropped fork features** (they were built on V1 services): Ask interaction
  mode (`/ask`, `askOverride`; V2 modes are `default` and `plan`), the component
  preview harness (server `componentPreview/`, web `ComponentPreviewPanel`),
  Forma thread extensions (turn queue + fork RPCs; V2's native queued runs and
  fork replace them), checkpoint diff blobs, and Forma thread-attention
  notifications (`desktopNotifyOn*`; upstream `notificationMode` replaces them).
- **Kept fork features**: protected paths (Settings → Safety), workspace entry
  create/rename/delete and versioned file writes, local agent inventory,
  app icons, thread cleanup, Markdown export and fork actions (rebuilt on V2
  in `useThreadActions`).
- **Migration ledger**: fork migrations 935–941 stay registered (live databases
  recorded them) even where their tables are now unused. `backfillSkippedMigrations`
  runs after upstream's `reconcileV2PreviewMigration` so upstream 041+ apply on
  Forma ledgers whose high-water mark is 941. Upstream logs legacy fork ids
  26–31 as "divergent" on old databases; 938/941 already reconcile those, so
  the warning is expected.
- **Migration id check** (#15925): upstream's `assertV2MigrationsCanRun` treats
  an unrecorded V2 id below the high-water mark as a clash. A Forma ledger's
  high-water mark is always 941, so the fork only fails on an id recorded under
  another name; unrecorded ids are left to `backfillSkippedMigrations`.
  Upstream 063 drops V1 projections, so 938 skips its 029 index replay once
  they are gone (fresh databases run 938 after 063).
- **Data**: V2 copies `~/.forma/userdata/state.sqlite` once into
  `statev2.sqlite` and imports threads lazily; `state.sqlite` is left untouched.
- **Desktop identity**: Forma keeps its own Chromium profiles (`forma-v2`,
  `forma-dev`; V1 import from `Forma (Alpha)`/`forma`) so it never shares the
  `t3code-v2` profile with an installed T3 Code. App name, bundle id and data
  dir stay Forma's; other internal identifiers follow upstream.
- **Defaults**: `legacySidebarEnabled` true, `composerCollapseOnScroll` false.

## Anonymous usage telemetry (#16564, synced 2026-10-07)

Upstream defaults `T3CODE_TELEMETRY_ENABLED` to on and reports to T3's
ingest endpoint; #16564 added an onboarding note and a Settings privacy-policy
row about it. Forma defaults telemetry **off** (`AnalyticsService.ts`, `// Fork:`)
and drops the onboarding note, the privacy row, its settings-search entry and
`legalLinks.ts`. Relay (T3 Connect) client tracing follows the same opt-in
(`isRelayTracingEnabled` in `packages/shared/src/otelEnvironment.ts`). Setting
`T3CODE_TELEMETRY_ENABLED=true` opts in to both.

Also from that sync: the fork-only `git.listOpenPullRequests` RPC was removed
(nothing called it after the V2 merge, and upstream moved `GitHubCli` to
GitHub's API).

## Alpha → Beta rename (#20032, skipped 2026-10-20)

Upstream renamed its product stage to Beta. Forma keeps "Forma (Alpha)"
(`apps/desktop/package.json` productName, the launcher display name, the
`DesktopEnvironment` stage label, `branding.ts`, `index.html`): renaming the
app renames the installed bundle. The contracts stage union includes Beta;
that is harmless.
