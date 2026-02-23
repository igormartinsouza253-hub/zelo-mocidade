import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type TypingUser = { user_id: string; typing: boolean; updated_at: string };

export function useTypingPresence(params: { conversationId: string | null; userId: string | null; text: string }) {
  const { conversationId, userId, text } = params;
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef<{ typing: boolean; at: number } | null>(null);

  const enabled = useMemo(() => Boolean(conversationId && userId), [conversationId, userId]);

  // Presence channel per conversation to signal typing.
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: userId!,
        },
      },
    });
    channelRef.current = channel;

    const recompute = () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const next: TypingUser[] = [];
      Object.entries(state).forEach(([key, metas]) => {
        metas.forEach((m) => {
          if (!m?.user_id) return;
          next.push({
            user_id: m.user_id,
            typing: Boolean(m.typing),
            updated_at: String(m.updated_at ?? new Date().toISOString()),
          });
        });
      });
      setTypingUsers(next);
    };

    channel.on("presence", { event: "sync" }, recompute);
    channel.on("presence", { event: "join" }, recompute);
    channel.on("presence", { event: "leave" }, recompute);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ user_id: userId!, typing: false, updated_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setTypingUsers([]);
    };
  }, [enabled, conversationId, userId]);

  // Send typing state with debounce.
  useEffect(() => {
    if (!enabled) return;
    const channel = channelRef.current;
    if (!channel) return;

    const typing = text.trim().length > 0;
    const now = Date.now();
    const last = lastSentRef.current;
    const shouldSend = !last || last.typing !== typing || now - last.at > 1200;
    if (!shouldSend) return;

    lastSentRef.current = { typing, at: now };
    void channel.track({ user_id: userId!, typing, updated_at: new Date().toISOString() });
  }, [enabled, text, userId]);

  return {
    typingUsers,
  };
}
