import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ZeloLogo } from "@/components/ZeloLogo";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false, errorMessage: null };

  private reloadLatestApp = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    } finally {
      window.location.reload();
    }
  };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[RouteErrorBoundary] Erro ao renderizar rota:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <ZeloLogo className="h-20 w-20 p-3" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold">O app precisou recarregar</h1>
            <p className="text-sm text-muted-foreground">
              Encontramos uma falha temporaria ao abrir esta tela. Recarregue para buscar a versao mais recente.
            </p>
            {isLocalPreview && this.state.errorMessage ? (
              <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-left text-xs text-destructive">
                {this.state.errorMessage}
              </pre>
            ) : null}
          </div>
          <Button className="w-full gap-2" onClick={() => void this.reloadLatestApp()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar app
          </Button>
        </div>
      </div>
    );
  }
}
