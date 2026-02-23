export type ThemeMode = "light" | "dark";

export type PaletteId = "blue" | "olive" | "orange" | "red" | "pink";

export type SemanticTokens = {
  primary: string;
  primaryContainer: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  chartMuted: string;
};

export type ThemedPalette = Record<ThemeMode, SemanticTokens>;

// Utility to create a palette ensuring both modes are present
function createPalette(palette: ThemedPalette): ThemedPalette {
  return palette;
}

// Modern, balanced HSL values tuned for dashboards
export const PALETTES: Record<PaletteId, ThemedPalette> = {
  blue: createPalette({
    light: {
      primary: "215 90% 56%",
      primaryContainer: "213 90% 96%",
      secondary: "215 16% 92%",
      accent: "197 92% 47%",
      background: "210 20% 98%",
      surface: "0 0% 100%",
      surfaceAlt: "210 20% 96%",
      border: "210 16% 88%",
      textPrimary: "222 25% 15%",
      textSecondary: "220 9% 46%",
      success: "142 60% 45%",
      warning: "38 92% 50%",
      error: "0 70% 53%",
      chart1: "215 90% 56%",
      chart2: "197 92% 47%",
      chart3: "222 84% 56%",
      chart4: "262 83% 58%",
      chart5: "172 45% 46%",
      chartMuted: "215 16% 80%",
    },
    dark: {
      primary: "215 90% 62%",
      primaryContainer: "215 35% 18%",
      secondary: "215 21% 18%",
      accent: "197 92% 60%",
      background: "220 26% 10%",
      surface: "220 22% 15%",
      surfaceAlt: "220 20% 18%",
      border: "220 17% 28%",
      textPrimary: "0 0% 98%",
      textSecondary: "220 10% 70%",
      success: "142 55% 52%",
      warning: "38 92% 60%",
      error: "0 70% 60%",
      chart1: "215 90% 62%",
      chart2: "197 92% 60%",
      chart3: "222 84% 66%",
      chart4: "262 83% 68%",
      chart5: "172 45% 58%",
      chartMuted: "215 18% 40%",
    },
  }),
  olive: createPalette({
    light: {
      primary: "88 35% 45%",
      primaryContainer: "88 40% 94%",
      secondary: "88 20% 90%",
      accent: "46 85% 55%",
      background: "60 20% 98%",
      surface: "0 0% 100%",
      surfaceAlt: "60 14% 95%",
      border: "60 10% 86%",
      textPrimary: "210 15% 15%",
      textSecondary: "210 10% 40%",
      success: "123 35% 42%",
      warning: "46 85% 55%",
      error: "0 70% 50%",
      chart1: "88 35% 45%",
      chart2: "46 85% 55%",
      chart3: "123 35% 42%",
      chart4: "32 70% 54%",
      chart5: "210 10% 40%",
      chartMuted: "88 14% 78%",
    },
    dark: {
      primary: "88 35% 60%",
      primaryContainer: "88 20% 20%",
      secondary: "88 16% 18%",
      accent: "46 85% 60%",
      background: "210 15% 8%",
      surface: "210 15% 13%",
      surfaceAlt: "210 14% 18%",
      border: "210 12% 26%",
      textPrimary: "0 0% 98%",
      textSecondary: "210 10% 72%",
      success: "123 35% 55%",
      warning: "46 85% 60%",
      error: "0 70% 58%",
      chart1: "88 35% 60%",
      chart2: "46 85% 60%",
      chart3: "123 35% 55%",
      chart4: "32 70% 60%",
      chart5: "210 10% 70%",
      chartMuted: "88 14% 40%",
    },
  }),
  orange: createPalette({
    light: {
      primary: "27 96% 58%",
      primaryContainer: "27 96% 95%",
      secondary: "24 20% 93%",
      accent: "35 92% 55%",
      background: "24 27% 98%",
      surface: "0 0% 100%",
      surfaceAlt: "24 22% 95%",
      border: "24 18% 88%",
      textPrimary: "216 15% 16%",
      textSecondary: "216 12% 42%",
      success: "142 60% 45%",
      warning: "38 92% 52%",
      error: "0 70% 52%",
      chart1: "27 96% 58%",
      chart2: "35 92% 55%",
      chart3: "17 93% 55%",
      chart4: "48 96% 53%",
      chart5: "210 10% 40%",
      chartMuted: "27 25% 80%",
    },
    dark: {
      primary: "27 96% 64%",
      primaryContainer: "27 42% 20%",
      secondary: "24 20% 20%",
      accent: "35 92% 60%",
      background: "216 19% 10%",
      surface: "216 17% 15%",
      surfaceAlt: "216 16% 20%",
      border: "216 15% 30%",
      textPrimary: "0 0% 98%",
      textSecondary: "216 12% 70%",
      success: "142 55% 52%",
      warning: "38 92% 60%",
      error: "0 70% 60%",
      chart1: "27 96% 64%",
      chart2: "35 92% 60%",
      chart3: "17 93% 62%",
      chart4: "48 96% 60%",
      chart5: "210 10% 72%",
      chartMuted: "27 25% 42%",
    },
  }),
  red: createPalette({
    light: {
      primary: "0 72% 50%",
      primaryContainer: "0 72% 96%",
      secondary: "0 10% 93%",
      accent: "14 90% 57%",
      background: "0 0% 98%",
      surface: "0 0% 100%",
      surfaceAlt: "0 0% 96%",
      border: "0 0% 88%",
      textPrimary: "220 13% 18%",
      textSecondary: "220 9% 46%",
      success: "142 60% 45%",
      warning: "38 92% 50%",
      error: "0 72% 50%",
      chart1: "0 72% 50%",
      chart2: "14 90% 57%",
      chart3: "340 82% 52%",
      chart4: "25 95% 53%",
      chart5: "210 10% 40%",
      chartMuted: "0 15% 78%",
    },
    dark: {
      primary: "0 72% 60%",
      primaryContainer: "0 40% 20%",
      secondary: "0 12% 20%",
      accent: "14 90% 60%",
      background: "220 16% 8%",
      surface: "220 15% 13%",
      surfaceAlt: "220 14% 18%",
      border: "220 13% 30%",
      textPrimary: "0 0% 98%",
      textSecondary: "220 10% 72%",
      success: "142 55% 52%",
      warning: "38 92% 60%",
      error: "0 72% 60%",
      chart1: "0 72% 60%",
      chart2: "14 90% 62%",
      chart3: "340 82% 60%",
      chart4: "25 95% 60%",
      chart5: "210 10% 72%",
      chartMuted: "0 15% 40%",
    },
  }),
  pink: createPalette({
    light: {
      primary: "330 72% 55%",
      primaryContainer: "330 72% 96%",
      secondary: "300 20% 94%",
      accent: "280 70% 60%",
      background: "300 22% 98%",
      surface: "0 0% 100%",
      surfaceAlt: "300 18% 96%",
      border: "300 14% 88%",
      textPrimary: "222 25% 15%",
      textSecondary: "222 10% 45%",
      success: "142 60% 45%",
      warning: "38 92% 50%",
      error: "0 70% 52%",
      chart1: "330 72% 55%",
      chart2: "280 70% 60%",
      chart3: "296 72% 52%",
      chart4: "248 84% 58%",
      chart5: "210 10% 40%",
      chartMuted: "300 16% 80%",
    },
    dark: {
      primary: "330 72% 62%",
      primaryContainer: "330 32% 20%",
      secondary: "300 22% 20%",
      accent: "280 70% 65%",
      background: "260 26% 10%",
      surface: "260 23% 15%",
      surfaceAlt: "260 22% 20%",
      border: "260 18% 30%",
      textPrimary: "0 0% 98%",
      textSecondary: "260 12% 72%",
      success: "142 55% 52%",
      warning: "38 92% 60%",
      error: "0 70% 60%",
      chart1: "330 72% 62%",
      chart2: "280 70% 65%",
      chart3: "296 72% 60%",
      chart4: "248 84% 62%",
      chart5: "210 10% 72%",
      chartMuted: "300 16% 42%",
    },
  }),
};

