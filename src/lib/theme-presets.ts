/**
 * Compatibilidade com preferências gravadas por versões antigas.
 *
 * O Zelo possui uma única identidade visual. IDs antigos ainda são aceitos
 * para que registros existentes não quebrem, mas não alteram mais as cores.
 */
export type ThemePresetId =
  | "azul"
  | "laranja"
  | "verde"
  | "rosa"
  | "roxo"
  | "vermelho"
  | "amarelo";

export interface CustomThemeConfig {
  primary?: string;
  accent?: string;
  sidebarPrimary?: string;
  sidebarAccent?: string;
  ring?: string;
  highlightIntensity?: "low" | "medium" | "high";
  contrast?: "normal" | "high";
}

export const THEME_PRESETS_META = [
  {
    id: "verde" as const,
    label: "Zelo",
    description: "Identidade visual oficial do aplicativo",
    preview: {
      primary: "48 30% 34%",
      accent: "48 36% 72%",
    },
  },
];

const LEGACY_INLINE_VARIABLES = [
  "--primary",
  "--accent",
  "--sidebar-primary",
  "--sidebar-accent",
  "--ring",
] as const;

export function applyThemePreset(
  _preset: ThemePresetId,
  _custom?: CustomThemeConfig | null,
) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.themePreset = "zelo";
  LEGACY_INLINE_VARIABLES.forEach((variable) => root.style.removeProperty(variable));
}
