import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from "virtual:pwa-register";

const RECOVERY_FLAG = "zelo_recovered_from_stale_app";

async function clearAppCaches() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
}

function isChunkLoadError(reason: unknown) {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : String((reason as { message?: unknown })?.message ?? reason ?? "");

  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror|dynamically imported module/i.test(
    message,
  );
}

async function recoverFromStaleApp() {
  if (sessionStorage.getItem(RECOVERY_FLAG) === "1") return;

  sessionStorage.setItem(RECOVERY_FLAG, "1");
  await clearAppCaches();
  window.location.reload();
}

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error ?? event.message)) {
    void recoverFromStaleApp();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    void recoverFromStaleApp();
  }
});

// Evita comportamento inesperado no preview/dev (cache/auto-update servindo bundles antigos).
// Mantemos PWA apenas em producao real (app publicada), nunca no dominio id-preview.
const isPreviewHost =
  typeof window !== "undefined" && window.location.hostname.startsWith("id-preview--");

if (import.meta.env.PROD && !isPreviewHost) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
    onOfflineReady() {
      sessionStorage.removeItem(RECOVERY_FLAG);
    },
    onRegisterError(error) {
      console.error("Erro ao registrar atualizacao offline:", error);
    },
  });
} else {
  // Importante: se um SW ja foi registrado anteriormente, ele pode continuar ativo
  // e servir bundles antigos mesmo apos remover o registerSW() no dev/preview.
  // Entao, no dev/preview (e no previewHost), fazemos cleanup explicito.
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
