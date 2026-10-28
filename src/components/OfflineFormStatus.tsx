import { CloudOff, CloudUpload, Save } from "lucide-react";
import { useOfflineMode } from "@/hooks/useOfflineMode";

export function OfflineFormStatus({ saved, queued }: { saved: boolean; queued: boolean }) {
  const { status } = useOfflineMode();
  if (queued) {
    return <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100" role="status"><CloudUpload className="h-4 w-4 shrink-0" />Registro salvo neste dispositivo e aguardando publicação.</p>;
  }
  if (status !== "online") {
    return <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100" role="status"><CloudOff className="h-4 w-4 shrink-0" />Você está offline. O formulário é salvo neste dispositivo e ainda não foi publicado.</p>;
  }
  if (saved) return <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Save className="h-3.5 w-3.5" />Rascunho salvo neste dispositivo.</p>;
  return null;
}
