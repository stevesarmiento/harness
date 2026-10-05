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
`git grep -nE "themePalette|vscodeThemeImport|useCustomThemes|ThemeEditor|ThemeLibrary" -- apps/web/src`
must return nothing.

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

## Upstream chrome/composer/header layout rewrites — Forma look on upstream behaviour

Recurring conflict areas where upstream keeps iterating its own layout while
the fork has an equivalent Forma look. Since orchestration V2 these files are
data-coupled to V2, so the policy is: **upstream's file and behaviour win,
Forma's look is re-applied on top** (fix-forward commits after the merge):

- `ChatView.tsx` top bar / right-panel layout (fork: workspace chrome +
  inset card + breadcrumb tab strip)
- `ChatComposer.tsx` footer + `ComposerFooterModeControls` (fork:
  `ComposerMetaBar` + `ComposerRuntimeModeControl` +
  `ComposerInteractionModePill`)
- `ComposerPrimaryActions.tsx` send/stop buttons (fork design)
- `ChatHeader.tsx` thread-title actions (fork's `ThreadTitleMenu` predates
  upstream's #5592 equivalent)
- `MessagesTimeline.tsx` user-message cards and the `PixelGridLoader`
  working indicator
- lucide-icon → `symbols-react` swaps and Forma font-scale tokens
  (`text-ui-*`, `text-code-*`) throughout

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
  `git.listOpenPullRequests`, app icons, thread cleanup, Markdown export and
  fork actions (rebuilt on V2 in `useThreadActions`).
- **Migration ledger**: fork migrations 935–941 stay registered (live databases
  recorded them) even where their tables are now unused. `backfillSkippedMigrations`
  runs after upstream's `reconcileV2PreviewMigration` so upstream 041+ apply on
  Forma ledgers whose high-water mark is 941. Upstream logs legacy fork ids
  26–31 as "divergent" on old databases; 938/941 already reconcile those, so
  the warning is expected.
- **Data**: V2 copies `~/.forma/userdata/state.sqlite` once into
  `statev2.sqlite` and imports threads lazily; `state.sqlite` is left untouched.
- **Desktop identity**: Forma keeps its own Chromium profiles (`forma-v2`,
  `forma-dev`; V1 import from `Forma (Alpha)`/`forma`) so it never shares the
  `t3code-v2` profile with an installed T3 Code. App name, bundle id and data
  dir stay Forma's; other internal identifiers follow upstream.
- **Defaults**: `legacySidebarEnabled` true, `composerCollapseOnScroll` false.
