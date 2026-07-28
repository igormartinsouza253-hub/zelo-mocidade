import { useEffect, useRef } from "react";

import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineMode } from "@/hooks/useOfflineMode";
import { synchronizeGroupSnapshot } from "@/offline/snapshotSync";

const MIN_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export function OfflineSynchronizer() {
  const { user } = useAuth();
  const { groups, activeGroupId } = useActiveGroup();
  const { status, refreshSnapshotMetadata } = useOfflineMode();
  const lastSyncRef = useRef<Record<string, number>>({});
  const syncingRef = useRef(false);

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

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeGroupId, groups, refreshSnapshotMetadata, status, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void refreshSnapshotMetadata(user.id, activeGroupId);
  }, [activeGroupId, refreshSnapshotMetadata, status, user?.id]);

  return null;
}
