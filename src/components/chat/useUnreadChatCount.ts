import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";

export function useUnreadChatCount() {
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const enabled = useMemo(() => Boolean(user?.id && activeGroupId), [user?.id, activeGroupId]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refresh = async () => {
      if (!user?.id || !activeGroupId) return;
      setLoading(true);
      const { data, error } = await supabase.rpc("unread_chat_count" as any, {
        _user_id: user.id,
        _group_id: activeGroupId,
      } as any);
      if (!cancelled) {
        if (!error && typeof data === "number") setCount(data);
        setLoading(false);
      }
    };

    void refresh();

    // Any INSERT triggers a refresh (cheap RPC)
    channel = supabase
      .channel(`chat-unread:${activeGroupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => void refresh(),
      )
      .subscribe();

    const interval = window.setInterval(() => void refresh(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, user?.id, activeGroupId]);

  return { count, loading };
}
