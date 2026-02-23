import React, { useEffect, useMemo, useState } from "react";

type ThemedLogoProps = {
  src: string;
  alt: string;
  className?: string;
  /** Pixels with RGB below this are considered "black" and will be recolored */
  blackThreshold?: number;
};

function parseHslTriple(raw: string): { h: number; s: number; l: number } | null {
  // Supports formats like: "220 70% 50%" or "220, 70%, 50%"
  const cleaned = raw.trim().replace(/,/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;
  const h = Number(parts[0]);
  const s = Number(parts[1].replace("%", ""));
  const l = Number(parts[2].replace("%", ""));
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  // h in [0,360], s/l in [0,100]
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function getPrimaryRgb() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary");
  const parsed = parseHslTriple(raw);
  if (!parsed) return { r: 0, g: 0, b: 0 };
  return hslToRgb(parsed.h, parsed.s, parsed.l);
}

export function ThemedLogo({
  src,
  alt,
  className,
  blackThreshold = 28,
}: ThemedLogoProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Re-process when theme changes (theme preset applies CSS variables on :root)
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, []);

  const key = useMemo(() => `${src}::${version}::${blackThreshold}`, [src, version, blackThreshold]);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || (img as any).width;
      canvas.height = img.naturalHeight || (img as any).height;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const primary = getPrimaryRgb();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) continue;

        // Recolor near-black pixels (background + black text) to theme primary
        if (r <= blackThreshold && g <= blackThreshold && b <= blackThreshold) {
          data[i] = primary.r;
          data[i + 1] = primary.g;
          data[i + 2] = primary.b;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const out = canvas.toDataURL("image/png");
      if (!cancelled) setDataUrl(out);
    };

    img.onerror = () => {
      if (!cancelled) setDataUrl(null);
    };

    return () => {
      cancelled = true;
    };
  }, [key]);

  return <img src={dataUrl ?? src} alt={alt} className={className} />;
}
