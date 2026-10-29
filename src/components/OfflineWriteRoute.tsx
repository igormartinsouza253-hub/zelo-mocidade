import type { ReactNode } from "react";

type OfflineWriteRouteProps = {
  children: ReactNode;
  fallback?: string | ((params: Readonly<Record<string, string | undefined>>) => string);
};

export function OfflineWriteRoute({ children }: OfflineWriteRouteProps) {
  return <>{children}</>;
}