export function applySemanticTheme(
  palette: PaletteId,
  mode: ThemeMode,
  options?: {
    highlightIntensity?: "low" | "medium" | "high";
    contrast?: "normal" | "high";
  },
) {
  if (typeof document === "undefined") return;

  const theme = PALETTES[palette]?.[mode];
  if (!theme) return;

  const root = document.documentElement;

  const intensity = options?.highlightIntensity ?? "medium";
  const contrast = options?.contrast ?? "normal";

  // Simple tuning knobs (can be made smarter later)
  const primaryLightnessAdjust = intensity === "low" ? -4 : intensity === "high" ? 4 : 0;
  const borderContrastAdjust = contrast === "high" ? -6 : 0;

  const setVar = (name: string, value: string) => {
    root.style.setProperty(name, value);
  };

  const adjustLightness = (hsl: string, delta: number) => {
    if (!delta) return hsl;
    const parts = hsl.split(" ");
    if (parts.length !== 3) return hsl;
    const [h, s, lRaw] = parts;
    const l = parseFloat(lRaw.replace("%", ""));
    const next = Math.max(0, Math.min(100, l + delta));
    return `${h} ${s} ${next}%`;
  };

  // Core UI tokens → existing CSS variables
  setVar("--background", theme.background);
  setVar("--foreground", theme.textPrimary);

  setVar("--card", theme.surface);
  setVar("--card-foreground", theme.textPrimary);

  setVar("--popover", theme.surface);
  setVar("--popover-foreground", theme.textPrimary);

  const adjustedPrimary = adjustLightness(theme.primary, primaryLightnessAdjust);
  setVar("--primary", adjustedPrimary);
  setVar("--primary-foreground", "0 0% 100%");

  // Background helpers to allow tinted app shells
  setVar("--primary-bg", adjustedPrimary);
  setVar("--primary-bg-dark", adjustLightness(adjustedPrimary, -20));

  setVar("--secondary", theme.secondary);
  setVar("--secondary-foreground", theme.textPrimary);

  setVar("--muted", theme.surfaceAlt);
  setVar("--muted-foreground", theme.textSecondary);

  setVar("--accent", theme.accent);
  setVar("--accent-foreground", theme.primary);

  setVar("--destructive", theme.error);
  setVar("--destructive-foreground", "0 0% 100%");

  setVar("--border", adjustLightness(theme.border, borderContrastAdjust));
  setVar("--input", adjustLightness(theme.border, borderContrastAdjust));
  setVar("--ring", theme.primary);

  // Sidebar adopts surface/primary tokens
  setVar("--sidebar-background", theme.surface);
  setVar("--sidebar-foreground", theme.textPrimary);
  setVar("--sidebar-primary", theme.primary);
  setVar("--sidebar-primary-foreground", "0 0% 100%");
  setVar("--sidebar-accent", theme.surfaceAlt);
  setVar("--sidebar-accent-foreground", theme.primary);
  setVar("--sidebar-border", adjustLightness(theme.border, borderContrastAdjust));
  setVar("--sidebar-ring", theme.primary);

  // As cores de gráficos permanecem fixas via CSS (index.css) para garantir
  // consistência independente do tema selecionado.
 }
