import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const DEFAULT_PREFS = {
  enabled: true,
  birthdays_enabled: true,
  notes_enabled: true,
  chat_enabled: true,
  group_requests_enabled: true,
  events_enabled: true,
};

type NotificationPrefs = typeof DEFAULT_PREFS;

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
};

interface NotificationSettingsSectionProps {
  compact?: boolean;
}

export function NotificationSettingsSection({ compact = false }: NotificationSettingsSectionProps) {
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const resolveNotificationHref = (item: NotificationRow) => {
    if (item.entity_type === "chat_message") {
      const conversationId = typeof item.metadata?.conversation_id === "string" ? item.metadata.conversation_id : null;
      if (conversationId) return `/chat?conversationId=${encodeURIComponent(conversationId)}`;
      return "/chat";
    }

    if (item.entity_type === "nota" && item.entity_id) {
      return `/notas/editar/${encodeURIComponent(item.entity_id)}`;
    }

    if (item.entity_type === "evento" && item.entity_id) {
      return `/calendario?eventId=${encodeURIComponent(item.entity_id)}`;
    }

    return "/configuracoes?section=notifications";
  };

  const loadPreferences = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notification_preferences")
      .select("enabled, birthdays_enabled, notes_enabled, chat_enabled, group_requests_enabled, events_enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[NotificationSettingsSection] loadPreferences", error);
      return;
    }

    if (!data) {
      await supabase.from("notification_preferences").upsert({ user_id: user.id, ...DEFAULT_PREFS } as any, {
        onConflict: "user_id",
      });
      setPrefs(DEFAULT_PREFS);
      return;
    }

    setPrefs({
      enabled: data.enabled ?? true,
      birthdays_enabled: data.birthdays_enabled ?? true,
      notes_enabled: data.notes_enabled ?? true,
      chat_enabled: data.chat_enabled ?? true,
      group_requests_enabled: data.group_requests_enabled ?? true,
      events_enabled: data.events_enabled ?? true,
    });
  };

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, type, created_at, read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(((data as any[]) ?? []) as NotificationRow[]);
    } catch (error) {
      console.error("[NotificationSettingsSection] loadNotifications", error);
      toast.error("Não foi possível carregar notificações.");
    } finally {
      setLoading(false);
    }
  };

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Este dispositivo não oferece suporte a notificações.");
      return false;
    }

    if (Notification.permission === "granted") return true;

    if (Notification.permission === "denied") {
      toast.error("Notificações bloqueadas. Ative novamente nas permissões do navegador.");
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success("Permissão de notificação ativada.");
      return true;
    }

    toast.error("Permissão de notificação não concedida.");
    return false;
  };

  const savePreference = async (next: Partial<NotificationPrefs>) => {
    if (!user) return;

    if (next.enabled === true) {
      const granted = await requestBrowserNotificationPermission();
      if (!granted) {
        setPrefs((prev) => ({ ...prev, enabled: false }));
        return;
      }
    }

    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...merged } as any, { onConflict: "user_id" });
      if (error) throw error;
    } catch (error) {
      console.error("[NotificationSettingsSection] savePreference", error);
      toast.error("Não foi possível salvar as preferências.");
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const markOneAsRead = async (id: string) => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read_at: nowIso } : item)));

    const { error } = await supabase.from("notifications").update({ read_at: nowIso } as any).eq("id", id);
    if (error) {
      console.error("[NotificationSettingsSection] markOneAsRead", error);
      toast.error("Não foi possível atualizar esta notificação.");
      void loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => ({ ...item, read_at: item.read_at ?? nowIso })));

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso } as any)
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("[NotificationSettingsSection] markAllAsRead", error);
      toast.error("Não foi possível marcar todas como lidas.");
      void loadNotifications();
      return;
    }

    toast.success("Notificações marcadas como lidas.");
  };

  useEffect(() => {
    if (!user) return;
    void Promise.all([loadPreferences(), loadNotifications()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user || !activeGroupId) return;
    void supabase.rpc("generate_today_birthday_notifications" as any, {
      _group_id: activeGroupId,
      _recipient_user_id: user.id,
    } as any);
  }, [activeGroupId, user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-settings:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const incoming = payload.new as NotificationRow;
            setNotifications((prev) => [incoming, ...prev.filter((row) => row.id !== incoming.id)].slice(0, 50));
            return;
          }

          if (payload.eventType === "UPDATE") {
            const incoming = payload.new as NotificationRow;
            setNotifications((prev) => prev.map((row) => (row.id === incoming.id ? incoming : row)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Card>
      <CardHeader className={compact ? "pb-3 pt-3 px-3" : undefined}>
        <CardTitle className={compact ? "text-sm flex items-center gap-2" : "flex items-center gap-2"}>
          <Bell className={compact ? "h-4 w-4" : "h-5 w-5"} />
          Notificações
          {unreadCount > 0 && <Badge className="ml-auto">{unreadCount}</Badge>}
        </CardTitle>
        <CardDescription className={compact ? "text-xs" : undefined}>
          Mensagens curtas e objetivas para aniversários, notas, chat, solicitações e eventos.
        </CardDescription>
      </CardHeader>

      <CardContent className={compact ? "space-y-4 pb-3 px-3" : "space-y-4"}>
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <Label className={compact ? "text-xs" : "text-sm"}>Ativar notificações</Label>
            <Switch checked={prefs.enabled} disabled={saving} onCheckedChange={(checked) => void savePreference({ enabled: checked })} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2">
              <Label className={compact ? "text-xs" : "text-sm"}>Aniversariantes</Label>
              <Switch
                checked={prefs.birthdays_enabled}
                disabled={saving || !prefs.enabled}
                onCheckedChange={(checked) => void savePreference({ birthdays_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className={compact ? "text-xs" : "text-sm"}>Notas criadas</Label>
              <Switch
                checked={prefs.notes_enabled}
                disabled={saving || !prefs.enabled}
                onCheckedChange={(checked) => void savePreference({ notes_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className={compact ? "text-xs" : "text-sm"}>Mensagens do chat</Label>
              <Switch
                checked={prefs.chat_enabled}
                disabled={saving || !prefs.enabled}
                onCheckedChange={(checked) => void savePreference({ chat_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className={compact ? "text-xs" : "text-sm"}>Solicitações de grupo</Label>
              <Switch
                checked={prefs.group_requests_enabled}
                disabled={saving || !prefs.enabled}
                onCheckedChange={(checked) => void savePreference({ group_requests_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 sm:col-span-2">
              <Label className={compact ? "text-xs" : "text-sm"}>Eventos criados</Label>
              <Switch
                checked={prefs.events_enabled}
                disabled={saving || !prefs.enabled}
                onCheckedChange={(checked) => void savePreference({ events_enabled: checked })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className={compact ? "text-xs font-medium" : "text-sm font-medium"}>Central de notificações</p>
            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              className={compact ? "h-7 text-xs" : undefined}
              disabled={unreadCount === 0}
              onClick={() => void markAllAsRead()}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          </div>

          {loading ? (
            <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>Carregando notificações...</p>
          ) : notifications.length === 0 ? (
            <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>Você ainda não possui notificações.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((item) => {
                const createdLabel = formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                });

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!item.read_at) void markOneAsRead(item.id);
                    }}
                    className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className={compact ? "text-xs font-semibold" : "text-sm font-semibold"}>{item.title}</p>
                      {!item.read_at && <Badge variant="secondary">Nova</Badge>}
                    </div>
                    <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>{item.message}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{createdLabel}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
