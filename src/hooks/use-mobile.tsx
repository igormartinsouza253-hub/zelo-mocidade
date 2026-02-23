import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Importante: não começar como `undefined` (vira `false`) porque isso pode causar
  // redirecionamentos indevidos (ex: /m -> /) antes do primeiro effect rodar.
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Garante sincronização imediata após mount (caso o viewport mude muito rápido)
    onChange();

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
