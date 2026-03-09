import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  MoreVertical,
  Plus,
  PanelRight,
  Pencil,
  Send,
  Smile,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useChatLauncher } from "@/components/chat/ChatLauncherContext";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChatConversation, ChatMessage, ChatMessageType, ChatProfile } from "@/components/chat/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useAudioRecorder } from "@/components/chat/useAudioRecorder";
import { useTypingPresence } from "@/components/chat/useTypingPresence";

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => {
    if (p.match(/^https?:\/\//)) {
      return (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="underline text-primary break-all">
          {p}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

async function ensureSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function ChatView({ mode }: { mode: "page" | "panel" }) {
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();
  const { setConfig } = usePageHeader();
  const navigate = useNavigate();
  const { openChatPanel, closeChatPanel, preferredOpenMode, setPreferredOpenMode } = useChatLauncher();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ChatProfile>>({});
  const [text, setText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const [dmOtherUserId, setDmOtherUserId] = useState<string | null>(null);
  const [dmOtherPresence, setDmOtherPresence] = useState<{ last_seen_at: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const recorder = useAudioRecorder();
  const { typingUsers } = useTypingPresence({
    conversationId: activeConversationId,
    userId: user?.id ?? null,
    text,
  });

  const isCompactPanel = mode === "panel";

  const [dockExpanded, setDockExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("chatPanelDockExpanded") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chatPanelDockExpanded", dockExpanded ? "1" : "0");
  }, [dockExpanded]);

  const isDockCollapsed = isCompactPanel && !dockExpanded;

  useEffect(() => {
    if (mode !== "page") return;
    setConfig({
      title: "Chat",
      icon: MessageCircle,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Chat" }],
      showBackButton: true,
      backTo: "/",
      secondaryActions: !isMobile ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            setPreferredOpenMode("panel");
            openChatPanel();
          }}
        >
          <PanelRight className="h-4 w-4 mr-2" />
          Abrir painel
        </Button>
      ) : null,
    });
    return () => setConfig(null);
  }, [mode, openChatPanel, setConfig, setPreferredOpenMode, isMobile]);

  useEffect(() => {
    if (mode !== "page") return;
    if (isMobile) return;
    if (preferredOpenMode !== "panel") return;
    openChatPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const upsertIncomingMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      // Already have it
      if (prev.some((m) => m.id === msg.id)) return prev;

      // If we have an optimistic placeholder for our own message, replace it.
      if (user && msg.user_id === user.id) {
        const idx = prev.findIndex(
          (m) =>
            m.id.startsWith("temp_") &&
            m.user_id === msg.user_id &&
            m.content === msg.content &&
            (m.message_type ?? "text") === (msg.message_type ?? "text") &&
            (m.media_url ?? null) === (msg.media_url ?? null),
        );
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = msg;
          return next;
        }
      }

      return [...prev, msg];
    });
  };

  const loadConversations = async () => {
    if (!user || !activeGroupId) return;
    setLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("id, kind, group_id, title, created_at")
        .eq("group_id", activeGroupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const list = ((data as any) ?? []) as ChatConversation[];

      const hasGroup = list.some((c) => c.kind === "group");
      if (!hasGroup) {
        const { error: createErr } = await supabase.from("chat_conversations").insert({
          kind: "group",
          group_id: activeGroupId,
          created_by: user.id,
          title: "Geral",
        } as any);
        if (!createErr) return void loadConversations();
      }

      // IMPORTANT: messages RLS requires membership in chat_members.
      // Ensure current user is a member of the default group chat (usually "Geral").
      const defaultGroup = list.find((c) => c.kind === "group") ?? null;
      if (defaultGroup) {
        const { error: joinErr } = await supabase.from("chat_members").insert({
          conversation_id: defaultGroup.id,
          user_id: user.id,
        } as any);
        // Ignore duplicates; surface other errors.
        if (joinErr && (joinErr as any).code !== "23505") {
          // This should be rare; still let the UI work with conversation list.
          console.warn("Falha ao entrar no chat padrão:", joinErr);
        }
      }

      setConversations(list);
      setActiveConversationId((prev) => prev ?? (list[0]?.id ?? null));
    } finally {
      setLoadingConversations(false);
    }
  };

  const ensureMembership = async (conversationId: string) => {
    if (!user) return;
    const { error } = await supabase.from("chat_members").insert({
      conversation_id: conversationId,
      user_id: user.id,
    } as any);
    if (error && (error as any).code !== "23505") throw error;
  };

  const markRead = async (conversationId: string) => {
    if (!user) return;
    await supabase
      .from("chat_reads")
      .upsert(
        { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() } as any,
        { onConflict: "conversation_id,user_id" },
      );
  };

  const resolveProfiles = async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter((id) => !profilesById[id]);
    if (unique.length === 0) return;
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url").in("id", unique).limit(200);
    if (error) return;
    const next: Record<string, ChatProfile> = {};
    (data as any as ChatProfile[]).forEach((p) => (next[p.id] = p));
    setProfilesById((prev) => ({ ...prev, ...next }));
  };

  const loadMessages = async (conversationId: string, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, user_id, content, created_at, message_type, media_url, mime_type, file_name, duration_ms")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      const list = ((data as any) ?? []) as ChatMessage[];
      setMessages(list);
      void resolveProfiles(list.map((m) => m.user_id));
      void markRead(conversationId);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
    } finally {
      if (!opts?.silent) setLoadingMessages(false);
    }
  };

  const refreshPresenceForUser = async (targetUserId: string) => {
    if (!activeGroupId) return;
    const { data } = await supabase
      .from("group_user_presence")
      .select("last_seen_at")
      .eq("group_id", activeGroupId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    setDmOtherPresence((data as any) ?? null);
  };

  const loadDmOtherUser = async (conversationId: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .limit(10);
    if (error) return;
    const ids = ((data as any[]) ?? []).map((r) => r.user_id).filter(Boolean);
    const other = ids.find((id) => id !== user.id) ?? null;
    setDmOtherUserId(other);
    if (other) {
      void resolveProfiles([other]);
      void refreshPresenceForUser(other);
    }
  };

  useEffect(() => {
    void loadConversations().catch((e) => {
      console.error(e);
      toast.error("Não foi possível carregar conversas.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeGroupId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    // For group chats, auto-join the conversation so messages RLS allows read/write.
    if (activeConversation?.kind === "group") {
      void ensureMembership(activeConversationId).catch((e) => {
        console.error(e);
        toast.error("Não foi possível entrar no chat do grupo.");
      });
    }

    let mounted = true;
    void loadMessages(activeConversationId).catch((e) => {
      console.error(e);
      toast.error("Não foi possível carregar mensagens.");
    });

    if (activeConversation?.kind === "dm") {
      void loadDmOtherUser(activeConversationId);
    } else {
      setDmOtherUserId(null);
      setDmOtherPresence(null);
    }

    const channel = supabase
      .channel(`chat:${activeConversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          if (!mounted) return;
          const incoming = payload.new as any as ChatMessage;
          upsertIncomingMessage(incoming);
          void resolveProfiles([incoming.user_id]);
          requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
          void markRead(activeConversationId);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          if (!mounted) return;
          const nextMsg = payload.new as any as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === nextMsg.id ? { ...m, ...nextMsg } : m)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${activeConversationId}` },
        (payload) => {
          if (!mounted) return;
          const old = payload.old as any as { id?: string };
          if (!old?.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        },
      )
      .subscribe();

    // Track subscription status.
    channel.subscribe((status) => {
      if (!mounted) return;
      setRealtimeConnected(status === "SUBSCRIBED");
    });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeConversation?.kind]);

  // Fallback: refetch a cada 5s enquanto realtime estiver desconectado.
  useEffect(() => {
    if (!activeConversationId) return;
    if (realtimeConnected) return;

    const id = window.setInterval(() => {
      void loadMessages(activeConversationId, { silent: true }).catch(() => {
        // ignore
      });
    }, 5000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConnected, activeConversationId]);

  // When realtime reconnects, do a silent refresh to eliminate any gap.
  useEffect(() => {
    if (!activeConversationId) return;
    if (!realtimeConnected) return;
    void loadMessages(activeConversationId, { silent: true }).catch(() => {
      // ignore
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeConnected, activeConversationId]);

  const sendMessage = async (payload: { type: ChatMessageType; content: string; mediaPath?: string; mime?: string; fileName?: string; durationMs?: number }) => {
    if (!user) return;
    if (!activeConversationId) return;

    // Optimistic UI: show message instantly while the network request completes.
    const tempId = `temp_${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: activeConversationId,
      user_id: user.id,
      content: payload.content,
      created_at: new Date().toISOString(),
      message_type: payload.type,
      media_url: payload.mediaPath ?? null,
      mime_type: payload.mime ?? null,
      file_name: payload.fileName ?? null,
      duration_ms: payload.durationMs ?? null,
    };

    upsertIncomingMessage(optimistic);
    void resolveProfiles([user.id]);

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
      conversation_id: activeConversationId,
      user_id: user.id,
      content: payload.content,
      message_type: payload.type,
      media_url: payload.mediaPath ?? null,
      mime_type: payload.mime ?? null,
      file_name: payload.fileName ?? null,
      duration_ms: payload.durationMs ?? null,
      } as any)
      .select("id, conversation_id, user_id, content, created_at, message_type, media_url, mime_type, file_name, duration_ms")
      .maybeSingle();

    if (error) {
      // rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }

    // Ensure immediate consistency even if realtime is delayed.
    if (data) upsertIncomingMessage(data as any);

    void markRead(activeConversationId);
  };

  const handleSendText = async () => {
    const content = text.trim();
    if (!content) return;
    setText("");
    try {
      await sendMessage({ type: "text", content });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar.");
      setText(content);
    }
  };

  const uploadAndSendFile = async (file: File, type: ChatMessageType) => {
    if (!user || !activeGroupId || !activeConversationId) return;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${activeGroupId}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;
    await sendMessage({
      type,
      content: type === "image" ? "📷 Foto" : "🎤 Áudio",
      mediaPath: path,
      mime: file.type,
      fileName: file.name,
    });
  };

  const startOrStopRecording = async () => {
    if (recorder.recording) {
      const result = await recorder.stop();
      if (!result) return;
      const file = new File([result.blob], result.fileName, { type: result.mimeType });
      await uploadAndSendFile(file, "audio");
      return;
    }

    if (!recorder.supported) {
      toast.error("Seu navegador não suporta gravação.");
      return;
    }
    await recorder.start();
    if (recorder.error) toast.error(recorder.error);
  };

  const saveEdit = async () => {
    if (!user || !editingId) return;
    const content = editingText.trim();
    if (!content) return;
    const { error } = await supabase
      .from("chat_messages")
      .update({ content, edited_at: new Date().toISOString() } as any)
      .eq("id", editingId);
    if (error) {
      toast.error("Não foi possível editar.");
      return;
    }
    setEditingId(null);
    setEditingText("");
  };

  const deleteMessage = async (id: string) => {
    if (!user) return;
    const ok = window.confirm("Excluir esta mensagem?");
    if (!ok) return;
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast.error("Não foi possível excluir.");
  };

  const emojiList = ["😀", "😂", "😊", "😍", "🙏", "👍", "❤️", "🎉", "😢", "😡", "🤔", "🙌"];

  const startDm = async (targetUserId: string) => {
    if (!user || !activeGroupId) return;

    const { data: existing, error: exErr } = await supabase
      .from("chat_conversations")
      .select("id, kind, group_id, title, created_at")
      .eq("group_id", activeGroupId)
      .eq("kind", "dm")
      .order("created_at", { ascending: true });
    if (exErr) throw exErr;

    const dms = ((existing as any) ?? []) as ChatConversation[];
    if (dms.length) {
      const { data: members } = await supabase
        .from("chat_members")
        .select("conversation_id, user_id")
        .in(
          "conversation_id",
          dms.map((d) => d.id),
        );

      const byConv = new Map<string, Set<string>>();
      (members as any[] | null)?.forEach((m) => {
        if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, new Set());
        byConv.get(m.conversation_id)!.add(m.user_id);
      });

      const found = dms.find((d) => {
        const set = byConv.get(d.id);
        return set?.has(user.id) && set?.has(targetUserId) && set.size === 2;
      });
      if (found) {
        setActiveConversationId(found.id);
        return;
      }
    }

    const { data: conv, error } = await supabase
      .from("chat_conversations")
      .insert({ kind: "dm", group_id: activeGroupId, created_by: user.id, title: null } as any)
      .select("id, kind, group_id, title, created_at")
      .maybeSingle();
    if (error) throw error;
    if (!conv?.id) throw new Error("create_dm_failed");

    const { error: mErr } = await supabase.from("chat_members").insert([
      { conversation_id: conv.id, user_id: user.id } as any,
      { conversation_id: conv.id, user_id: targetUserId } as any,
    ]);
    if (mErr) throw mErr;

    await loadConversations();
    setActiveConversationId(conv.id);
  };

  const [memberCandidates, setMemberCandidates] = useState<ChatProfile[]>([]);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");

  const loadMemberCandidates = async () => {
    if (!activeGroupId || !user) return;
    const { data: gms, error: gmErr } = await supabase.from("group_members").select("user_id").eq("group_id", activeGroupId).limit(300);
    if (gmErr) throw gmErr;
    const ids = ((gms as any[]) ?? []).map((x) => x.user_id).filter((id) => id !== user.id);
    if (!ids.length) {
      setMemberCandidates([]);
      return;
    }
    const { data: profs, error: pErr } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids).limit(300);
    if (pErr) throw pErr;
    setMemberCandidates(((profs as any) ?? []) as ChatProfile[]);
  };

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase();
    if (!q) return memberCandidates;
    return memberCandidates.filter((m) => m.username.toLowerCase().includes(q));
  }, [memberCandidates, memberFilter]);

  const renderMessage = (m: ChatMessage) => {
    const mine = m.user_id === user?.id;
    const profile = profilesById[m.user_id];
    const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const bubble = mine ? "bg-accent" : "bg-card";

    if (editingId === m.id) {
      return (
        <div key={m.id} className={"flex flex-col gap-2 " + (mine ? "items-end" : "items-start")}>
          <div className={`max-w-[85%] w-full rounded-2xl border border-border px-3 py-2 text-sm ${bubble}`}>
            <div className="text-[11px] text-muted-foreground mb-2">Editando</div>
            <Input value={editingText} onChange={(e) => setEditingText(e.target.value)} className="h-9" />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setEditingId(null);
                setEditingText("");
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button size="sm" onClick={() => void saveEdit()}>
                <Send className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={m.id} className={"flex flex-col gap-1 " + (mine ? "items-end" : "items-start")}>
        {!mine && <div className="text-[11px] text-muted-foreground px-1">{profile?.username ?? "Usuário"}</div>}
        <div className={`max-w-[85%] rounded-2xl border border-border px-3 py-2 text-sm ${bubble}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground mb-1">{time}</div>
            {mine && !m.id.startsWith("temp_") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Opções da mensagem">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {m.message_type === "text" && (
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingId(m.id);
                        setEditingText(m.content);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => void deleteMessage(m.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {m.message_type === "image" && m.media_url ? (
            <AsyncImage path={m.media_url} alt={m.file_name ?? "Imagem"} />
          ) : m.message_type === "audio" && m.media_url ? (
            <AsyncAudio path={m.media_url} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{linkify(m.content)}</div>
          )}
        </div>
      </div>
    );
  };

  if (!activeGroupId) {
    return (
      <div className="h-full w-full bg-background">
        <div className="p-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Defina um grupo ativo antes de usar o chat.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background overflow-hidden flex flex-col">
      {mode === "panel" && (
        <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">Chat</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {activeConversation?.kind === "group" ? "Grupo" : "Privado"}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setPreferredOpenMode("page");
              closeChatPanel();
              navigate("/chat");
            }}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Tela cheia
          </Button>
        </div>
      )}

      <div className={"flex-1 min-h-0 " + (mode === "panel" ? "p-2" : "px-3 md:px-6 lg:px-8 py-4 md:py-6")}>
        <div
          className={
            "grid gap-3 h-full min-h-0 " +
            (isCompactPanel
              ? isDockCollapsed
                ? "grid-cols-[76px_1fr]"
                : "grid-cols-[240px_1fr]"
              : "grid-cols-1 md:grid-cols-[280px_1fr] gap-4")
          }
        >
          <Card className="min-h-0 flex flex-col">
            <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
              <div className={"text-sm font-semibold " + (isDockCollapsed ? "sr-only" : "")}>Conversas</div>
              {isCompactPanel && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setDockExpanded((v) => !v)}
                        aria-label={dockExpanded ? "Recolher conversas" : "Expandir conversas"}
                      >
                        <PanelRight className={"h-4 w-4 transition-transform " + (dockExpanded ? "rotate-180" : "")}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {dockExpanded ? "Recolher" : "Expandir"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size={isDockCollapsed ? "icon" : "sm"}
                    className={isDockCollapsed ? "h-9 w-9" : "h-8"}
                    onClick={() => void loadMemberCandidates().catch(() => toast.error("Não foi possível listar membros."))}
                  >
                    {isDockCollapsed ? <Plus className="h-4 w-4" /> : "Novo DM"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Iniciar conversa privada</DialogTitle>
                    <DialogDescription>Escolha um membro do seu grupo para iniciar um DM.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} placeholder="Buscar membro..." />
                    <ScrollArea className="h-[320px] pr-2">
                      <div className="space-y-2">
                        {filteredMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 hover:bg-accent/40 transition-colors text-left"
                            onClick={() => {
                              void startDm(m.id).catch(() => toast.error("Não foi possível criar a conversa."));
                              setMemberDialogOpen(false);
                            }}
                          >
                            <Avatar className="h-8 w-8 border border-border">
                              <AvatarImage src={m.avatar_url ?? undefined} />
                              <AvatarFallback className="bg-accent text-foreground text-xs font-semibold">
                                {m.username.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{m.username}</div>
                              <div className="text-[11px] text-muted-foreground">Privado</div>
                            </div>
                          </button>
                        ))}
                        {filteredMembers.length === 0 && <div className="text-sm text-muted-foreground">Nenhum membro encontrado.</div>}
                      </div>
                    </ScrollArea>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="min-h-0 p-3">
              {loadingConversations ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <ScrollArea className={(isCompactPanel ? "h-[calc(100vh-240px)]" : "h-[40vh] md:h-[calc(100vh-280px)]") + " pr-3"}>
                  <div className="space-y-2">
                    {conversations.map((c) => {
                      const label = c.kind === "group" ? c.title ?? "Geral" : c.title ?? "Privado";
                      const selected = c.id === activeConversationId;
                      const fallback = (label || "C").charAt(0).toUpperCase();

                      if (isDockCollapsed) {
                        return (
                          <TooltipProvider key={c.id} delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setActiveConversationId(c.id)}
                                  className={
                                    "w-full flex items-center justify-center rounded-2xl border transition-colors p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
                                    (selected ? "bg-accent border-border" : "bg-card border-border hover:bg-accent/40")
                                  }
                                >
                                  <Avatar className="h-10 w-10 border border-border">
                                    <AvatarImage src={undefined} />
                                    <AvatarFallback className="bg-accent text-foreground text-sm font-semibold">{fallback}</AvatarFallback>
                                  </Avatar>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <div className="text-sm font-medium">{label}</div>
                                <div className="text-[11px] text-muted-foreground">{c.kind === "group" ? "Grupo" : "Privado"}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      }

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveConversationId(c.id)}
                          className={
                            "w-full text-left rounded-xl border border-border px-3 py-2 transition-colors " +
                            (selected ? "bg-accent" : "bg-card hover:bg-accent/40")
                          }
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-border shrink-0">
                              <AvatarImage src={undefined} />
                              <AvatarFallback className="bg-accent text-foreground text-xs font-semibold">{fallback}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{label}</p>
                              <p className="text-[11px] text-muted-foreground">{c.kind === "group" ? "Grupo" : "Privado"}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {conversations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>}
                  </div>
                </ScrollArea>
              )}
            </div>
          </Card>

          <Card className="min-h-0 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border/60 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {activeConversation?.kind === "group" ? activeConversation?.title ?? "Geral" : "Conversa privada"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {activeConversation?.kind === "group" ? "Chat do grupo" : "Chat privado"}
                </div>
                {activeConversation?.kind === "dm" && dmOtherUserId && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {(() => {
                      const p = profilesById[dmOtherUserId];
                      const last = dmOtherPresence?.last_seen_at ? new Date(dmOtherPresence.last_seen_at) : null;
                      const isOnline = last ? Date.now() - last.getTime() <= 2 * 60 * 1000 : false;
                      if (isOnline) return `${p?.username ?? "Usuário"} • Online agora`;
                      if (last) return `${p?.username ?? "Usuário"} • Visto por último ${last.toLocaleString("pt-BR")}`;
                      return `${p?.username ?? "Usuário"}`;
                    })()}
                  </div>
                )}
                {typingUsers.some((t) => t.user_id !== user?.id && t.typing) && (
                  <div className="text-[11px] text-muted-foreground truncate">digitando…</div>
                )}
              </div>
              {mode === "page" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setPreferredOpenMode("panel");
                    openChatPanel();
                  }}
                >
                  <PanelRight className="h-4 w-4 mr-2" />
                  Painel
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1 p-3">
              {loadingMessages ? (
                <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
              ) : (
                <div className="space-y-3">
                  {messages.map(renderMessage)}
                  <div ref={bottomRef} />
                </div>
              )}
            </ScrollArea>

            <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-3">
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowEmoji((v) => !v)} aria-label="Emojis">
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => fileInputRef.current?.click()} aria-label="Enviar foto">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={recorder.recording ? "secondary" : "outline"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => void startOrStopRecording().catch((e) => {
                      console.error(e);
                      toast.error("Falha ao gravar/enviar áudio.");
                    })}
                    aria-label={recorder.recording ? "Parar gravação" : "Gravar áudio"}
                  >
                    {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex-1 min-w-0">
                  {showEmoji && (
                    <div className="mb-2 rounded-xl border border-border bg-popover p-2 shadow-[var(--shadow-card)]">
                      <div className="grid grid-cols-6 gap-1">
                        {emojiList.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="h-9 w-9 rounded-lg hover:bg-accent transition-colors text-lg"
                            onClick={() => setText((t) => t + e)}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                    className="h-10"
                  />
                </div>

                <Button type="button" className="h-10" onClick={() => void handleSendText()}>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void uploadAndSendFile(f, "image").catch((err) => {
                      console.error(err);
                      toast.error("Falha ao enviar foto.");
                    });
                  }}
                />
              </div>
              {!realtimeConnected && (
                <div className="mt-2 text-[11px] text-muted-foreground">Realtime desconectado — atualizando a cada 5s…</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AsyncImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ensureSignedUrl(path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <div className="text-sm text-muted-foreground">Carregando mídia…</div>;
  return <img src={url} alt={alt} loading="lazy" className="max-h-64 w-auto rounded-xl border border-border object-contain" />;
}

function AsyncAudio({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ensureSignedUrl(path)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <div className="text-sm text-muted-foreground">Carregando áudio…</div>;
  return <audio controls src={url} className="w-full" />;
}
