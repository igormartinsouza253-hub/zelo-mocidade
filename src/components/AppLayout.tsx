import React from "react";
import { ModernSidebar } from "@/components/ModernSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import {
  Home,
  Users,
  CalendarDays,
  Award,
  Settings,
  Sparkles,
  Search,
  Handshake,
  BarChart3,
  LogOut,
  ArrowLeft,
  MessageCircle,
  Bell,
} from "lucide-react";
import {
  SidebarPreferencesProvider,
  useSidebarPreferences,
} from "@/hooks/useSidebarPreferences";
import { DockPreferencesProvider } from "@/hooks/useDockPreferences";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { useIsMobile } from "@/hooks/use-mobile";
import logoSource from "@/assets/app-logo-aw.png";
import { ThemedLogo } from "@/components/ThemedLogo";
import { ThemePresetId } from "@/lib/theme-presets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { PageHeaderProvider, usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { ChatLauncherProvider } from "@/components/chat/ChatLauncherContext";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useUnreadChatCount } from "@/components/chat/useUnreadChatCount";
import { HomeNotificationsDrawer } from "@/components/notifications/HomeNotificationsDrawer";

interface AppLayoutProps {
  children: React.ReactNode;
}

const routeTitles: Record<string, { title: string; icon: any }> = {
  "/": { title: "Início - Reuniões de Jovem", icon: Home },
  "/membros": { title: "Membros", icon: Users },
  "/reunioes": { title: "Reuniões", icon: Handshake },
  "/calendario": { title: "Agenda", icon: CalendarDays },
  "/cargos": { title: "Cargos", icon: Award },
  "/estatisticas": { title: "Estatísticas", icon: BarChart3 },
  "/estatisticas-reunioes": { title: "Estatísticas", icon: BarChart3 },
  "/notas": { title: "Notas", icon: Sparkles },
  "/configuracoes": { title: "Configurações", icon: Settings },
  "/busca": { title: "Busca global", icon: Search },
  "/visitas": { title: "Visitas", icon: Handshake },
  "/chat": { title: "Chat", icon: Sparkles },
  "/grupo": { title: "Grupo gestor", icon: Users },
};

function resolveRoute(pathname: string) {
  if (pathname === "/") return routeTitles["/"];
  if (pathname.startsWith("/membros")) return routeTitles["/membros"];
  if (pathname.startsWith("/reunioes")) return routeTitles["/reunioes"];
  if (pathname.startsWith("/visitas")) return routeTitles["/visitas"];
  if (pathname.startsWith("/notas")) return routeTitles["/notas"];
  if (pathname.startsWith("/calendario")) return routeTitles["/calendario"];
  if (pathname.startsWith("/cargos")) return routeTitles["/cargos"];
  if (pathname.startsWith("/estatisticas")) return routeTitles["/estatisticas"];
  if (pathname.startsWith("/configuracoes")) return routeTitles["/configuracoes"];
  if (pathname.startsWith("/busca")) return routeTitles["/busca"];
  if (pathname.startsWith("/chat")) return routeTitles["/chat"];
  if (pathname.startsWith("/grupo")) return routeTitles["/grupo"];

  return routeTitles["/"];
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarPreferencesProvider>
      <DockPreferencesProvider>
        <PageHeaderProvider>
          <AppLayoutShell>{children}</AppLayoutShell>
        </PageHeaderProvider>
      </DockPreferencesProvider>
    </SidebarPreferencesProvider>
  );
}

