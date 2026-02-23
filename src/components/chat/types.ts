export type ChatConversation = {
  id: string;
  kind: "group" | "dm";
  group_id: string | null;
  title: string | null;
  created_at: string;
};

export type ChatMessageType = "text" | "image" | "audio" | "poll";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  message_type?: ChatMessageType;
  media_url?: string | null;
  mime_type?: string | null;
  file_name?: string | null;
  duration_ms?: number | null;
};

export type ChatProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};
