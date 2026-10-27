import { useState, type ComponentType, type CSSProperties } from "react";
import { ContrastIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { DEFAULT_APP_ICON_ID, type AppIconId } from "@t3tools/contracts";
import {
  DEFAULT_ENVIRONMENT_IDENTIFICATION_MODE,
  DEFAULT_UNIFIED_SETTINGS,
  type ChatWidth,
  type EnvironmentIdentificationMode,
  MAX_APPEARANCE_CONTRAST,
  MAX_GLASS_OPACITY,
  MAX_PANEL_ANIMATION_DURATION_MS,
  MIN_APPEARANCE_CONTRAST,
  MIN_GLASS_OPACITY,
  MIN_PANEL_ANIMATION_DURATION_MS,
} from "@t3tools/contracts/settings";
import {
  resolveEnvironmentIdentificationPillLabel,
  useEnvironmentStageLabel,
} from "../SidebarStageBackdrop";
import { APP_ICON_OPTIONS } from "../../appIcon";
import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/utils";
import { DEFAULT_CUSTOM_THEME_SETTINGS, type ThemeMode } from "../../theme";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { ThemePreferenceSelector } from "./ThemePreferenceSelector";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { AdvancedSettings } from "./AdvancedSettings";
import { PanelAnimationsPreview } from "./PanelAnimationsPreview";
import { TypographySection } from "./TypographySettings";

const ENVIRONMENT_IDENTIFICATION_LABELS: Record<EnvironmentIdentificationMode, string> = {
  artwork: "Artwork",
  pill: "Version pill",
  none: "None",
};

const CHAT_WIDTH_LABELS: Record<ChatWidth, string> = {
  comfortable: "Comfortable",
  wide: "Wide",
  full: "Full",
};

// Fork: Forma builds its theme from mode, hue, and saturation instead of a theme library.
const THEME_MODE_OPTIONS: ReadonlyArray<{
  readonly mode: ThemeMode;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}> = [
  { mode: "system", label: "System", icon: MonitorIcon },
  { mode: "light", label: "Light", icon: SunIcon },
  { mode: "dark", label: "Dark", icon: MoonIcon },
  { mode: "highContrast", label: "High Contrast", icon: ContrastIcon },
];

function AppIconPreview({ id, src }: { id: AppIconId; src: string }) {
  const [failed, setFailed] = useState(false);
  const initials = id
    .replace("forma-", "")
    .split("-")
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  return (
    <span
      className="relative flex size-16 items-center justify-center overflow-hidden"
      // App icon squircle radius, matching the dock artwork.
      style={{ borderRadius: "22%" }}
    >
      {!failed ? (
        <img
          alt=""
          className="size-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
          src={src}
        />
      ) : (
        <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
      )}
    </span>
  );
}

/** Fork: Forma app icons for browser chrome and the desktop dock. */
function AppIconPicker({
  value,
  onChange,
}: {
  value: AppIconId;
  onChange: (value: AppIconId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1 pb-3 sm:grid-cols-5">
      {APP_ICON_OPTIONS.map((option) => {
        const selected = option.id === value;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              "flex min-h-0 flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors",
              selected
                ? "border-foreground/55 bg-accent text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-accent hover:text-foreground",
            )}
            key={option.id}
            onClick={() => onChange(option.id)}
            type="button"
          >
            <AppIconPreview id={option.id} src={option.previewSrc} />
            <span className="text-xs leading-tight font-medium">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AppearanceSettingsPanel() {
  const { themeSettings, setThemeHue, setThemeMode, setThemeSaturation, resolvedTheme } =
    useTheme();
  const appIcon = useClientSettings((clientSettings) => clientSettings.appIcon);
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const environmentStageLabel = useEnvironmentStageLabel();
  const showEnvironmentIdentification =
    resolveEnvironmentIdentificationPillLabel(environmentStageLabel) !== null;
  const glassOpacityRatio =
    (settings.glassOpacity - MIN_GLASS_OPACITY) / (MAX_GLASS_OPACITY - MIN_GLASS_OPACITY);
  const glassOpacitySliderStyle = {
    "--settings-slider-progress": `${glassOpacityRatio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - glassOpacityRatio}rem`,
  } as CSSProperties;
  const appearanceContrastRatio =
    (settings.appearanceContrast - MIN_APPEARANCE_CONTRAST) /
    (MAX_APPEARANCE_CONTRAST - MIN_APPEARANCE_CONTRAST);
  const appearanceContrastSliderStyle = {
    "--settings-slider-progress": `${appearanceContrastRatio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - appearanceContrastRatio}rem`,
  } as CSSProperties;
  const panelAnimationDurationRatio =
    (settings.panelAnimationDurationMs - MIN_PANEL_ANIMATION_DURATION_MS) /
    (MAX_PANEL_ANIMATION_DURATION_MS - MIN_PANEL_ANIMATION_DURATION_MS);
  const panelAnimationDurationSliderStyle = {
    "--settings-slider-progress": `${panelAnimationDurationRatio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - panelAnimationDurationRatio}rem`,
  } as CSSProperties;

  return (
    <SettingsPageContainer>
      <SettingsSection id="appearance" title="Colors & themes">
        <SettingsRow
          {...searchableSetting("theme")}
          description="Build a theme from mode, hue, and saturation."
          resetAction={
            themeSettings.mode !== DEFAULT_CUSTOM_THEME_SETTINGS.mode ||
            themeSettings.hue !== DEFAULT_CUSTOM_THEME_SETTINGS.hue ||
            themeSettings.saturation !== DEFAULT_CUSTOM_THEME_SETTINGS.saturation ? (
              <SettingResetButton
                label="theme"
                onClick={() => {
                  setThemeMode(DEFAULT_CUSTOM_THEME_SETTINGS.mode);
                  setThemeHue(DEFAULT_CUSTOM_THEME_SETTINGS.hue);
                  setThemeSaturation(DEFAULT_CUSTOM_THEME_SETTINGS.saturation);
                }}
              />
            ) : null
          }
          control={
            <Select
              value={themeSettings.mode}
              onValueChange={(value) => {
                const option = THEME_MODE_OPTIONS.find((candidate) => candidate.mode === value);
                if (option) setThemeMode(option.mode);
              }}
            >
              <SelectTrigger className="w-full sm:w-44" aria-label="Theme mode">
                <SelectValue>
                  {THEME_MODE_OPTIONS.find((option) => option.mode === themeSettings.mode)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {THEME_MODE_OPTIONS.map(({ mode, label, icon: Icon }) => (
                  <SelectItem hideIndicator key={mode} value={mode}>
                    <span className="flex items-center gap-2">
                      <Icon className="size-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        >
          <ThemePreferenceSelector
            onHueChange={setThemeHue}
            onSaturationChange={setThemeSaturation}
            resolvedTheme={resolvedTheme}
            theme={themeSettings}
          />
        </SettingsRow>
        <SettingsRow
          {...searchableSetting("app-icon")}
          description="Choose the artwork used for browser chrome and the desktop dock or window icon."
          resetAction={
            appIcon !== DEFAULT_APP_ICON_ID ? (
              <SettingResetButton
                label="app icon"
                onClick={() => updateClientSettings({ appIcon: DEFAULT_APP_ICON_ID })}
              />
            ) : null
          }
        >
          <AppIconPicker
            onChange={(nextAppIcon) => updateClientSettings({ appIcon: nextAppIcon })}
            value={appIcon}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection id="appearance-interface" title="Interface">
        <SettingsRow
          {...searchableSetting("setting-appearance-contrast")}
          description="Adjust the contrast of colors and borders across the interface."
          resetAction={
            settings.appearanceContrast !== DEFAULT_UNIFIED_SETTINGS.appearanceContrast ? (
              <SettingResetButton
                label="contrast"
                onClick={() =>
                  updateSettings({
                    appearanceContrast: DEFAULT_UNIFIED_SETTINGS.appearanceContrast,
                  })
                }
              />
            ) : null
          }
          control={
            <div className="flex w-full items-center gap-3 sm:w-52">
              <output
                className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
                htmlFor="appearance-contrast"
              >
                {settings.appearanceContrast}%
              </output>
              <input
                aria-label="Contrast"
                className="settings-slider min-w-0 flex-1"
                id="appearance-contrast"
                max={MAX_APPEARANCE_CONTRAST}
                min={MIN_APPEARANCE_CONTRAST}
                onChange={(event) => {
                  const appearanceContrast = Number(event.currentTarget.value);
                  if (
                    Number.isInteger(appearanceContrast) &&
                    appearanceContrast >= MIN_APPEARANCE_CONTRAST &&
                    appearanceContrast <= MAX_APPEARANCE_CONTRAST
                  ) {
                    updateSettings({ appearanceContrast });
                  }
                }}
                step={5}
                style={appearanceContrastSliderStyle}
                type="range"
                value={settings.appearanceContrast}
              />
            </div>
          }
        />

        <SettingsRow
          {...searchableSetting("setting-glass-opacity")}
          description="Higher values make menus, dialogs, and the composer more solid."
          resetAction={
            settings.glassOpacity !== DEFAULT_UNIFIED_SETTINGS.glassOpacity ? (
              <SettingResetButton
                label="glass opacity"
                onClick={() =>
                  updateSettings({ glassOpacity: DEFAULT_UNIFIED_SETTINGS.glassOpacity })
                }
              />
            ) : null
          }
          control={
            <div className="flex w-full items-center gap-3 sm:w-52">
              <output
                className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
                htmlFor="glass-opacity"
              >
                {settings.glassOpacity}%
              </output>
              <input
                aria-label="Glass opacity"
                className="settings-slider min-w-0 flex-1"
                id="glass-opacity"
                max={MAX_GLASS_OPACITY}
                min={MIN_GLASS_OPACITY}
                onChange={(event) => {
                  const glassOpacity = Number(event.currentTarget.value);
                  if (
                    Number.isInteger(glassOpacity) &&
                    glassOpacity >= MIN_GLASS_OPACITY &&
                    glassOpacity <= MAX_GLASS_OPACITY
                  ) {
                    updateSettings({ glassOpacity });
                  }
                }}
                step={5}
                style={glassOpacitySliderStyle}
                type="range"
                value={settings.glassOpacity}
              />
            </div>
          }
        />

        <SettingsRow
          {...searchableSetting("chat-width")}
          description="Set how wide messages and the composer can grow on large screens."
          resetAction={
            settings.chatWidth !== DEFAULT_UNIFIED_SETTINGS.chatWidth ? (
              <SettingResetButton
                label="chat width"
                onClick={() => updateSettings({ chatWidth: DEFAULT_UNIFIED_SETTINGS.chatWidth })}
              />
            ) : null
          }
          control={
            <div className="w-full sm:w-40">
              <Select
                value={settings.chatWidth}
                onValueChange={(value) => {
                  if (value === "comfortable" || value === "wide" || value === "full")
                    updateSettings({ chatWidth: value });
                }}
              >
                <SelectTrigger size="sm" className="w-full min-w-0" aria-label="Chat width">
                  <SelectValue>{CHAT_WIDTH_LABELS[settings.chatWidth]}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  <SelectItem value="comfortable">Comfortable (default)</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectPopup>
              </Select>
            </div>
          }
        />
        <SettingsRow
          {...searchableSetting("math-rendering")}
          description="Typeset LaTeX math, such as $x^2$ or \[x^2\], in messages and Markdown previews. The composer keeps TeX source editable."
          resetAction={
            settings.mathRenderingEnabled !== DEFAULT_UNIFIED_SETTINGS.mathRenderingEnabled ? (
              <SettingResetButton
                label="math rendering"
                onClick={() =>
                  updateSettings({
                    mathRenderingEnabled: DEFAULT_UNIFIED_SETTINGS.mathRenderingEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.mathRenderingEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ mathRenderingEnabled: Boolean(checked) })
              }
              aria-label="Render math"
            />
          }
        />
        <AdvancedSettings
          targetIds={[
            searchableSetting("panel-animations").id,
            searchableSetting("environment-identification").id,
            // Environment identification's search result lands on this section.
            "appearance-interface",
            searchableSetting("composer-context").id,
          ]}
        >
          <SettingsRow
            {...searchableSetting("panel-animations")}
            description="Set how fast panels open and close."
            control={
              <div className="grid w-full grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 sm:w-auto sm:grid-cols-[7rem_13rem] sm:gap-4">
                <PanelAnimationsPreview durationMs={settings.panelAnimationDurationMs} />
                <div className="flex w-full items-center gap-3">
                  <output
                    className="min-w-16 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
                    htmlFor="panel-animation-duration"
                  >
                    {settings.panelAnimationDurationMs} ms
                  </output>
                  <input
                    aria-label="Panel animation duration"
                    className="settings-slider min-w-0 flex-1"
                    id="panel-animation-duration"
                    max={MAX_PANEL_ANIMATION_DURATION_MS}
                    min={MIN_PANEL_ANIMATION_DURATION_MS}
                    onChange={(event) => {
                      const panelAnimationDurationMs = Number(event.currentTarget.value);
                      if (
                        Number.isInteger(panelAnimationDurationMs) &&
                        panelAnimationDurationMs >= MIN_PANEL_ANIMATION_DURATION_MS &&
                        panelAnimationDurationMs <= MAX_PANEL_ANIMATION_DURATION_MS
                      ) {
                        updateSettings({ panelAnimationDurationMs });
                      }
                    }}
                    step={25}
                    style={panelAnimationDurationSliderStyle}
                    type="range"
                    value={settings.panelAnimationDurationMs}
                  />
                </div>
              </div>
            }
            resetAction={
              settings.panelAnimationDurationMs !==
              DEFAULT_UNIFIED_SETTINGS.panelAnimationDurationMs ? (
                <SettingResetButton
                  label="panel animations"
                  onClick={() =>
                    updateSettings({
                      panelAnimationDurationMs: DEFAULT_UNIFIED_SETTINGS.panelAnimationDurationMs,
                    })
                  }
                />
              ) : null
            }
          />
          {showEnvironmentIdentification ? (
            <SettingsRow
              {...searchableSetting("environment-identification")}
              description="Choose how Dev and Nightly environments are identified."
              resetAction={
                settings.environmentIdentificationMode !==
                DEFAULT_ENVIRONMENT_IDENTIFICATION_MODE ? (
                  <SettingResetButton
                    label="environment identification"
                    onClick={() =>
                      updateSettings({
                        environmentIdentificationMode: DEFAULT_ENVIRONMENT_IDENTIFICATION_MODE,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Select
                  value={settings.environmentIdentificationMode}
                  onValueChange={(value) => {
                    if (value === "artwork" || value === "pill" || value === "none") {
                      updateSettings({ environmentIdentificationMode: value });
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-full sm:w-40"
                    aria-label="Environment identification"
                  >
                    <SelectValue>
                      {ENVIRONMENT_IDENTIFICATION_LABELS[settings.environmentIdentificationMode]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {Object.entries(ENVIRONMENT_IDENTIFICATION_LABELS).map(([value, label]) => (
                      <SelectItem hideIndicator key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              }
            />
          ) : null}
          <SettingsRow
            {...searchableSetting("composer-context")}
            description="Keep branch and worktree controls below the composer after a thread starts."
            resetAction={
              settings.persistComposerContextStrip !==
              DEFAULT_UNIFIED_SETTINGS.persistComposerContextStrip ? (
                <SettingResetButton
                  label="composer context"
                  onClick={() =>
                    updateSettings({
                      persistComposerContextStrip:
                        DEFAULT_UNIFIED_SETTINGS.persistComposerContextStrip,
                    })
                  }
                />
              ) : null
            }
            control={
              <Switch
                checked={settings.persistComposerContextStrip}
                onCheckedChange={(checked) =>
                  updateSettings({ persistComposerContextStrip: Boolean(checked) })
                }
                aria-label="Keep composer context visible in active threads"
              />
            }
          />
        </AdvancedSettings>
      </SettingsSection>

      <TypographySection />
    </SettingsPageContainer>
  );
}
