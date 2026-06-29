import { useCallback, useEffect, useMemo, useState } from "react";

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

type GroupDetails = {
  group: ActiveGroup;
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

async function persistActiveGroup(userId: string, groupId: string) {
  const { error } = await supabase.from("user_active_group").upsert(
    {
      user_id: userId,
      group_id: groupId,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

async function loadGroupDetails(userId: string, groupId: string): Promise<GroupDetails | null> {
  const [{ data: group, error: groupErr }, { data: member, error: memberErr }] =
    await Promise.all([
      supabase
        .from("management_groups_public")
        .select("id, name, description")
        .eq("id", groupId)
        .maybeSingle(),
      supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  if (groupErr) throw groupErr;
  if (memberErr) throw memberErr;
  if (!group?.id || !group?.name) return null;

  return {
    group: {
      id: group.id,
      name: group.name,
      description: (group.description as string | null) ?? null,
    },
    role: (member?.role as GroupRole | null) ?? null,
  };
}

async function findFirstMembership(userId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return (data as { group_id: string; role: GroupRole | null }[] | null)?.[0] ?? null;
}

export function useActiveGroup() {
  const { user } = useAuth();
  const cached = readActiveGroupCache(user?.id);
  const [loading, setLoading] = useState(!cached);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(cached?.group.id ?? null);
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(cached?.group ?? null);
  const [role, setRole] = useState<GroupRole | null>(cached?.role ?? null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(cached?.userId ?? null);

  const refresh = useCallback(async () => {
    if (!user) {
      setActiveGroupId(null);
      setActiveGroup(null);
      setRole(null);
      setLoadedUserId(null);
      clearActiveGroupCache();
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: active, error: activeErr } = await supabase
        .from("user_active_group")
        .select("group_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (activeErr) throw activeErr;

      let gid = (active?.group_id as string | null) ?? null;

      setActiveGroup(null);
      setRole(null);

      if (!gid) {
        const firstMembership = await findFirstMembership(user.id);

        if (!firstMembership?.group_id) {
          setActiveGroupId(null);
          clearActiveGroupCache();
          return;
        }

        gid = firstMembership.group_id;
        await persistActiveGroup(user.id, gid);
      }

      setActiveGroupId(gid);

      const details = await loadGroupDetails(user.id, gid);

      if (!details) {
        setActiveGroupId(null);
        clearActiveGroupCache();
        return;
      }

      setActiveGroup(details.group);
      setRole(details.role);
      writeActiveGroupCache(user.id, details.group, details.role);
    } catch (error) {
      console.error("[useActiveGroup] Nao foi possivel carregar o grupo ativo:", error);
      setActiveGroupId(null);
      setActiveGroup(null);
      setRole(null);
      clearActiveGroupCache();
    } finally {
      setLoadedUserId(user.id);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveGroupById = useCallback(
    async (groupId: string) => {
      if (!user) throw new Error("Usuario nao autenticado");
      await persistActiveGroup(user.id, groupId);
      await refresh();
    },
    [refresh, user],
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
