import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ActiveGroup = {
  id: string;
  name: string;
  description: string | null;
};

export type GroupRole = "admin" | "member";

const ACTIVE_GROUP_CACHE_KEY = "zelo_active_group_cache";

type ActiveGroupCache = {
  userId: string;
  group: ActiveGroup;
  role: GroupRole | null;
  cachedAt: string;
};

type ActiveGroupRpcRow = {
  group_id: string;
  name: string;
  description: string | null;
  role: GroupRole | null;
};

function readActiveGroupCache(userId: string | undefined): ActiveGroupCache | null {
  if (!userId || typeof localStorage === "undefined") return null;

  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_GROUP_CACHE_KEY) ?? "null") as ActiveGroupCache | null;
    return parsed?.userId === userId && parsed.group?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeActiveGroupCache(userId: string, group: ActiveGroup, role: GroupRole | null) {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(
    ACTIVE_GROUP_CACHE_KEY,
    JSON.stringify({
      userId,
      group,
      role,
      cachedAt: new Date().toISOString(),
    } satisfies ActiveGroupCache),
  );
}

function clearActiveGroupCache() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ACTIVE_GROUP_CACHE_KEY);
}

function firstRpcRow(data: unknown): ActiveGroupRpcRow | null {
  if (Array.isArray(data)) return (data[0] as ActiveGroupRpcRow | undefined) ?? null;
  return (data as ActiveGroupRpcRow | null) ?? null;
}

function toActiveGroup(row: ActiveGroupRpcRow): ActiveGroup {
  return {
    id: row.group_id,
    name: row.name,
    description: row.description ?? null,
  };
}

export function useActiveGroup() {
  const { user } = useAuth();
  const cached = readActiveGroupCache(user?.id);
  const requestSeqRef = useRef(0);
  const [loading, setLoading] = useState(!cached);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(cached?.group.id ?? null);
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(cached?.group ?? null);
  const [role, setRole] = useState<GroupRole | null>(cached?.role ?? null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(cached?.userId ?? null);

  const applyResolvedGroup = useCallback(
    (row: ActiveGroupRpcRow | null) => {
      if (!user || !row?.group_id) {
        setActiveGroupId(null);
        setActiveGroup(null);
        setRole(null);
        clearActiveGroupCache();
        return false;
      }

      const nextGroup = toActiveGroup(row);
      const nextRole = row.role ?? null;

      setActiveGroupId(nextGroup.id);
      setActiveGroup(nextGroup);
      setRole(nextRole);
      writeActiveGroupCache(user.id, nextGroup, nextRole);
      return true;
    },
    [user],
  );

  const refresh = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;

    if (!user) {
      setActiveGroupId(null);
      setActiveGroup(null);
      setRole(null);
      setLoadedUserId(null);
      clearActiveGroupCache();
      setLoading(false);
      return false;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("ensure_active_group_for_current_user" as any);

      if (error) throw error;
      if (requestSeq !== requestSeqRef.current) return false;

      return applyResolvedGroup(firstRpcRow(data));
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) return false;

      console.error("[useActiveGroup] Nao foi possivel carregar o grupo ativo:", error);
      setActiveGroupId(null);
      setActiveGroup(null);
      setRole(null);
      clearActiveGroupCache();
      return false;
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoadedUserId(user.id);
        setLoading(false);
      }
    }
  }, [applyResolvedGroup, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveGroupById = useCallback(
    async (groupId: string) => {
      if (!user) throw new Error("Usuario nao autenticado");

      const requestSeq = ++requestSeqRef.current;
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("set_active_group_for_current_user" as any, {
          _group_id: groupId,
        });

        if (error) throw error;
        if (requestSeq !== requestSeqRef.current) return;

        const resolved = firstRpcRow(data);
        if (!applyResolvedGroup(resolved)) throw new Error("Grupo nao encontrado para este usuario");
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoadedUserId(user.id);
          setLoading(false);
        }
      }
    },
    [applyResolvedGroup, user],
  );

  const hasLoadedCurrentUser = !user || loadedUserId === user.id;
  const effectiveLoading = loading || !hasLoadedCurrentUser;
  const isAdmin = useMemo(() => role === "admin", [role]);

  return {
    loading: effectiveLoading,
    activeGroupId,
    activeGroup,
    role,
    isAdmin,
    refresh,
    setActiveGroupById,
  };
}
