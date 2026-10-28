import { useEffect, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";

import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { synchronizeGroupSnapshot } from "@/offline/snapshotSync";
import { synchronizeOfflineMutations } from "@/offline/mutationSync";
import { listOfflineMutations } from "@/offline/offlineDb";

const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export function OfflineSynchronizer() {
  const { user } = useAuth();
  const { groups, activeGroupId } = useActiveGroup();
  const { status, refreshSnapshotMetadata } = useOfflineMode();
  const lastSyncRef = useRef<Record<string, number>>({});
  const syncingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user?.id || status !== "online") return;
    const groupIds = [...new Set([
      activeGroupId,
      ...groups.map((group) => group.id),
    ].filter((value): value is string => Boolean(value)))];
    if (!groupIds.length) return;

    let cancelled = false;
    const synchronize = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        setPendingCount((await listOfflineMutations(user.id)).length);
        await synchronizeOfflineMutations(user.id);
        setPendingCount((await listOfflineMutations(user.id)).length);
        for (const groupId of groupIds) {
          if (cancelled) return;
          if (Date.now() - (lastSyncRef.current[groupId] ?? 0) < MIN_SYNC_INTERVAL_MS) continue;
          try {
            await synchronizeGroupSnapshot(user.id, groupId);
            lastSyncRef.current[groupId] = Date.now();
          } catch (error) {
            console.warn(`[offline] Não foi possível preparar o grupo ${groupId}:`, error);
          }
        }
        setPendingCount((await listOfflineMutations(user.id)).length);
        if (!cancelled) await refreshSnapshotMetadata(user.id, activeGroupId);
      } finally {
        syncingRef.current = false;
      }
    };

    void synchronize();
    const interval = window.setInterval(() => void synchronize(), MIN_SYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void synchronize();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [activeGroupId, groups, refreshSnapshotMetadata, status, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void refreshSnapshotMetadata(user.id, activeGroupId);
  }, [activeGroupId, refreshSnapshotMetadata, status, user?.id]);

  if (!pendingCount) return null;
  return <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/30 bg-background/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur" role="status"><CloudUpload className="h-4 w-4 text-amber-600" />{pendingCount === 1 ? "1 registro aguardando publicação" : `${pendingCount} registros aguardando publicação`}</div>;
}
