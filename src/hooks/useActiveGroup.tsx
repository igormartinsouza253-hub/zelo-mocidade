import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ActiveGroup = {
  id: string;
  name: string;
  description: string | null;
};

export type GroupRole = "admin" | "member";

export function useActiveGroup() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<ActiveGroup | null>(null);
  const [role, setRole] = useState<GroupRole | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setActiveGroupId(null);
      setActiveGroup(null);
      setRole(null);
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

      const gid = (active?.group_id as string | null) ?? null;
      setActiveGroupId(gid);
      setActiveGroup(null);
      setRole(null);

      if (!gid) return;

      const [{ data: group, error: groupErr }, { data: member, error: memberErr }] =
        await Promise.all([
          supabase
            .from("management_groups_public")
            .select("id, name, description")
            .eq("id", gid)
            .maybeSingle(),
          supabase
            .from("group_members")
            .select("role")
            .eq("group_id", gid)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);
      if (groupErr) throw groupErr;
      if (memberErr) throw memberErr;

      if (group) {
        setActiveGroup({
          id: group.id,
          name: group.name,
          description: (group.description as string | null) ?? null,
        });
      }
      setRole((member?.role as GroupRole | null) ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveGroupById = useCallback(
    async (groupId: string) => {
      if (!user) throw new Error("Usuário não autenticado");
      const { error } = await supabase.from("user_active_group").upsert(
        {
          user_id: user.id,
          group_id: groupId,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      await refresh();
    },
    [refresh, user],
  );

  const isAdmin = useMemo(() => role === "admin", [role]);

  return {
    loading,
    activeGroupId,
    activeGroup,
    role,
    isAdmin,
    refresh,
    setActiveGroupById,
  };
}
