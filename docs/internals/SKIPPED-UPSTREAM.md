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

**Resolution policy:** delete the theme-library files, keep the fork side of
`hooks/useTheme.ts`, `index.html`, and `index.css`, and strip
theme-editor/keybinding/command-palette references. Gate:
`grep -rn "themePalette|vscodeThemeImport|useCustomThemes|ThemeEditor" apps packages`
must return nothing.

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
General → Legacy features.

Not yet ported onto v2 (opt-in surface only; the default Forma sidebar has
them): "Export as Markdown" and "Fork thread" context-menu items
(`buildThreadActionMenuItems`), and the fork's `NewThreadIcon`.

## Upstream chrome/composer/header layout rewrites — superseded by Forma

Recurring conflict areas where upstream keeps iterating its own layout while
the fork has an equivalent Forma implementation. Resolve by keeping the fork
side and porting only behavioral (non-visual) changes:

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

## Theme-as-file (#8569, v0.0.38 era) — same policy as #5226

An environment publishing themes as a file, plus its follow-ups. The web UI
side is excised: it is built on the excised `themePalette` engine
(`hooks/useDefaultTheme.ts`, `useEnvironmentTheme.ts`, the
`EnvironmentThemeSync` bridge in `__root.tsx`). The protocol data plane is
KEPT — `environmentThemes` is a server capability woven through
`packages/contracts` (rpc/server/environment), `packages/client-runtime`
(`serverConfigProjection`), `packages/shared`
(`themePalettes.ts`/`themePreview.ts`), and
`apps/server/src/environmentTheme.ts` + `cli/theme.ts` — and the released
upstream mobile app consumes it, so stripping it would fork the protocol.
The web client advertises the capability but never renders published themes.
Also rejected in the same sync: Open VSX theme search (#5654,
`openVsxThemes.ts`, `ThemeSearchSection.tsx`), OKLCH theme palettes (#6036),
and the `clerkAppearance.test.ts` themePalette contrast test (the
CSS-variable `clerkAppearance.ts` component itself is kept).

**Resolution policy:** delete the web hook/UI files on sight and the
`__root.tsx` sync bridge; keep server/contracts/client-runtime/shared theme
plumbing on the upstream side; keep the `defaultTheme`/`defaultThemeSetAt`
contract keys.

## Resting/collapsing composer (#7855 family, v0.0.38 era)

Upstream's composer collapses to a resting state on blur and scroll
(#7855, #9469, #9482, #9490, #9492, #9498, #9499, #9541, #9553, plus the
`composerCollapseOnBlur`/`composerCollapseOnScroll` settings). Skipped as
the default experience: the machinery survived the v0.0.38 merge inside
`ChatComposer.tsx` (it was interwoven with the adopted attachment/citation
systems), but the fork flips both settings' decode defaults to `false` in
`packages/contracts/src/settings.ts` (`// Fork:` marked), so the Forma
composer never collapses unless the user opts in. Re-check those defaults
after every sync.

## Settings reorganization (#9354, v0.0.38 era)

Upstream reorganized settings into General / Appearance / Keybindings /
Integrations / Archived pages. The Forma settings IA is authoritative
(Interface / Threads / Notifications / Providers / Safety / Source Control /
Connections / Advanced, default `/settings/interface`, no General page,
Legacy features under Advanced; registry in
`apps/web/src/components/settings/settingsNavigation.ts`).

**Resolution policy:** reject upstream's page structure; graft genuinely new
settings _content_ (rows, whole new surfaces like Integrations) into the
matching Forma sections and register them in `settingsNavigation.ts` /
`settingsSearch.ts`. The settings search-by-detail engine (#8831) is
adopted with the fork's section registry.

## Mobile workspace exclusion (standing fork policy)

`apps/mobile` is excluded from the pnpm workspace (`!apps/mobile`), so
mobile-only `patchedDependencies` entries are omitted from
`pnpm-workspace.yaml` while the patch files themselves are kept for upstream
parity. Applied to `@legendapp/list@3.3.3`, `@react-native-menu/menu@2.0.0`,
`@react-navigation/native-stack@7.17.6`.
