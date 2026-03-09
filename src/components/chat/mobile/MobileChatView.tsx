import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Send,
  Smile,
  Square,
  Video,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useLongPress } from "@/hooks/useLongPress";

import type {
  ChatConversation,
  ChatMessage,
  ChatMessageType,
  ChatProfile,
} from "@/components/chat/types";

import { MobileBottomNav } from "@/components/MobileBottomNav";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatLastSeen(iso: string) {
  const last = new Date(iso);
  const diffMs = Date.now() - last.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin <= 1) return "visto agora";
  if (diffMin < 60) return `visto há ${diffMin} min`;
  return `visto ${last.toLocaleString("pt-BR")}`;
}

function useAutosizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // reset then grow
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 140); // ~até 5 linhas
    el.style.height = `${next}px`;
  }, [value]);

  return ref;
}

function ConversationAvatar({ label, avatarUrl }: { label: string; avatarUrl?: string | null }) {
  const fallback = (label || "C").charAt(0).toUpperCase();
  return (
    <Avatar className="h-9 w-9 border border-border shrink-0">
      <AvatarImage src={avatarUrl ?? undefined} />
      <AvatarFallback className="bg-accent text-foreground text-xs font-semibold">{fallback}</AvatarFallback>
    </Avatar>
  );
}

