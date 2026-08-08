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

## Mobile workspace exclusion (standing fork policy)

`apps/mobile` is excluded from the pnpm workspace (`!apps/mobile`), so
mobile-only `patchedDependencies` entries are omitted from
`pnpm-workspace.yaml` while the patch files themselves are kept for upstream
parity. Applied to `@legendapp/list@3.3.3`, `@react-native-menu/menu@2.0.0`,
`@react-navigation/native-stack@7.17.6`.