function AppLayoutShell({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = resolveRoute(location.pathname);
  const { config } = usePageHeader();
  const effectiveTitle = (config?.title ?? currentRoute.title).split(" - ")[0];

  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const { activeGroupId, activeGroup, loading: loadingGroup } = useActiveGroup();
  const isViewportMobile = useIsMobile();
  // Arquitetura por breakpoint: Mobile (<md) e Desktop/Tablet (md+).
  const isMobileMode = isViewportMobile;
  // Exige grupo ativo para usar o app (exceto na tela de Grupo Gestor)
  useEffect(() => {
    if (!user) return;
    if (loadingGroup) return;
    if (location.pathname.startsWith("/grupo")) return;
    if (!activeGroupId) {
      navigate("/grupo", { replace: true });
    }
  }, [user, loadingGroup, activeGroupId, location.pathname, navigate]);

  const isDashboard = location.pathname === "/";
  const isChatRoute = location.pathname.startsWith("/chat");
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [hideMobileDockOverride, setHideMobileDockOverride] = useState(false);

  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [preferredOpenMode, setPreferredOpenModeState] = useState<"panel" | "page">(() => {
    if (typeof window === "undefined") return "panel";
    const raw = window.localStorage.getItem("chatPreferredOpenMode");
    return raw === "page" ? "page" : "panel";
  });

  // Permite que telas mobile peçam para esconder/mostrar a dock inferior.
  useEffect(() => {
    const handler = (event: Event) => {
      const e = event as CustomEvent<{ hidden?: boolean }>;
      setHideMobileDockOverride(!!e.detail?.hidden);
    };

    window.addEventListener("mobileDockVisibility", handler as EventListener);
    return () => window.removeEventListener("mobileDockVisibility", handler as EventListener);
  }, []);

  // Tenta travar em retrato quando o navegador/OS suporta (PWA/Android costuma suportar).
  useEffect(() => {
    if (!isMobileMode) return;

    const orientation = (screen as any)?.orientation;
    if (orientation?.lock) {
      void orientation.lock("portrait").catch(() => {
        // Nem todos os navegadores permitem — fallback é o overlay de landscape.
      });
    }
  }, [isMobileMode]);

  const setPreferredOpenMode = (mode: "panel" | "page") => {
    setPreferredOpenModeState(mode);
    try {
      window.localStorage.setItem("chatPreferredOpenMode", mode);
    } catch {
      // ignore
    }
  };

  const { count: unreadCount } = useUnreadChatCount();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const loadUnreadNotifications = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (!error && mounted) {
        setUnreadNotifications(count ?? 0);
      }
    };

    void loadUnreadNotifications();

    const channel = supabase
      .channel(`notification-badge:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void loadUnreadNotifications();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activeGroupId) return;

    const showDeviceNotification = async (incoming: { id?: string; title?: string; message?: string }) => {
      if (
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted" ||
        !incoming.title ||
        !incoming.message
      ) {
        return;
      }

      const notificationOptions: NotificationOptions = {
        body: incoming.message,
        tag: incoming.id ? `notification-${incoming.id}` : undefined,
        icon: "/pwa-192.png",
        badge: "/pwa-192.png",
        data: { url: "/configuracoes" },
      };

      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(incoming.title, notificationOptions);
          return;
        }
      } catch (error) {
        console.warn("Falha ao exibir notificação via Service Worker:", error);
      }

      new Notification(incoming.title, notificationOptions);
    };

    void supabase.rpc("generate_today_birthday_notifications" as any, {
      _group_id: activeGroupId,
      _recipient_user_id: user.id,
    } as any);

    const channel = supabase
      .channel(`mobile-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as { id?: string; title?: string; message?: string };
          if (!incoming?.title || !incoming?.message) return;

          if (document.visibilityState === "visible") {
            toast(incoming.title, { description: incoming.message });
          }

          void showDeviceNotification(incoming);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeGroupId]);

  // Heartbeat (presença por grupo): atualiza last_seen_at periodicamente no DB
  useEffect(() => {
    if (!user) return;
    if (!activeGroupId) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("group_user_presence")
          // primary key (group_id, user_id)
          .upsert(
            {
              group_id: activeGroupId,
              user_id: user.id,
              last_seen_at: nowIso,
            } as any,
            { onConflict: "group_id,user_id" },
          );
        if (error) throw error;
      } catch (e) {
        // Não bloqueia UI — apenas diagnóstico
        console.warn("Heartbeat: falha ao atualizar presença:", e);
      }
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void tick(), 30000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [user, activeGroupId]);

  // Presença online (mantido exatamente como antes)
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const onlineAt = new Date().toISOString();

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({
          user_id: user.id,
          username:
            user.user_metadata?.username ||
            user.email?.split("@")[0] ||
            "Usuário",
          email: user.email,
          online_at: onlineAt,
          last_active_at: new Date().toISOString(),
        });
      }
    });

    const updateLastActive = () => {
      void channel.track({
        user_id: user.id,
        username:
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Usuário",
        email: user.email,
        online_at: onlineAt,
        last_active_at: new Date().toISOString(),
      });
    };

    const activityEvents: (keyof DocumentEventMap)[] = [
      "visibilitychange",
      "pointermove",
      "keydown",
    ];

    activityEvents.forEach((event) => {
      window.addEventListener(event, updateLastActive);
    });

    const interval = window.setInterval(updateLastActive, 60000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, updateLastActive);
      });
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Aplica automaticamente o tema salvo como padrão para o usuário ao entrar no app
  useEffect(() => {
    if (!user) return;

    const applyUserTheme = async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("theme_preset, custom_theme")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error || !data) return;

        const rawPreset = (data.theme_preset as any) ?? "azul";
        const preset: ThemePresetId = [
          "azul",
          "laranja",
          "verde",
          "rosa",
          "roxo",
          "vermelho",
          "amarelo",
        ].includes(rawPreset)
          ? (rawPreset as ThemePresetId)
          : "azul";

        const customConfig = (data.custom_theme as any) || null;
        const { applyThemePreset } = await import("@/lib/theme-presets");
        applyThemePreset(preset, customConfig || undefined);
      } catch (error) {
        console.error("Erro ao aplicar tema padrão do usuário:", error);
      }
    };

    void applyUserTheme();
  }, [user]);

  // Detecção de orientação apenas no mobile
  useEffect(() => {
    if (!isMobileMode) {
      setIsLandscapeMobile(false);
      return;
    }

    const mql = window.matchMedia("(orientation: landscape)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsLandscapeMobile(event.matches);
    };

    setIsLandscapeMobile(mql.matches);
    mql.addEventListener("change", handleChange);

    return () => {
      mql.removeEventListener("change", handleChange);
    };
  }, [isMobileMode]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const shouldHideMobileDock = (pathname: string) => {
    if (pathname.startsWith("/membros/visualizar/")) return true;
    if (pathname === "/membros/novo") return true;
    if (pathname.startsWith("/membros/editar/")) return true;

    if (pathname === "/reunioes/nova") return true;
    // edição de reunião: /reunioes/:id
    if (/^\/reunioes\/[^/]+$/.test(pathname)) return true;
    // visualizar reunião: /reunioes/visualizar/:id
    if (/^\/reunioes\/visualizar\/[^/]+$/.test(pathname)) return true;

    // Visitas: criação/edição e visualização (mobile)
    if (pathname === "/visitas/nova") return true;
    // visualização: /visitas/:id
    if (/^\/visitas\/[^/]+$/.test(pathname) && pathname !== "/visitas/nova") return true;

    // Notas (mobile): o rodapé vira toolbar do editor
    if (pathname === "/notas/nova") return true;
    if (/^\/notas\/editar\/[^/]+$/.test(pathname)) return true;

    // Chat mobile: a barra inferior vira a barra de mensagens
    if (pathname.startsWith("/chat")) return true;

    return false;
  };

  const showMobileBackButton =
    location.pathname !== "/" && (config?.showBackButton ?? true);

  const handleMobileBack = () => {
    if (config?.backTo) {
      navigate(config.backTo);
    } else {
      navigate(-1);
    }
  };

  return (
    <ChatLauncherProvider
      value={{
        isChatPanelOpen,
        openChatPanel: () => setIsChatPanelOpen(true),
        closeChatPanel: () => setIsChatPanelOpen(false),
        preferredOpenMode,
        setPreferredOpenMode,
      }}
    >
      <div className="hidden md:flex fixed left-[6.5rem] top-3 z-50 h-10 items-center">
        <div className="rounded-lg border border-border/70 bg-card/90 p-1 shadow-[var(--shadow-card)]">
          <ThemedLogo
            src={logoSource}
            alt="Logo do app"
            className="h-7 w-auto object-contain rounded-md"
          />
        </div>
      </div>

       <div className="flex h-screen w-full bg-background md:bg-background md:pl-20 overflow-hidden">
        {/* Modern Sidebar - Desktop/Tablet only */}
        {!isMobileMode && <ModernSidebar />}

        {/* Main Content - respeita a margem da barra recolhida em telas grandes */}
         <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Mobile Top Header */}
            {isMobileMode &&
              !location.pathname.startsWith("/chat") &&
              // Visualização de visita tem header próprio (action bar)
              !(/^\/visitas\/[^/]+$/.test(location.pathname) && location.pathname !== "/visitas/nova") && (
                <div className="md:hidden sticky top-0 z-30 h-14 flex items-center px-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
                  <div className="flex items-center w-full gap-2">
                    {/* Voltar / Chat + título à esquerda */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {showMobileBackButton ? (
                        <button
                          type="button"
                          onClick={handleMobileBack}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
                          aria-label="Voltar"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                      ) : location.pathname === "/" ? (
                        <button
                          type="button"
                          onClick={() => navigate("/chat")}
                          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
                          aria-label="Abrir chat"
                        >
                          <MessageCircle className="h-4 w-4" />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="h-10 w-10" />
                      )}

                      <h1 className="text-sm font-semibold text-foreground truncate">
                        {effectiveTitle}
                      </h1>
                    </div>

                    {/* Ações + Perfil à direita */}
                    <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                      {config?.secondaryActions}

                      {location.pathname === "/" && (
                        <button
                          type="button"
                          onClick={() => setIsNotificationsDrawerOpen(true)}
                          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
                          aria-label="Abrir notificações"
                        >
                          <Bell className="h-4 w-4" />
                          {unreadNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                              {unreadNotifications > 99 ? "99+" : unreadNotifications}
                            </span>
                          )}
                        </button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors h-10 w-10"
                            aria-label="Conta"
                          >
                            <Avatar className="h-8 w-8 rounded-xl">
                              <AvatarImage className="rounded-xl" src={profile?.avatar_url || undefined} />
                              <AvatarFallback className="rounded-xl bg-accent text-foreground text-sm font-semibold">
                                {(profile?.username || user?.email || "U").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate("/configuracoes")}>Configurações</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={handleSignOut}>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sair
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              )}

          {/* Desktop Top Header */}
           {!isMobileMode && (
             <DesktopHeader
               currentRoute={currentRoute}
               user={user}
               profile={profile}
               navigate={navigate}
               handleSignOut={handleSignOut}
               locationPathname={location.pathname}
               onOpenChat={() => setIsChatPanelOpen(true)}
               unreadCount={unreadCount}
             />
           )}

          {/* Main Content */}
          <main
            className={`flex-1 min-h-0 min-w-0 ${
              isChatRoute
                ? "overflow-hidden p-0"
                : !isMobileMode && isDashboard
                  ? "overflow-hidden"
                  : "overflow-y-auto overflow-x-hidden"
            } ${isChatRoute ? "pb-0" : "p-3"} ${
              isChatRoute
                ? ""
                : isMobileMode && shouldHideMobileDock(location.pathname)
                  ? location.pathname === "/visitas/nova"
                    ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
                    : "pb-6"
                  : "pb-24"
            } md:px-6 md:pb-6 ${
              isMobileMode
                ? location.pathname === "/visitas/nova"
                  ? "scrollbar-none"
                  : "scrollbar-thin"
                : ""
            }`}
          >
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        {isMobileMode &&
          !shouldHideMobileDock(location.pathname) &&
          !hideMobileDockOverride && <MobileBottomNav />}
      </div>

      {/* Legenda global do grupo ativo (somente desktop/tablet) */}
      {!isMobileMode && (
        <div className="fixed left-3 bottom-20 md:left-4 md:bottom-4 z-40 pointer-events-none">
          <div className="pointer-events-auto w-[70vw] max-w-xs rounded-xl border border-border/70 bg-card/80 backdrop-blur-md shadow-[var(--shadow-card)]">
            <div className="px-3 py-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-muted-foreground">Grupo</span>
                <span className="text-[11px] font-semibold text-foreground/90 truncate">
                  {loadingGroup
                    ? "Carregando…"
                    : activeGroup?.name
                      ? activeGroup.name
                      : "Nenhum"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.id ? (
        <HomeNotificationsDrawer
          open={isNotificationsDrawerOpen}
          onOpenChange={setIsNotificationsDrawerOpen}
          userId={user.id}
        />
      ) : null}

      {isMobileMode && isLandscapeMobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md md:hidden">
          <div className="max-w-xs px-6 py-4 rounded-2xl border border-border bg-card shadow-lg text-center">
            <p className="text-sm font-medium text-foreground mb-1">
              Gire o aparelho para o modo retrato
            </p>
            <p className="text-xs text-muted-foreground">
              Este app foi otimizado para uso apenas na orientação vertical.
            </p>
          </div>
        </div>
      )}
      {!isMobileMode && <ChatPanel />}
    </ChatLauncherProvider>
  );
}

interface AccountMenuProps {
  user: any;
  navigate: NavigateFunction;
  onSignOut: () => void;
  profile: { username: string | null; email: string | null; avatar_url: string | null } | null;
}

function DesktopHeader({
  currentRoute,
  user,
  profile,
  navigate,
  handleSignOut,
  locationPathname,
  onOpenChat,
  unreadCount,
}: {
  currentRoute: { title: string; icon: any };
  user: any;
  profile: { username: string | null; email: string | null; avatar_url: string | null } | null;
  navigate: NavigateFunction;
  handleSignOut: () => void;
  locationPathname: string;
  onOpenChat: () => void;
  unreadCount: number;
}) {
  const { config } = usePageHeader();
  const showGlobalSearch = locationPathname === "/";

  const defaultTitle = currentRoute.title.split(" - ")[0];
  const effectiveTitle = config?.title ?? defaultTitle;
  const EffectiveIcon = (config?.icon as any) ?? currentRoute.icon;

  const showBackButton =
    locationPathname !== "/" && (config?.showBackButton ?? true);

  return (
    <div className="hidden md:flex shrink-0 flex-col gap-2 bg-background px-6 pt-4 pb-3 border-b border-border/70 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/90 px-3 py-2.5 shadow-[var(--shadow-card)]">
        {showBackButton && (
          <button
            type="button"
            onClick={() => {
              if (config?.backTo) {
                navigate(config.backTo);
              } else {
                navigate(-1);
              }
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {EffectiveIcon && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent border border-border/60 text-primary">
                <EffectiveIcon className="h-4 w-4" />
              </span>
            )}

            {/* Título único (substitui breadcrumbs) */}
            <h1 className="text-sm md:text-base font-semibold text-foreground truncate">
              {effectiveTitle}
            </h1>
          </div>

          {(config?.primaryActions || config?.secondaryActions) && (
            <div className="ml-auto flex items-center gap-2 flex-nowrap overflow-x-auto max-w-[52vw]">
              {config?.secondaryActions}
              {config?.primaryActions}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {showGlobalSearch && (
            <div className="w-52 lg:w-64 xl:w-72">
              <GlobalSearchBar />
            </div>
          )}

          <button
            type="button"
            onClick={onOpenChat}
            className="relative h-11 w-11 rounded-lg bg-accent flex items-center justify-center border border-border/70 shadow-[var(--shadow-card)] text-foreground hover:bg-accent/80 transition-colors"
            aria-label="Abrir chat"
          >
            <MessageCircle className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <AccountMenu
            user={user}
            navigate={navigate}
            onSignOut={handleSignOut}
            profile={profile}
          />
        </div>
      </div>
    </div>
  );
}

function AccountMenu({ user, navigate, onSignOut, profile }: AccountMenuProps) {
  const { shortcuts } = useSidebarPreferences();
  const hiddenShortcuts = shortcuts
    .filter((s) => !s.visible)
    .sort((a, b) => a.order - b.order);
  const displayName =
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Minha conta";

  const displayEmail = profile?.email || user?.email || "";

  const fallbackInitial = (profile?.username || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="h-11 w-11 rounded-lg bg-accent flex items-center justify-center border border-border/70 shadow-[var(--shadow-card)] text-sm font-semibold text-foreground"
        >
          <Avatar className="h-9 w-9 rounded-md">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="rounded-md bg-accent text-foreground text-sm font-semibold">
              {fallbackInitial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-accent text-foreground text-sm font-semibold">
              {fallbackInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {displayName}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {displayEmail}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        {hiddenShortcuts.length > 0 && (
          <>
            {hiddenShortcuts.map((shortcut) => {
              const Icon = shortcut.icon;
              return (
                <DropdownMenuItem
                  key={shortcut.id}
                  onClick={() => navigate(shortcut.path)}
                  className="cursor-pointer"
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  <span>{shortcut.label}</span>
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          onClick={() => navigate("/configuracoes")}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
