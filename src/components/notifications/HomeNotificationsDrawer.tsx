import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
};

function resolveNotificationHref(item: NotificationRow) {
  if (item.entity_type === "chat_message") {
    const conversationId =
      typeof item.metadata?.conversation_id === "string"
        ? item.metadata.conversation_id
        : null;
    if (conversationId) {
      return `/chat?conversationId=${encodeURIComponent(conversationId)}`;
    }
    return "/chat";
  }

  if (item.entity_type === "nota" && item.entity_id) {
    return `/notas/editar/${encodeURIComponent(item.entity_id)}`;
  }

  if (item.entity_type === "evento" && item.entity_id) {
    return `/calendario?eventId=${encodeURIComponent(item.entity_id)}`;
  }

  return "/configuracoes?section=notifications";
}

function SwipeNotificationItem({
  item,
  onOpen,
  onDelete,
}: {
  item: NotificationRow;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [startX, setStartX] = useState<number | null>(null);
  const [deltaX, setDeltaX] = useState(0);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    setStartX(event.clientX);
    setDeltaX(0);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (startX === null) return;
    const nextDelta = event.clientX - startX;
    setDeltaX(Math.max(-120, Math.min(120, nextDelta)));
  };

  const handlePointerEnd = () => {
    if (Math.abs(deltaX) > 72) {
      onDelete(item.id);
      setStartX(null);
      setDeltaX(0);
      return;
    }

    if (Math.abs(deltaX) < 12) {
      onOpen(item.id);
    }

    setStartX(null);
    setDeltaX(0);
  };

  const createdLabel = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-destructive">
        <Trash2 className="h-4 w-4" />
      </div>

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{ transform: `translateX(${deltaX}px)` }}
        className="relative z-10 w-full bg-card px-3 py-3 text-left transition-transform"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{item.title}</p>
          {!item.read_at && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
              Nova
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{item.message}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{createdLabel}</p>
      </button>
    </div>
  );
}

export function HomeNotificationsDrawer({ open, onOpenChange, userId }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, read_at, entity_type, entity_id, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(((data as any[]) ?? []) as NotificationRow[]);
    } catch (error) {
      console.error("[HomeNotificationsDrawer] loadNotifications", error);
      toast.error("Não foi possível carregar notificações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const markAsRead = async (id: string) => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: nowIso } : item)));

    const { error } = await supabase.from("notifications").update({ read_at: nowIso } as any).eq("id", id);
    if (error) {
      console.error("[HomeNotificationsDrawer] markAsRead", error);
      void loadNotifications();
    }
  };

  const handleOpenItem = async (id: string) => {
    const item = notifications.find((row) => row.id === id);
    if (!item) return;

    if (!item.read_at) {
      await markAsRead(item.id);
    }

    onOpenChange(false);
    navigate(resolveNotificationHref(item));
  };

  const handleDeleteItem = async (id: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      console.error("[HomeNotificationsDrawer] delete", error);
      setNotifications(previous);
      toast.error("Não foi possível excluir a notificação.");
      return;
    }

    toast.success("Notificação excluída.");
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[78vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Notificações
            {unreadCount > 0 ? (
              <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {unreadCount} nova{unreadCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </DrawerTitle>
          <DrawerDescription>Toque para abrir. Arraste para o lado para excluir.</DrawerDescription>
        </DrawerHeader>

        <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-2 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando notificações...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Você ainda não possui notificações.</p>
          ) : (
            notifications.map((item) => (
              <SwipeNotificationItem
                key={item.id}
                item={item}
                onOpen={handleOpenItem}
                onDelete={handleDeleteItem}
              />
            ))
          )}

          {!loading && notifications.length > 0 ? (
            <Button type="button" variant="outline" className="w-full mt-2" onClick={() => navigate("/configuracoes?section=notifications")}>
              Ver central completa
            </Button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
