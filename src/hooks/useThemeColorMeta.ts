import { useEffect } from "react";

function hslTupleToCssColor(value: string | null) {
  if (!value) return "#fafafa";
  return `hsl(${value})`;
}

export function useThemeColorMeta() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));

    const apply = () => {
      const styles = getComputedStyle(root);
      const background = hslTupleToCssColor(styles.getPropertyValue("--background").trim());
      metas.forEach((meta) => {
        meta.setAttribute("content", background);
      });
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme-preset"],
    });

    return () => observer.disconnect();
  }, []);
}
