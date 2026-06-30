import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ZeloLogo } from "@/components/ZeloLogo";

type RouteErrorBoundaryProps = {
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[RouteErrorBoundary] Erro ao renderizar rota:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <ZeloLogo className="h-20 w-20 p-3" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold">O app precisou recarregar</h1>
            <p className="text-sm text-muted-foreground">
              Encontramos uma falha temporaria ao abrir esta tela. Recarregue para buscar a versao mais recente.
            </p>
          </div>
          <Button className="w-full gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            Recarregar app
          </Button>
        </div>
      </div>
    );
  }
}
