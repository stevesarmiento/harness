import type { DesktopBridge, DesktopTheme } from "@t3tools/contracts";
import { safeErrorLogAttributes } from "@t3tools/client-runtime/errors";
import * as Schema from "effect/Schema";
import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_CUSTOM_THEME_SETTINGS,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type CustomThemeSettings,
  type ThemeMode,
  applyThemePreferenceToDocument,
  readStoredThemeSettings,
  resolveDesktopTheme,
  resolveThemeMode,
  setDynamicThemeColor,
  writeStoredThemeSettings,
} from "../theme";

const ThemePreference = Schema.Literals(["light", "dark", "system", "highContrast"]);
const DesktopThemePreference = Schema.Literals(["light", "dark", "system"]);

type ThemeSnapshot = {
  theme: CustomThemeSettings;
  systemDark: boolean;
};

type DesktopThemeBridge = Pick<DesktopBridge, "setTheme">;

const DEFAULT_THEME_SNAPSHOT: ThemeSnapshot = {
  theme: DEFAULT_CUSTOM_THEME_SETTINGS,
  systemDark: false,
};

export class ThemeStorageError extends Schema.TaggedError<ThemeStorageError>()(
  "ThemeStorageError",
  {
    operation: Schema.Literals(["read", "write"]),
    storageKey: Schema.String,
    theme: Schema.optional(ThemePreference),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to ${this.operation} theme preference for ${this.storageKey}.`;
  }
}

const isThemeStorageError = Schema.is(ThemeStorageError);

export class DesktopThemeSyncError extends Schema.TaggedError<DesktopThemeSyncError>()(
  "DesktopThemeSyncError",
  {
    theme: DesktopThemePreference,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Failed to sync the ${this.theme} theme to the desktop shell.`;
  }
}

const isDesktopThemeSyncError = Schema.is(DesktopThemeSyncError);

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: DesktopTheme | null = null;
let lastAppliedTheme: ThemeSnapshot | null = null;
let themeStorageReadFailure: ThemeStorageError | null = null;

function emitChange() {
  for (const listener of listeners) listener();
}

function getSystemDark() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(THEME_MEDIA_QUERY).matches
  );
}

export function readThemePreference(): CustomThemeSettings {
  if (typeof window === "undefined") return DEFAULT_THEME_SNAPSHOT.theme;
  try {
    return readStoredThemeSettings(window.localStorage);
  } catch (cause) {
    throw new ThemeStorageError({
      operation: "read",
      storageKey: THEME_STORAGE_KEY,
      cause,
    });
  }
}

function writeThemePreference(theme: ThemeMode | CustomThemeSettings): void {
  if (typeof window === "undefined") return;
  const settings: CustomThemeSettings =
    typeof theme === "string" ? { ...DEFAULT_CUSTOM_THEME_SETTINGS, mode: theme } : theme;
  try {
    writeStoredThemeSettings(settings, window.localStorage);
    themeStorageReadFailure = null;
  } catch (cause) {
    throw new ThemeStorageError({
      operation: "write",
      storageKey: THEME_STORAGE_KEY,
      theme: settings.mode,
      cause,
    });
  }
}

function getStored(): CustomThemeSettings {
  if (themeStorageReadFailure !== null) {
    return DEFAULT_THEME_SNAPSHOT.theme;
  }
  try {
    return readThemePreference();
  } catch (cause) {
    const error = isThemeStorageError(cause)
      ? cause
      : new ThemeStorageError({
          operation: "read",
          storageKey: THEME_STORAGE_KEY,
          cause,
        });
    themeStorageReadFailure = error;
    console.error(error.message, {
      operation: error.operation,
      storageKey: error.storageKey,
      ...safeErrorLogAttributes(error),
    });
    return DEFAULT_THEME_SNAPSHOT.theme;
  }
}

function normalizeThemeColor(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim().toLowerCase();
  if (
    !normalizedValue ||
    normalizedValue === "transparent" ||
    normalizedValue === "rgba(0, 0, 0, 0)" ||
    normalizedValue === "rgba(0 0 0 / 0)"
  ) {
    return null;
  }

  return value?.trim() ?? null;
}

function resolveBrowserChromeSurface(): HTMLElement {
  return (
    // The inset card carries the opaque content background; the sidebar-inset
    // column behind it is transparent on desktop widths.
    document.querySelector<HTMLElement>("[data-slot='sidebar-inset-card']") ??
    document.querySelector<HTMLElement>("main[data-slot='sidebar-inset']") ??
    document.querySelector<HTMLElement>("[data-slot='sidebar-inner']") ??
    document.body
  );
}

export function syncBrowserChromeTheme() {
  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") return;
  const surfaceColor = normalizeThemeColor(
    getComputedStyle(resolveBrowserChromeSurface()).backgroundColor,
  );
  const fallbackColor = normalizeThemeColor(getComputedStyle(document.body).backgroundColor);
  const backgroundColor = surfaceColor ?? fallbackColor;
  if (!backgroundColor) return;

  document.documentElement.style.backgroundColor = backgroundColor;
  document.body.style.backgroundColor = backgroundColor;
  setDynamicThemeColor(backgroundColor, document);
}

function isSameThemeApplication(snapshot: ThemeSnapshot | null, next: ThemeSnapshot): boolean {
  return (
    snapshot !== null &&
    snapshot.systemDark === next.systemDark &&
    snapshot.theme.mode === next.theme.mode &&
    snapshot.theme.hue === next.theme.hue &&
    snapshot.theme.saturation === next.theme.saturation
  );
}

