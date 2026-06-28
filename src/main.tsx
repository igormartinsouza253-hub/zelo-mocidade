import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from "virtual:pwa-register";

// Evita comportamento inesperado no preview/dev (cache/auto-update servindo bundles antigos).
// Mantemos PWA apenas em produção REAL (app publicada), nunca no domínio id-preview.
const isPreviewHost =
  typeof window !== "undefined" && window.location.hostname.startsWith("id-preview--");

if (import.meta.env.PROD && !isPreviewHost) {
  registerSW({
    immediate: true,
  });
} else {
  // Importante: se um SW já foi registrado anteriormente, ele pode continuar ativo
  // e servir bundles antigos mesmo após remover o registerSW() no dev/preview.
  // Então, no dev/preview (e no previewHost), fazemos cleanup explícito.
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

requestAnimationFrame(() => {
  document.getElementById("app-loading-screen")?.remove();
});
