import { CloudOff, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useOfflineMode } from "@/hooks/useOfflineMode";

export function OfflineBanner() {
  const { status, lastSynchronizedAt } = useOfflineMode();
  if (status === "online") return null;

  const timestamp = lastSynchronizedAt
    ? format(new Date(lastSynchronizedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <div
      className="flex min-h-10 shrink-0 items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-950 dark:bg-amber-950/35 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      {status === "reconnecting" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CloudOff className="h-4 w-4" />}
      <span>
        {status === "reconnecting"
          ? "Conexão encontrada. Validando os dados..."
          : `Você está offline. Modo somente leitura${timestamp ? ` — dados atualizados em ${timestamp}` : ""}.`}
      </span>
    </div>
  );
}

