import { applySemanticTheme, PaletteId } from "./theme-system";

export type ThemePresetId =
  | "azul"
  | "laranja"
  | "verde"
  | "rosa"
  | "roxo"
  | "vermelho"
  | "amarelo";

export interface CustomThemeConfig {
  primary?: string; // HSL tuple, ex: "222 84% 56%"
  accent?: string;
  sidebarPrimary?: string;
  sidebarAccent?: string;
  ring?: string;
  // Opções do construtor guiado (mantidas apenas para intensidade/contraste)
  highlightIntensity?: "low" | "medium" | "high";
  contrast?: "normal" | "high";
}

type BuiltInPresetId = ThemePresetId;

const PRESET_MAP: Record<BuiltInPresetId, CustomThemeConfig> = {
  azul: {
    primary: "207 64% 47%", // #2c7ec2
    accent: "207 64% 57%",
    sidebarPrimary: "207 64% 43%",
    sidebarAccent: "210 16% 92%",
    ring: "207 64% 47%",
  },
  laranja: {
    primary: "33 100% 45%", // #e47b00
    accent: "33 100% 55%",
    sidebarPrimary: "33 100% 41%",
    sidebarAccent: "24 20% 93%",
    ring: "33 100% 45%",
  },
  verde: {
    primary: "138 62% 38%", // #259b46
    accent: "138 62% 46%",
    sidebarPrimary: "138 62% 34%",
    sidebarAccent: "120 16% 92%",
    ring: "138 62% 38%",
  },
  rosa: {
    primary: "335 100% 42%", // #d60060
    accent: "335 100% 50%",
    sidebarPrimary: "335 100% 38%",
    sidebarAccent: "300 20% 94%",
    ring: "335 100% 42%",
  },
  roxo: {
    primary: "292 100% 32%", // #8b00a2
    accent: "292 100% 40%",
    sidebarPrimary: "292 100% 28%",
    sidebarAccent: "280 22% 92%",
    ring: "292 100% 32%",
  },
  vermelho: {
    primary: "0 74% 53%", // #e12a2a
    accent: "0 74% 60%",
    sidebarPrimary: "0 74% 49%",
    sidebarAccent: "0 10% 93%",
    ring: "0 74% 53%",
  },
  amarelo: {
    primary: "51 100% 50%", // #ffd600
    accent: "51 100% 56%",
    sidebarPrimary: "51 100% 46%",
    sidebarAccent: "48 96% 93%",
    ring: "51 100% 50%",
  },
};

export const THEME_PRESETS_META: {
  id: BuiltInPresetId;
  label: string;
  description: string;
  preview: { primary?: string; accent?: string };
}[] = [
  {
    id: "azul",
    label: "Azul (Padrão)",
    description: "Tema principal com destaques azuis",
    preview: {
      primary: PRESET_MAP.azul.primary,
      accent: PRESET_MAP.azul.accent,
    },
  },
  {
    id: "laranja",
    label: "Laranja",
    description: "Destaques quentes e energéticos",
    preview: {
      primary: PRESET_MAP.laranja.primary,
      accent: PRESET_MAP.laranja.accent,
    },
  },
  {
    id: "verde",
    label: "Verde",
    description: "Visual equilibrado com toques de verde",
    preview: {
      primary: PRESET_MAP.verde.primary,
      accent: PRESET_MAP.verde.accent,
    },
  },
  {
    id: "rosa",
    label: "Rosa",
    description: "Tema marcante com rosa intenso",
    preview: {
      primary: PRESET_MAP.rosa.primary,
      accent: PRESET_MAP.rosa.accent,
    },
  },
  {
    id: "roxo",
    label: "Roxo",
    description: "Roxo moderno com neutros sóbrios",
    preview: {
      primary: PRESET_MAP.roxo.primary,
      accent: PRESET_MAP.roxo.accent,
    },
  },
  {
    id: "vermelho",
    label: "Vermelho",
    description: "Destaques fortes em vermelho",
    preview: {
      primary: PRESET_MAP.vermelho.primary,
      accent: PRESET_MAP.vermelho.accent,
    },
  },
  {
    id: "amarelo",
    label: "Amarelo",
    description: "Tema luminoso com amarelo vibrante",
    preview: {
      primary: PRESET_MAP.amarelo.primary,
      accent: PRESET_MAP.amarelo.accent,
    },
  },
];

const VAR_MAP: Record<
  Exclude<keyof CustomThemeConfig, "highlightIntensity" | "contrast">,
  string
> = {
  primary: "--primary",
  accent: "--accent",
  sidebarPrimary: "--sidebar-primary",
  sidebarAccent: "--sidebar-accent",
  ring: "--ring",
};

export function applyThemePreset(preset: ThemePresetId, custom?: CustomThemeConfig | null) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.themePreset = preset;

  const isDark = root.classList.contains("dark");
  const mode = isDark ? "dark" : "light";

  let palette: PaletteId = "olive";
  switch (preset) {
    case "azul":
      palette = "blue";
      break;
    case "laranja":
      palette = "orange";
      break;
    case "vermelho":
      palette = "red";
      break;
    case "rosa":
    case "roxo":
      palette = "pink";
      break;
    case "verde":
    case "amarelo":
    default:
      palette = "olive";
      break;
  }

  const highlight = custom?.highlightIntensity;
  const contrast = custom?.contrast;

  applySemanticTheme(palette, mode, {
    highlightIntensity: highlight,
    contrast,
  });

  const base = PRESET_MAP[preset as BuiltInPresetId] || {};
  const overrides = custom ? custom : {};
  const finalConfig: CustomThemeConfig = { ...base, ...overrides };

  (Object.keys(VAR_MAP) as (keyof CustomThemeConfig)[]).forEach((key) => {
    const value = finalConfig[key];
    if (value) {
      root.style.setProperty(VAR_MAP[key], value);
    }
  });
}


