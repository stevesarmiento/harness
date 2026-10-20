import { HTML_RENDER_DEFAULT_FONTS, htmlRenderTheme } from "@t3tools/shared/htmlRender";
import {
  T3_CODE_DARK_THEME_COLORS,
  T3_CODE_LIGHT_THEME_COLORS,
} from "@t3tools/shared/themePalettes";

import { appearanceFontStack } from "../appearanceFonts";
import { useClientSettings } from "./useSettings";
import { useTheme } from "./useTheme";

/**
 * The app's appearance and fonts, as handed to agent HTML renders.
 *
 * Fork: Forma has no theme library, so renders get the standard palette (already
 * hex) for the resolved light or dark mode.
 */
export function useHtmlRenderTheme() {
  const { resolvedTheme } = useTheme();
  const sans = useClientSettings((settings) => settings.fontFamilySans);
  const mono = useClientSettings((settings) => settings.fontFamilyCode);
  return htmlRenderTheme(
    resolvedTheme === "dark" ? T3_CODE_DARK_THEME_COLORS : T3_CODE_LIGHT_THEME_COLORS,
    resolvedTheme,
    {
      sans: appearanceFontStack(sans, HTML_RENDER_DEFAULT_FONTS.sans),
      mono: appearanceFontStack(mono, HTML_RENDER_DEFAULT_FONTS.mono),
    },
  );
}
