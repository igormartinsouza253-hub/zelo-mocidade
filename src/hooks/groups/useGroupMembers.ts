import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GroupMemberInfo = {
  userId: string;
  username: string;
  role: "admin" | "member";
};

export function useGroupMembers(groupId: string | null) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMemberInfo[]>([]);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data: gm, error: gmErr } = await supabase
          .from("group_members")
          .select("user_id, role")
          .eq("group_id", groupId);
        if (gmErr) throw gmErr;

        const userIds = (gm as any[] | null)?.map((r) => r.user_id as string).filter(Boolean) ?? [];
        if (userIds.length === 0) {
          if (!cancelled) setMembers([]);
          return;
        }

        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);
        if (pErr) throw pErr;

        const usernameById = new Map<string, string>();
        (profiles as any[] | null)?.forEach((p) => {
          if (p?.id) usernameById.set(p.id as string, (p.username as string) ?? "Usuário");
        });

        const next: GroupMemberInfo[] = userIds.map((uid) => {
          const row = (gm as any[]).find((x) => x.user_id === uid);
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

        if (!cancelled) setMembers(next);
      } catch (e) {
        console.error("[useGroupMembers]", e);
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const count = useMemo(() => members.length, [members.length]);

  return { loading, members, count };
}