function ConversationRow({
  conversation,
  selected,
  label,
  subtitle,
  avatarUrl,
  onOpen,
  onDelete,
}: {
  conversation: ChatConversation;
  selected: boolean;
  label: string;
  subtitle: string;
  avatarUrl?: string | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const lp = useLongPress({
    thresholdMs: 500,
    onLongPress: () => {
      if (conversation.kind !== "dm") return;
      onDelete();
    },
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      {...lp}
      className={
        "w-full text-left rounded-2xl border border-border px-3 py-3 transition-colors " +
        (selected ? "bg-accent" : "bg-card hover:bg-accent/40")
      }
    >
      <div className="flex items-center gap-3">
        <ConversationAvatar label={label} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold truncate">{label}</div>
            <div className="text-[11px] text-muted-foreground">{conversation.kind === "group" ? "Grupo" : "DM"}</div>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>
    </button>
  );
}


type PollOption = {
  id: string;
  text: string;
  votes: number;
  percent?: number;
};

type PollPayload = {
  question: string;
  options: PollOption[];
  totalVotes?: number;
  chosenOptionId?: string | null;
};

type PollLiveState = {
  counts: Record<string, number>;
  total: number;
  myOptionId: string | null;
};

function safeParsePoll(content: string): PollPayload | null {
  try {
    const raw = JSON.parse(content);
    if (!raw || typeof raw !== "object") return null;

    const question = String((raw as any).question ?? (raw as any).title ?? "").trim();
    const rawOptions = (raw as any).options;
    if (!question || !Array.isArray(rawOptions) || rawOptions.length === 0) return null;

    const totalVotes = Number((raw as any).totalVotes ?? (raw as any).total_votes ?? NaN);
    const chosenOptionId = ((raw as any).chosenOptionId ?? (raw as any).myOptionId ?? (raw as any).selectedOptionId ?? null) as
      | string
      | null;

    const options: PollOption[] = rawOptions
      .map((o: any, idx: number) => {
        const id = String(o?.id ?? o?.key ?? idx);
        const text = String(o?.text ?? o?.label ?? "").trim();
        const votes = Number(o?.votes ?? o?.count ?? 0);
        const percent = o?.percent != null ? Number(o.percent) : undefined;
        if (!text) return null;
        return { id, text, votes: Number.isFinite(votes) ? votes : 0, percent: Number.isFinite(percent) ? percent : undefined };
      })
      .filter(Boolean) as PollOption[];

    if (options.length === 0) return null;

    return {
      question,
      options,
      totalVotes: Number.isFinite(totalVotes) ? totalVotes : undefined,
      chosenOptionId,
    };
  } catch {
    return null;
  }
}

function PollCard({
  payload,
  live,
  onVote,
  disabled,
}: {
  payload: PollPayload;
  live?: PollLiveState | null;
  onVote?: (optionId: string) => void;
  disabled?: boolean;
}) {
  const totalVotes = live?.total ?? payload.totalVotes ?? payload.options.reduce((acc, o) => acc + (Number.isFinite(o.votes) ? o.votes : 0), 0);
  const chosenOptionId = live?.myOptionId ?? payload.chosenOptionId ?? null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold leading-snug">{payload.question}</div>

      <div className="space-y-2">
        {payload.options.map((opt) => {
          const votes = live?.counts?.[String(opt.id)] ?? opt.votes ?? 0;
          const isChosen = chosenOptionId != null && String(chosenOptionId) === String(opt.id);
          const percent =
            opt.percent != null && live == null
              ? Math.max(0, Math.min(100, opt.percent))
              : totalVotes > 0
                ? Math.round((votes / totalVotes) * 100)
                : 0;

          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onVote?.(String(opt.id))}
              className={
                "w-full text-left rounded-xl border border-border px-3 py-2 transition-colors " +
                (isChosen ? "bg-accent" : "bg-background/40") +
                (disabled ? " opacity-80" : " hover:bg-accent/40")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium truncate">{opt.text}</div>
                <div className="text-[11px] text-muted-foreground shrink-0">
                  {votes} • {percent}%
                </div>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground">{totalVotes} voto(s)</div>
    </div>
  );
}

function parseReplyFromText(content: string):
  | {
      reply: { messageId: string | null; author: string; preview: string };
      body: string;
    }
  | { reply: null; body: string } {
  const trimmed = content ?? "";
  if (!trimmed.startsWith("↩")) return { reply: null, body: trimmed };

  const [firstLine, ...restLines] = trimmed.split("\n");
  const body = restLines.join("\n").trimStart();

  // formatos aceitos:
  // 1) "↩⟦<messageId>⟧ Nome: preview"
  // 2) "↩ Nome: preview" (legado)
  const m = firstLine.match(/^↩(?:⟦([^⟧]+)⟧)?\s*(.*)$/);
  const messageId = m?.[1] ? String(m[1]) : null;
  const rest = (m?.[2] ?? "").trim();

  const colonIdx = rest.indexOf(":");
  const author = colonIdx >= 0 ? rest.slice(0, colonIdx).trim() : "";
  const preview = colonIdx >= 0 ? rest.slice(colonIdx + 1).trim() : rest;

  return {
    reply: {
      messageId,
      author: author || "Mensagem",
      preview: preview || "",
    },
    body,
  };
}

function MessageBubble({
  message,
  mine,
  username,
  onLongPress,
  pollLive,
  onVotePoll,
  onJumpToMessage,
  highlighted,
}: {
  message: ChatMessage;
  mine: boolean;
  username: string;
  onLongPress?: (m: ChatMessage) => void;
  pollLive?: PollLiveState | null;
  onVotePoll?: (messageId: string, optionId: string) => void;
  onJumpToMessage?: (messageId: string) => void;
  highlighted?: boolean;
}) {
  const time = formatTime(message.created_at);
  const bubble = mine ? "bg-accent" : "bg-card";

  const pollPayload = message.message_type === "poll" ? safeParsePoll(message.content) : null;

  const lp = useLongPress({
    onLongPress: () => onLongPress?.(message),
    thresholdMs: 450,
  });

  const replyParsed = parseReplyFromText(message.content);
  const reply = replyParsed.reply;
  const body = replyParsed.body;

  return (
    <div className={"flex flex-col gap-1 " + (mine ? "items-end" : "items-start")} {...lp}>
      <div
        className={
          "text-[11px] px-1 font-semibold " +
          (mine ? "text-muted-foreground text-right" : "text-muted-foreground")
        }
      >
        {username}
      </div>

      <div
        className={
          "max-w-[85%] rounded-2xl border border-border px-3 py-2 text-sm " +
          bubble +
          (highlighted ? " ring-2 ring-primary/40" : "")
        }
      >
        {reply && (
          <div className="mb-1">
            <button
              type="button"
              disabled={!reply.messageId || !onJumpToMessage}
              onClick={() => {
                if (reply.messageId && onJumpToMessage) onJumpToMessage(reply.messageId);
              }}
              className={
                "w-full text-left rounded-xl border border-border/60 bg-background/40 px-2 py-1.5 " +
                (!reply.messageId || !onJumpToMessage ? "opacity-90" : "active:scale-[0.99]")
              }
              aria-label={reply.messageId ? "Ver mensagem respondida" : "Resposta"}
            >
              <div className="flex gap-2">
                <div className="w-1 rounded-full bg-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-foreground truncate">{reply.author}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{reply.preview}</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {pollPayload ? (
          <PollCard payload={pollPayload} live={pollLive} disabled={!onVotePoll} onVote={(optId) => onVotePoll?.(message.id, optId)} />
        ) : message.message_type === "image" && message.media_url ? (
          <AsyncImage path={message.media_url} alt={message.file_name ?? "Imagem"} />
        ) : message.message_type === "audio" && message.media_url ? (
          <AudioBubble
            path={message.media_url}
            mimeType={message.mime_type ?? undefined}
            durationMs={message.duration_ms ?? undefined}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words">{linkify(body)}</div>
        )}

        <div className={"mt-1 flex items-center gap-1 " + (mine ? "justify-end" : "justify-start")}>
          <span className="text-[11px] text-muted-foreground">{time}</span>
          {mine && <span className="text-[11px] text-muted-foreground">{message.id.startsWith("temp_") ? "" : "✓"}</span>}
        </div>
      </div>
    </div>
  );
}

export function MobileChatView({ layout = "mobile" }: { layout?: "mobile" | "desktop" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeGroupId, activeGroup } = useActiveGroup();

  const [screen, setScreen] = useState<"list" | "thread">("list");

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ChatProfile>>({});
  const [dmOtherByConversationId, setDmOtherByConversationId] = useState<Record<string, string>>({});

  const [pollLiveByMessageId, setPollLiveByMessageId] = useState<Record<string, PollLiveState>>({});

  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageActionsOpen, setMessageActionsOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; user_id: string; preview: string } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [usernameDialogOpen, setUsernameDialogOpen] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiList = ["😀", "😂", "😊", "😍", "🙏", "👍", "❤️", "🎉", "😢", "😡", "🤔", "🙌"];

  const [dmOtherUserId, setDmOtherUserId] = useState<string | null>(null);
  const [dmOtherPresence, setDmOtherPresence] = useState<{ last_seen_at: string } | null>(null);

  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  const [pollComposerOpen, setPollComposerOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const recorder = useAudioRecorder();
  const [holdingMic, setHoldingMic] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number | null>(null);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);

  const { typingUsers } = useTypingPresence({
    conversationId: activeConversationId,
    userId: user?.id ?? null,
    text,
  });

  const isDesktopLayout = layout === "desktop";

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const activeTitle = useMemo(() => {
    if (!activeConversation) return "Chat";
    if (activeConversation.kind === "group") return activeGroup?.name ?? activeConversation.title ?? "Geral";
    if (dmOtherUserId) return profilesById[dmOtherUserId]?.username ?? "Conversa";
    return "Conversa";
  }, [activeConversation, activeGroup?.name, dmOtherUserId, profilesById]);

  const resolveProfiles = async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter((id) => !profilesById[id]);
    if (unique.length === 0) return;
    const { data, error } = await supabase.from("profiles").select("id, username, avatar_url").in("id", unique).limit(200);
    if (error) return;
    const next: Record<string, ChatProfile> = {};
    (data as any as ChatProfile[]).forEach((p) => (next[p.id] = p));
    setProfilesById((prev) => ({ ...prev, ...next }));
  };

  const upsertIncomingMessage = (msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;

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

  const ensureMembership = async (conversationId: string) => {
    if (!user) return;
    const { error } = await supabase.from("chat_members").insert({ conversation_id: conversationId, user_id: user.id } as any);
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
      const list = (((data as any) ?? []) as ChatConversation[]);

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

      const defaultGroup = list.find((c) => c.kind === "group") ?? null;
      if (defaultGroup) {
        const { error: joinErr } = await supabase.from("chat_members").insert({
          conversation_id: defaultGroup.id,
          user_id: user.id,
        } as any);
        if (joinErr && (joinErr as any).code !== "23505") {
          console.warn("Falha ao entrar no chat padrão:", joinErr);
        }
      }

      // Resolver nomes de DMs (o outro participante)
      const dmIds = list.filter((c) => c.kind === "dm").map((c) => c.id);
      if (dmIds.length) {
        const { data: members, error: mErr } = await supabase
          .from("chat_members")
          .select("conversation_id, user_id")
          .in("conversation_id", dmIds)
          .limit(500);

        if (!mErr) {
          const map: Record<string, string> = {};
          const toResolve: string[] = [];
          (members as any[] | null)?.forEach((row) => {
            const cid = String(row.conversation_id);
            const uid = String(row.user_id);
            if (!cid || !uid) return;
            if (uid === user.id) return;
            if (!map[cid]) {
              map[cid] = uid;
              toResolve.push(uid);
            }
          });
          setDmOtherByConversationId(map);
          void resolveProfiles(toResolve);
        }
      } else {
        setDmOtherByConversationId({});
      }

      // aplica "ocultadas" (somente DM)
      let hidden = new Set<string>();
      try {
        const key = `chatHiddenDm:${activeGroupId}:${user.id}`;
        hidden = new Set<string>((JSON.parse(window.localStorage.getItem(key) || "[]") as string[]) ?? []);
      } catch {
        // ignore
      }

      const visible = list.filter((c) => c.kind !== "dm" || !hidden.has(c.id));

      setConversations(visible);
      setActiveConversationId((prev) => {
        if (prev && visible.some((c) => c.id === prev)) return prev;
        return visible[0]?.id ?? null;
      });
    } finally {
      setLoadingConversations(false);
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
    const { data, error } = await supabase.from("chat_members").select("user_id").eq("conversation_id", conversationId).limit(10);
    if (error) return;
    const ids = ((data as any[]) ?? []).map((r) => r.user_id).filter(Boolean);
    const other = ids.find((id) => id !== user.id) ?? null;
    setDmOtherUserId(other);
    if (other) {
      void resolveProfiles([other]);
      void refreshPresenceForUser(other);
    }
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

  const sendMessage = async (payload: {
    type: ChatMessageType;
    content: string;
    mediaPath?: string;
    mime?: string;
    fileName?: string;
    durationMs?: number;
  }) => {
    if (!user) return;
    if (!activeConversationId) return;

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
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }

    if (data) upsertIncomingMessage(data as any);
    void markRead(activeConversationId);
  };

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const replyPrefix = replyTo
      ? `↩⟦${replyTo.id}⟧ ${messageUserName(replyTo.user_id)}: ${replyTo.preview}\n`
      : "";

    const content = replyPrefix + trimmed;

    setText("");
    setReplyTo(null);

    try {
      await sendMessage({ type: "text", content });
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível enviar.");
      setText(trimmed);
    }
  };

  const uploadAndSendFile = async (file: File, type: ChatMessageType) => {
    if (!user || !activeGroupId || !activeConversationId) return;

    const currentReply = replyTo;
    const replyPrefix = currentReply ? `↩⟦${currentReply.id}⟧ ${messageUserName(currentReply.user_id)}: ${currentReply.preview}\n` : "";

    const ext = file.name.split(".").pop() || "bin";
    const path = `${activeGroupId}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-media").upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (upErr) throw upErr;

    // limpa só quando o upload já foi ok
    setReplyTo(null);

    const baseLabel = type === "image" ? "📷 Foto" : type === "audio" ? "🎤 Áudio" : "📎 Arquivo";

    try {
      await sendMessage({
        type,
        content: replyPrefix + baseLabel,
        mediaPath: path,
        mime: file.type,
        fileName: file.name,
      });
    } catch (e) {
      // restaura reply se falhar o envio do registro no DB
      setReplyTo(currentReply);
      throw e;
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
    const params = new URLSearchParams(location.search);
    const deepLinkConversationId = params.get("conversationId");
    if (!deepLinkConversationId) return;
    if (!conversations.some((c) => c.id === deepLinkConversationId)) return;

    setActiveConversationId(deepLinkConversationId);
    setScreen("thread");

    params.delete("conversationId");
    const next = params.toString();
    navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
  }, [conversations, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    void resolveProfiles([user.id]);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const current = profilesById[user.id]?.username ?? "";
    setUsernameDraft((prev) => (prev ? prev : current));
  }, [user?.id, profilesById]);

  useEffect(() => {
    if (!activeConversationId) return;

    const pollMessageIds = messages
      .filter((m) => m.message_type === "poll" && !m.id.startsWith("temp_"))
      .map((m) => m.id);

    if (pollMessageIds.length === 0) return;

    let cancelled = false;

    const hydrate = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("chat_poll_votes")
        .select("message_id, user_id, option_id")
        .in("message_id", pollMessageIds)
        .limit(1000);

      if (error || cancelled) return;

      const next: Record<string, PollLiveState> = {};
      (data as any[] | null)?.forEach((row) => {
        const mid = String(row.message_id);
        const opt = String(row.option_id);
        const uid = String(row.user_id);
        if (!next[mid]) next[mid] = { counts: {}, total: 0, myOptionId: null };
        next[mid].counts[opt] = (next[mid].counts[opt] ?? 0) + 1;
        next[mid].total += 1;
        if (uid === user.id) next[mid].myOptionId = opt;
      });

      setPollLiveByMessageId((prev) => ({ ...prev, ...next }));
    };

    void hydrate();

    const channel = supabase
      .channel(`poll-votes:${activeConversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_poll_votes" },
        (payload) => {
          const row: any = (payload.new ?? payload.old) as any;
          const mid = String(row?.message_id ?? "");
          if (!mid || !pollMessageIds.includes(mid)) return;
          void hydrate();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, messages, user?.id]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

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
      .subscribe();

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

  const [memberCandidates, setMemberCandidates] = useState<ChatProfile[]>([]);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");

  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState<ChatProfile[]>([]);

  const loadGroupInfo = async () => {
    if (!activeGroupId) return;
    setGroupInfoLoading(true);
    try {
      const { data: gms, error: gmErr } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", activeGroupId)
        .limit(300);
      if (gmErr) throw gmErr;
      const ids = ((gms as any[]) ?? []).map((x) => x.user_id).filter(Boolean);
      if (!ids.length) {
        setGroupParticipants([]);
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids)
        .limit(300);
      if (pErr) throw pErr;
      setGroupParticipants(((profs as any) ?? []) as ChatProfile[]);
    } finally {
      setGroupInfoLoading(false);
    }
  };

  const loadMemberCandidates = async () => {
    if (!activeGroupId || !user) return;
    const { data: gms, error: gmErr } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", activeGroupId)
      .limit(300);
    if (gmErr) throw gmErr;
    const ids = ((gms as any[]) ?? []).map((x) => x.user_id).filter((id) => id !== user.id);
    if (!ids.length) {
      setMemberCandidates([]);
      return;
    }
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", ids)
      .limit(300);
    if (pErr) throw pErr;
    setMemberCandidates(((profs as any) ?? []) as ChatProfile[]);
  };

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase();
    if (!q) return memberCandidates;
    return memberCandidates.filter((m) => m.username.toLowerCase().includes(q));
  }, [memberCandidates, memberFilter]);

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
        setScreen("thread");
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
    setScreen("thread");
  };

  const otherStatus = useMemo(() => {
    if (activeConversation?.kind !== "dm" || !dmOtherUserId) return null;
    const last = dmOtherPresence?.last_seen_at ?? null;
    if (!last) return "";
    const lastDate = new Date(last);
    const isOnline = Date.now() - lastDate.getTime() <= 2 * 60 * 1000;
    if (isOnline) return "online";
    return formatLastSeen(last);
  }, [activeConversation?.kind, dmOtherUserId, dmOtherPresence?.last_seen_at]);

  const typingLine = useMemo(() => {
    const someoneElseTyping = typingUsers.some((t) => t.user_id !== user?.id && t.typing);
    return someoneElseTyping ? "digitando…" : null;
  }, [typingUsers, user?.id]);

  const messageUserName = (id: string) => profilesById[id]?.username ?? "Usuário";

  const jumpToMessage = (messageId: string) => {
    const el = messageElsRef.current.get(messageId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1400);
  };
  const voteInPoll = async (messageId: string, optionId: string) => {
    if (!user?.id) return;

    // optimistic
    setPollLiveByMessageId((prev) => {
      const current = prev[messageId] ?? { counts: {}, total: 0, myOptionId: null };
      const nextCounts = { ...current.counts };

      const prevOpt = current.myOptionId;
      if (prevOpt) {
        nextCounts[prevOpt] = Math.max(0, (nextCounts[prevOpt] ?? 0) - 1);
      }

      nextCounts[optionId] = (nextCounts[optionId] ?? 0) + 1;

      const total = Object.values(nextCounts).reduce((a, b) => a + b, 0);
      return { ...prev, [messageId]: { counts: nextCounts, total, myOptionId: optionId } };
    });

    const { error } = await supabase
      .from("chat_poll_votes")
      .upsert(
        { message_id: messageId, user_id: user.id, option_id: optionId } as any,
        { onConflict: "message_id,user_id" },
      );

    if (error) {
      console.error(error);
      toast.error("Não foi possível votar.");
      // re-hidrata na próxima mudança do realtime / efeito
    }
  };

  const openMessageActions = (m: ChatMessage) => {
    setSelectedMessage(m);
    setMessageActionsOpen(true);
  };

  const textareaRef = useAutosizeTextarea(text);

  const openThread = (id: string) => {
    setActiveConversationId(id);
    setScreen("thread");
    // garante scroll para baixo ao abrir
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
  };

  useEffect(() => {
    if (!recorder.recording || recordStartedAt == null) return;
    const t = window.setInterval(() => {
      setRecordElapsedMs(Date.now() - recordStartedAt);
    }, 200);
    return () => window.clearInterval(t);
  }, [recordStartedAt, recorder.recording]);

  const startHoldRecording = async () => {
    if (!recorder.supported) {
      toast.error("Seu navegador não suporta gravação.");
      return;
    }
    setHoldingMic(true);
    setRecordStartedAt(Date.now());
    setRecordElapsedMs(0);
    await recorder.start();
    if (recorder.error) toast.error(recorder.error);
  };

  const stopHoldRecording = async () => {
    setHoldingMic(false);
    setRecordStartedAt(null);
    setRecordElapsedMs(0);
    if (!recorder.recording) return;
    try {
      const result = await recorder.stop();
      if (!result) return;
      if (!activeConversationId) return;
      const file = new File([result.blob], result.fileName, { type: result.mimeType });
      await uploadAndSendFile(file, "audio");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gravar/enviar áudio.");
    }
  };

  if (!activeGroupId) {
    return (
      <div className={(isDesktopLayout ? "h-full" : "h-[100dvh]") + " w-full bg-background"}>
        <div className="p-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Defina um grupo ativo antes de usar o chat.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={(isDesktopLayout ? "h-full" : "h-[100dvh]") + " w-full bg-background overflow-hidden"}>
      <div className="h-full flex flex-col">
        {screen === "list" ? (
          <>
            {/* Header fixo (lista) */}
            <header className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => navigate("/")}
                    aria-label="Voltar para o início"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{activeGroup?.name ?? "Chat"}</div>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground truncate hover:underline"
                      onClick={() => setUsernameDialogOpen(true)}
                    >
                      {profilesById[user?.id ?? ""]?.username
                        ? `Você: ${profilesById[user?.id ?? ""]?.username}`
                        : "Definir nome de usuário"}
                    </button>
                  </div>
                </div>

                <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => void loadMemberCandidates().catch(() => toast.error("Não foi possível listar membros."))}
                      aria-label="Nova conversa"
                    >
                      <Plus className="h-4 w-4" />
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
                              <ConversationAvatar label={m.username} avatarUrl={m.avatar_url} />
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
            </header>

            {/* Lista */}
            <main className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className={"p-3 space-y-2 " + (isDesktopLayout ? "pb-4" : "pb-28")}>
                  {loadingConversations ? (
                    <p className="text-sm text-muted-foreground">Carregando...</p>
                  ) : (
                    conversations.map((c) => {
                      const otherId = c.kind === "dm" ? dmOtherByConversationId[c.id] ?? null : null;
                      const dmName = otherId ? profilesById[otherId]?.username ?? "Privado" : "Privado";
                      const groupName = activeGroup?.name ?? c.title ?? "Geral";

                      const label = c.kind === "group" ? groupName : dmName;
                      const subtitle = c.kind === "group" ? "Grupo" : groupName;
                      const selected = c.id === activeConversationId;

                      return (
                        <ConversationRow
                          key={c.id}
                          conversation={c}
                          selected={selected}
                          label={label}
                          subtitle={subtitle}
                          avatarUrl={otherId ? profilesById[otherId]?.avatar_url : null}
                          onOpen={() => openThread(c.id)}
                          onDelete={() => {
                            const ok = window.confirm(`Excluir conversa com ${label}? (apenas para você)`);
                            if (!ok) return;
                            // Sem DELETE no schema atual (RLS bloqueia). Mantemos como "ocultar" local.
                            try {
                              const key = `chatHiddenDm:${activeGroupId}:${user?.id}`;
                              const raw = window.localStorage.getItem(key);
                              const set = new Set<string>((raw ? JSON.parse(raw) : []) as string[]);
                              set.add(c.id);
                              window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
                            } catch {
                              // ignore
                            }
                            setConversations((prev) => prev.filter((x) => x.id !== c.id));
                            if (activeConversationId === c.id) {
                              setActiveConversationId(null);
                            }
                            toast.success("Conversa removida da sua lista.");
                          }}
                        />
                      );
                    })
                  )}

                  {!loadingConversations && conversations.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma conversa.</p>
                  )}
                </div>
              </ScrollArea>
            </main>

            {!isDesktopLayout && <MobileBottomNav />}
          </>
        ) : (
          <>
            {/* Header fixo (thread) */}
            <header className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2 py-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setScreen("list")}
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <ConversationAvatar
                  label={activeTitle}
                  avatarUrl={dmOtherUserId ? profilesById[dmOtherUserId]?.avatar_url : null}
                />

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{activeTitle}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {typingLine ?? otherStatus ?? (activeConversation?.kind === "group" ? "Grupo" : "")}
                  </div>
                </div>

                <Dialog
                  open={groupInfoOpen}
                  onOpenChange={(open) => {
                    setGroupInfoOpen(open);
                    if (open && activeConversation?.kind === "group") {
                      void loadGroupInfo().catch(() => toast.error("Não foi possível carregar dados do grupo."));
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label="Opções">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{activeGroup?.name ?? "Grupo"}</DialogTitle>
                      <DialogDescription>{activeGroup?.description ?? ""}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-card p-3">
                        <div className="text-xs font-semibold text-foreground">Participantes</div>
                        <div className="text-[11px] text-muted-foreground">
                          {groupInfoLoading ? "Carregando…" : `${groupParticipants.length} participante(s)`}
                        </div>
                      </div>

                      <ScrollArea className="h-[320px] pr-2">
                        <div className="space-y-2">
                          {groupParticipants.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                              <ConversationAvatar label={p.username} avatarUrl={p.avatar_url} />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{p.username}</div>
                              </div>
                            </div>
                          ))}
                          {!groupInfoLoading && groupParticipants.length === 0 && (
                            <div className="text-sm text-muted-foreground">Nenhum participante.</div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </header>

            {/* Mensagens */}
            <main className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-3">
                  {loadingMessages ? (
                    <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        ref={(el) => {
                          if (el) messageElsRef.current.set(m.id, el);
                          else messageElsRef.current.delete(m.id);
                        }}
                        className="scroll-mt-16"
                      >
                        <MessageBubble
                          message={m}
                          mine={m.user_id === user?.id}
                          username={messageUserName(m.user_id)}
                          onLongPress={openMessageActions}
                          pollLive={m.message_type === "poll" ? pollLiveByMessageId[m.id] ?? null : null}
                          onVotePoll={m.message_type === "poll" ? voteInPoll : undefined}
                          onJumpToMessage={jumpToMessage}
                          highlighted={highlightedMessageId === m.id}
                        />
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
            </main>

            {/* Input fixo */}
            <footer className={"shrink-0 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-2 pt-2 " + (isDesktopLayout ? "pb-2" : "pb-[calc(env(safe-area-inset-bottom)+0.5rem)]")}>
              {(holdingMic || recorder.recording) && (
                <div className="mb-2 rounded-2xl border border-border bg-card px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full border border-border bg-background flex items-center justify-center shrink-0">
                        <Mic className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-foreground">Gravando áudio…</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {`${Math.floor(recordElapsedMs / 60000)}:${String(Math.floor((recordElapsedMs % 60000) / 1000)).padStart(2, "0")}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" aria-hidden>
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse [animation-delay:120ms]" />
                      <span className="h-2 w-2 rounded-full bg-primary/40 animate-pulse [animation-delay:240ms]" />
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">Segure para gravar • solte para enviar</div>
                </div>
              )}

              {replyTo && (
                <button
                  type="button"
                  onClick={() => jumpToMessage(replyTo.id)}
                  className="mb-2 w-full text-left rounded-2xl border border-border bg-card px-3 py-2"
                  aria-label="Mensagem respondida"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <div className="w-1 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-foreground truncate">Respondendo {messageUserName(replyTo.user_id)}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{replyTo.preview}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReplyTo(null);
                      }}
                      aria-label="Cancelar resposta"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </button>
              )}

              {showEmoji && (
                <div className="mb-2 rounded-2xl border border-border bg-popover px-2 py-2">
                  <div className="grid grid-cols-8 gap-1">
                    {emojiList.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="h-9 w-9 rounded-xl hover:bg-accent transition-colors text-lg"
                        onClick={() => setText((t) => t + e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-2xl"
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label="Emojis"
                >
                  <Smile className="h-4 w-4" />
                </Button>

                <Popover open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 rounded-2xl"
                      aria-label="Anexos"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" sideOffset={10} className="w-60 p-2 rounded-2xl">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-3 flex flex-col items-center justify-center gap-1"
                        onClick={() => {
                          setAttachmentsOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[11px] font-medium text-muted-foreground">Imagem</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-3 flex flex-col items-center justify-center gap-1"
                        onClick={() => toast.message("Envio de arquivo em breve")}
                      >
                        <FileText className="h-5 w-5" />
                        <span className="text-[11px] font-medium text-muted-foreground">Arquivo</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-3 flex flex-col items-center justify-center gap-1"
                        onClick={() => toast.message("Envio de vídeo em breve")}
                      >
                        <Video className="h-5 w-5" />
                        <span className="text-[11px] font-medium text-muted-foreground">Vídeo</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors p-3 flex flex-col items-center justify-center gap-1"
                        onClick={() => {
                          setAttachmentsOpen(false);
                          setPollQuestion("");
                          setPollOptions(["", ""]);
                          setPollComposerOpen(true);
                        }}
                      >
                        <div className="h-5 w-5 text-sm font-semibold">%</div>
                        <span className="text-[11px] font-medium text-muted-foreground">Enquete</span>
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="flex-1 min-w-0">
                  <Textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Mensagem"
                    className="min-h-[40px] max-h-[140px] resize-none rounded-2xl"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendText();
                      }
                    }}
                  />
                </div>

                <Button
                  type="button"
                  variant={holdingMic || recorder.recording ? "secondary" : "outline"}
                  size="icon"
                  className="h-10 w-10 rounded-2xl"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void startHoldRecording();
                  }}
                  onPointerUp={(e) => {
                    e.preventDefault();
                    void stopHoldRecording();
                  }}
                  onPointerCancel={() => void stopHoldRecording()}
                  aria-label={recorder.recording ? "Gravando" : "Gravar áudio"}
                >
                  {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button type="button" className="h-10 rounded-2xl" onClick={() => void handleSendText()} aria-label="Enviar">
                  <Send className="h-4 w-4" />
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
            </footer>

            {/* Composer de enquete (WhatsApp-like) */}
            <Dialog open={pollComposerOpen} onOpenChange={setPollComposerOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Criar enquete</DialogTitle>
                  <DialogDescription>Adicione uma pergunta e pelo menos 2 opções.</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-foreground">Pergunta</div>
                    <Input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Qual opção você prefere?"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-foreground">Opções</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPollOptions((prev) => (prev.length >= 6 ? prev : [...prev, ""]));
                        }}
                      >
                        Adicionar
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPollOptions((prev) => prev.map((p, i) => (i === idx ? v : p)));
                            }}
                            placeholder={`Opção ${idx + 1}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => {
                              setPollOptions((prev) => {
                                if (prev.length <= 2) return prev;
                                return prev.filter((_, i) => i !== idx);
                              });
                            }}
                            aria-label="Remover opção"
                            disabled={pollOptions.length <= 2}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-muted-foreground">Máximo 6 opções.</div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setPollComposerOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const question = pollQuestion.trim();
                        const options = pollOptions.map((o) => o.trim()).filter(Boolean);
                        if (!question) {
                          toast.error("Digite a pergunta.");
                          return;
                        }
                        if (options.length < 2) {
                          toast.error("Adicione pelo menos 2 opções.");
                          return;
                        }

                        const payload: PollPayload = {
                          question,
                          options: options.map((text, i) => ({ id: String(i + 1), text, votes: 0 })),
                          totalVotes: 0,
                          chosenOptionId: null,
                        };

                        const currentReply = replyTo;
                        const replyPrefix = currentReply
                          ? `↩⟦${currentReply.id}⟧ ${messageUserName(currentReply.user_id)}: ${currentReply.preview}\n`
                          : "";

                        setReplyTo(null);

                        void sendMessage({ type: "poll", content: replyPrefix + JSON.stringify(payload) })
                          .then(() => {
                            setPollComposerOpen(false);
                          })
                          .catch((e) => {
                            console.error(e);
                            setReplyTo(currentReply);
                            toast.error("Não foi possível enviar a enquete.");
                          });
                      }}
                    >
                      Enviar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Alterar nome de usuário (afeta o app todo, mas UI aqui é mobile) */}
        <Dialog open={usernameDialogOpen} onOpenChange={setUsernameDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nome de usuário</DialogTitle>
              <DialogDescription>Esse nome aparece no chat e no app.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                value={usernameDraft}
                onChange={(e) => setUsernameDraft(e.target.value)}
                placeholder="Seu nome"
              />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUsernameDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const next = usernameDraft.trim();
                    if (!next) {
                      toast.error("Digite um nome.");
                      return;
                    }
                    if (!user?.id) return;
                    void supabase
                      .from("profiles")
                      .update({ username: next } as any)
                      .eq("id", user.id)
                      .then(({ error }) => {
                        if (error) {
                          console.error(error);
                          toast.error("Não foi possível salvar.");
                          return;
                        }
                        setProfilesById((prev) => ({
                          ...prev,
                          [user.id]: {
                            id: user.id,
                            username: next,
                            avatar_url: prev[user.id]?.avatar_url ?? null,
                          },
                        }));
                        toast.success("Nome atualizado!");
                        setUsernameDialogOpen(false);
                      });
                  }}
                >
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ações da mensagem (WhatsApp-like) */}
        <Dialog open={messageActionsOpen} onOpenChange={setMessageActionsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ações</DialogTitle>
              <DialogDescription>Toque em uma ação.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  if (!selectedMessage) return;
                  const poll = selectedMessage.message_type === "poll" ? safeParsePoll(selectedMessage.content) : null;
                  const txt = poll
                    ? `${poll.question}\n${poll.options.map((o) => `- ${o.text}`).join("\n")}`
                    : selectedMessage.content;
                  void navigator.clipboard
                    .writeText(txt)
                    .then(() => toast.success("Copiado!"))
                    .catch(() => toast.error("Não foi possível copiar."));
                  setMessageActionsOpen(false);
                }}
              >
                Copiar
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  if (!selectedMessage) return;
                  const preview =
                    selectedMessage.message_type === "poll"
                      ? safeParsePoll(selectedMessage.content)?.question ?? "Enquete"
                      : selectedMessage.message_type === "audio"
                        ? "Áudio"
                        : selectedMessage.message_type === "image"
                          ? "Imagem"
                          : selectedMessage.content;
                  setReplyTo({
                    id: selectedMessage.id,
                    user_id: selectedMessage.user_id,
                    preview: String(preview).slice(0, 140),
                  });
                  setMessageActionsOpen(false);
                }}
              >
                Responder
              </Button>

              <Button
                type="button"
                variant="destructive"
                className="w-full justify-start"
                disabled={!selectedMessage || selectedMessage.user_id !== user?.id || selectedMessage.id.startsWith("temp_")}
                onClick={() => {
                  const m = selectedMessage;
                  if (!m || !user?.id) return;
                  setMessageActionsOpen(false);
                  setMessages((prev) => prev.filter((x) => x.id !== m.id));
                  void supabase
                    .from("chat_messages")
                    .delete()
                    .eq("id", m.id)
                    .then(({ error }) => {
                      if (error) {
                        console.error(error);
                        toast.error("Não foi possível excluir.");
                        void loadMessages(activeConversationId!, { silent: true });
                        return;
                      }
                      toast.success("Mensagem excluída.");
                    });
                }}
              >
                Excluir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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

function AudioBubble({
  path,
  mimeType,
  durationMs,
}: {
  path: string;
  mimeType?: string;
  durationMs?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number>(durationMs != null ? Math.max(0, durationMs / 1000) : 0);

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

  const format = (s: number) => {
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  const sync = () => {
    const el = audioRef.current;
    if (!el) return;
    const d = Number.isFinite(el.duration) ? el.duration : 0;
    const t = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    if (d > 0) setDuration(d);
    setProgress(d > 0 ? Math.min(1, Math.max(0, t / d)) : 0);
    rafRef.current = requestAnimationFrame(sync);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!url) return <div className="text-sm text-muted-foreground">Carregando áudio…</div>;

  return (
    <div className="w-[270px] max-w-full">
      <audio
        key={url}
        ref={audioRef}
        preload="metadata"
        playsInline
        onPlay={() => {
          setPlaying(true);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(sync);
        }}
        onPause={() => {
          setPlaying(false);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          const el = audioRef.current;
          if (el) el.currentTime = 0;
        }}
        onLoadedMetadata={() => {
          const el = audioRef.current;
          if (!el) return;
          if (Number.isFinite(el.duration)) setDuration(el.duration);
        }}
        onError={() => {
          setPlaying(false);
        }}
        className="hidden"
      >
        <source src={url} type={mimeType || undefined} />
      </audio>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full shrink-0 bg-primary text-primary-foreground border-border/60 hover:bg-primary/90"
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (el.paused) {
              void el.play().catch((err) => {
                console.error("audio play failed", err);
                toast.error("Não foi possível reproduzir o áudio.");
              });
            } else {
              el.pause();
            }
          }}
          aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="flex-1 min-w-0">
          <div className="h-8 flex items-end gap-0.5 select-none" aria-hidden>
            {Array.from({ length: 22 }).map((_, i) => {
              const base = 3 + ((i * 7) % 14);
              const h = playing ? 6 + ((i * 11 + Math.round(progress * 100)) % 18) : base;
              return (
                <div
                  key={i}
                  className="w-1 rounded-full bg-secondary"
                  style={{ height: `${h}px` }}
                />
              );
            })}
            <div
              className="absolute"
              aria-hidden
            />
          </div>

          <div
            className="mt-1 h-2 w-full rounded-full bg-secondary overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            onClick={(e) => {
              const el = audioRef.current;
              if (!el || !duration) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const pct = Math.min(1, Math.max(0, x / rect.width));
              el.currentTime = pct * duration;
              setProgress(pct);
            }}
          >
            <div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>{format(progress * (duration || 0))}</span>
            <span>{format(duration || 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
