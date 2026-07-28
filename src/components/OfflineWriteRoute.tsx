import type { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useOfflineMode } from "@/hooks/useOfflineMode";

type OfflineWriteRouteProps = {
  children: ReactNode;
  fallback: string | ((params: Readonly<Record<string, string | undefined>>) => string);
};

export function OfflineWriteRoute({ children, fallback }: OfflineWriteRouteProps) {
  const { isOffline } = useOfflineMode();
  const params = useParams();

  if (!isOffline) return <>{children}</>;
  const destination = typeof fallback === "function" ? fallback(params) : fallback;
  queueMicrotask(() => toast.info("Esta ação exige conexão. O modo offline é somente leitura."));
  return <Navigate to={destination} replace />;
}

