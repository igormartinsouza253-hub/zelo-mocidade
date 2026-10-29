import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GroupMemberInfo = {
  userId: string;
  username: string;
  role: "admin" | "member";
};

export function useGroupMembers(groupId: string | null) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMemberInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!groupId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    try {
      const { data: gm, error: gmErr } = await supabase
        .from("group_members")
        .select("user_id, role")
        .eq("group_id", groupId);
      if (gmErr) throw gmErr;

      const userIds = gm?.map((row) => row.user_id).filter(Boolean) ?? [];
      if (userIds.length === 0) {
        setMembers([]);
        return;
      }

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      if (pErr) throw pErr;

      const usernameById = new Map<string, string>();
      profiles?.forEach((profile) => {
        if (profile.id) usernameById.set(profile.id, profile.username ?? "Usuário");
      });

      const next: GroupMemberInfo[] = userIds.map((uid) => {
        const row = gm?.find((membership) => membership.user_id === uid);
        return {
          userId: uid,
          username: usernameById.get(uid) ?? "Usuário",
          role: (row?.role as "admin" | "member") ?? "member",
        };
      });

      next.sort((a, b) => {
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        return a.username.localeCompare(b.username, "pt-BR");
      });

      setMembers(next);
    } catch (e) {
      console.error("[useGroupMembers]", e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const count = useMemo(() => members.length, [members.length]);

  return { loading, members, count, refresh };
}