function applyTheme(settings: CustomThemeSettings, suppressTransitions = false) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const systemDark = settings.mode === "system" ? getSystemDark() : false;
  const desktopTheme = resolveDesktopTheme(settings, systemDark);
  if (isSameThemeApplication(lastAppliedTheme, { theme: settings, systemDark })) {
    syncDesktopTheme(desktopTheme);
    return;
  }

  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }
  applyThemePreferenceToDocument(settings, { document, systemDark });
  lastAppliedTheme = { theme: settings, systemDark };
  syncBrowserChromeTheme();
  syncDesktopTheme(desktopTheme);
  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    window.requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

async function syncDesktopThemePreference(
  bridge: DesktopThemeBridge,
  theme: DesktopTheme,
): Promise<void> {
  try {
    await bridge.setTheme(theme);
  } catch (cause) {
    throw new DesktopThemeSyncError({ theme, cause });
  }
}

function syncDesktopTheme(theme: DesktopTheme) {
  if (typeof window === "undefined") return;
  const bridge = window.desktopBridge;
  if (!bridge || typeof bridge.setTheme !== "function" || lastDesktopTheme === theme) {
    return;
  }

  lastDesktopTheme = theme;
  void syncDesktopThemePreference(bridge, theme).catch((cause: unknown) => {
    const error = isDesktopThemeSyncError(cause)
      ? cause
      : new DesktopThemeSyncError({ theme, cause });
    console.error(error.message, {
      theme: error.theme,
      ...safeErrorLogAttributes(error),
    });
    if (lastDesktopTheme === theme) {
      lastDesktopTheme = null;
    }
  });
}

// Apply immediately on module load to prevent flash
if (typeof document !== "undefined" && typeof window !== "undefined") {
  applyTheme(getStored());
}

function getSnapshot(): ThemeSnapshot {
  if (typeof window === "undefined") return DEFAULT_THEME_SNAPSHOT;
  const theme = getStored();
  const systemDark = theme.mode === "system" ? getSystemDark() : false;

  if (lastSnapshot && isSameThemeApplication(lastSnapshot, { theme, systemDark })) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark };
  return lastSnapshot;
}

function getServerSnapshot() {
  return DEFAULT_THEME_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.push(listener);

  // Listen for system preference changes
  const mq = typeof window.matchMedia === "function" ? window.matchMedia(THEME_MEDIA_QUERY) : null;
  const handleChange = () => {
    if (getStored().mode === "system") applyTheme(getStored(), true);
    emitChange();
  };
  mq?.addEventListener("change", handleChange);

  // Listen for storage changes from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      themeStorageReadFailure = null;
      applyTheme(getStored(), true);
      emitChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    mq?.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function updateTheme(next: Partial<CustomThemeSettings>): boolean {
  if (typeof window === "undefined") return false;
  const updated = { ...getStored(), ...next };
  try {
    writeThemePreference(updated);
  } catch (cause) {
    const error = isThemeStorageError(cause)
      ? cause
      : new ThemeStorageError({
          operation: "write",
          storageKey: THEME_STORAGE_KEY,
          theme: updated.mode,
          cause,
        });
    console.error(error.message, {
      operation: error.operation,
      storageKey: error.storageKey,
      theme: updated.mode,
      ...safeErrorLogAttributes(error),
    });
    return false;
  }
  applyTheme(updated, true);
  emitChange();
  return true;
}

function setTheme(mode: ThemeMode): boolean {
  return updateTheme({ mode });
}

function setThemeHue(hue: number): void {
  updateTheme({ hue });
}

function setThemeSaturation(saturation: number): void {
  updateTheme({ saturation });
}

/** For shortcuts and other handlers outside React that read the theme at event time. */
export function getThemeSnapshot() {
  const snapshot = getSnapshot();
  return {
    appearanceMode: snapshot.theme.mode,
    resolvedTheme: resolveThemeMode(snapshot.theme, snapshot.systemDark),
  } as const;
}

/** Fork: Forma's theme mode doubles as the appearance mode upstream shortcuts cycle. */
export function setAppearanceMode(mode: ThemeMode): boolean {
  return setTheme(mode);
}

/** For code outside React (worker pools) that follows the rendered appearance. */
export function subscribeRenderedAppearance(listener: () => void): () => void {
  return subscribe(listener);
}

export function getRenderedAppearance() {
  const snapshot = getSnapshot();
  return resolveThemeMode(snapshot.theme, snapshot.systemDark);
}

/** The light/dark appearance currently rendered, for code and diff highlighting. */
export function useRenderedAppearance() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return resolveThemeMode(snapshot.theme, snapshot.systemDark);
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const themeSettings = snapshot.theme;
  const resolvedTheme = resolveThemeMode(themeSettings, snapshot.systemDark);
  const isDark = resolvedTheme === "dark";

  // Keep DOM in sync on mount/change
  useEffect(() => {
    applyTheme(themeSettings);
  }, [themeSettings]);

  return {
    // Upstream-compatible surface
    theme: themeSettings.mode,
    setTheme,
    resolvedTheme,
    // Forma custom theme surface
    themeSettings,
    setThemeMode: setTheme,
    setThemeHue,
    setThemeSaturation,
    isDark,
  } as const;
}
