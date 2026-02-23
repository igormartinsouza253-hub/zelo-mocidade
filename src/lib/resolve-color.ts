/**
 * Resolves a CSS custom property that stores an HSL tuple (e.g. "51 100% 50%")
 * into a concrete CSS color string (e.g. "hsl(51 100% 50%)").
 *
 * Why: some SVG/presentation attribute paths (e.g. Recharts `fill`) can behave
 * inconsistently with `var(...)` expressions depending on browser/runtime.
 */
export function resolveHslFromCssVar(varName: `--${string}`, fallbackTuple?: string) {
  // In case this runs in a non-DOM environment, keep a valid color string.
  if (typeof document === "undefined") {
    return fallbackTuple ? `hsl(${fallbackTuple})` : `hsl(var(${varName}))`;
  }

  const read = (name: `--${string}`) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const raw = read(varName);
  const tupleOrColor = raw || (fallbackTuple ?? "");

  if (!tupleOrColor) return `hsl(var(${varName}))`;

  // If the variable already contains a full color, use it as-is.
  const lower = tupleOrColor.toLowerCase();
  if (lower.startsWith("hsl(") || lower.startsWith("rgb(") || lower.startsWith("#")) {
    return tupleOrColor;
  }

  // Handle indirection: --chart-1: var(--faixa-mocos)
  const varRef = tupleOrColor.match(/^var\((--[^)]+)\)$/);
  if (varRef?.[1]) {
    return resolveHslFromCssVar(varRef[1] as `--${string}`, fallbackTuple);
  }

  // Normal case: it is an HSL tuple.
  return `hsl(${tupleOrColor})`;
}
