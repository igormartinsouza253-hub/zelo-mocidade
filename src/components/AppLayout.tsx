import React from "react";
import { ModernSidebar } from "@/components/ModernSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useLocation, useNavigate } from "react-router-dom";
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
  Bell,
  MoreVertical,
  Plus,
} from "lucide-react";
import {
  SidebarPreferencesProvider,
} from "@/hooks/useSidebarPreferences";
import { DockPreferencesProvider } from "@/hooks/useDockPreferences";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ZeloLogo } from "@/components/ZeloLogo";
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
  useEffect(() => {
    if (!isMobileMode || typeof window === "undefined" || !window.visualViewport) {
      document.documentElement.style.setProperty("--mobile-keyboard-inset", "0px");
      return;
    }

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--mobile-keyboard-inset", `${Math.round(inset)}px`);
    };

    updateKeyboardInset();
    window.visualViewport.addEventListener("resize", updateKeyboardInset);
    window.visualViewport.addEventListener("scroll", updateKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
      document.documentElement.style.setProperty("--mobile-keyboard-inset", "0px");
    };
  }, [isMobileMode]);

  // Exige grupo ativo para usar o app (exceto na tela de Grupo Gestor)
  useEffect(() => {
    if (!user) return;
    if (loadingGroup) return;
    if (location.pathname === "/grupo") return;
    if (!activeGroupId) {
      const redirectId = window.setTimeout(() => {
        navigate("/grupo", { replace: true });
      }, 1200);

      return () => window.clearTimeout(redirectId);
    }
  }, [user, loadingGroup, activeGroupId, location.pathname, navigate]);

  const isDashboard = location.pathname === "/";
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);
  const [hideMobileDockOverride, setHideMobileDockOverride] = useState(false);

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
        // Nem todos os navegadores permitem; fallback é o overlay de landscape.
      });
    }
  }, [isMobileMode]);

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

    const showDeviceNotification = async (incoming: { id?: string; title?: string; message?: string; entity_type?: string | null; entity_id?: string | null }) => {
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
        data: {
          url:
            incoming.entity_type === "group_join_request"
              ? "/grupo/info"
              : incoming.entity_type === "visita" && incoming.entity_id
                ? `/visitas/${incoming.entity_id}`
                : "/configuracoes",
        },
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
          const incoming = payload.new as { id?: string; title?: string; message?: string; entity_type?: string | null; entity_id?: string | null };
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
        // Não bloqueia UI; apenas diagnóstico.
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

    return false;
  };

  const showMobileDock =
    isMobileMode &&
    !shouldHideMobileDock(location.pathname) &&
    !hideMobileDockOverride;

  const showMobileActionDock =
    showMobileDock &&
    location.pathname !== "/" &&
    !!(
      config?.mobileSearch ||
      config?.mobilePrimaryAction ||
      config?.mobileActions ||
      config?.primaryActions ||
      config?.secondaryActions
    );

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
    <>
       <div className="flex h-screen w-full bg-background md:bg-background md:pl-28 overflow-hidden">
        {/* Modern Sidebar - Desktop/Tablet only */}
        {!isMobileMode && (
          <ModernSidebar
            user={user}
            profile={profile}
            activeGroupName={activeGroup?.name}
            loadingGroup={loadingGroup}
            unreadNotifications={unreadNotifications}
            onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
            onSignOut={handleSignOut}
          />
        )}

        {/* Main Content - respeita a margem da barra recolhida em telas grandes */}
         <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Mobile Top Header */}
            {isMobileMode &&
              // Visualização de visita tem header próprio (action bar)
              !(/^\/visitas\/[^/]+$/.test(location.pathname) && location.pathname !== "/visitas/nova") && (
                <div className="md:hidden sticky top-0 z-30 h-14 flex items-center px-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
                  <div className="relative flex items-center w-full gap-2">
                    {/* Voltar + título à esquerda */}
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
                      ) : (
                        <ZeloLogo className="h-10 w-10 rounded-xl p-1" />
                      )}
                    </div>

                    <h1 className="pointer-events-none absolute left-1/2 max-w-[42vw] -translate-x-1/2 truncate text-center text-xs font-extrabold uppercase tracking-[0.12em] text-foreground">
                      {effectiveTitle}
                    </h1>

                    {/* Ações + Perfil à direita */}
                    <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
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
                          <DropdownMenuItem onClick={() => navigate("/configuracoes")} className="cursor-pointer">
                            <Settings className="h-4 w-4 mr-2" />
                            {"Configura\u00e7\u00f5es"}
                          </DropdownMenuItem>
                          {activeGroupId ? (
                            <DropdownMenuItem onClick={() => navigate("/grupo/info")} className="cursor-pointer">
                              <Users className="h-4 w-4 mr-2" />
                              Visualizar grupo
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => setIsNotificationsDrawerOpen(true)}>
                            <Bell className="h-4 w-4 mr-2" />
                            {"Notifica\u00e7\u00f5es"}
                            {unreadNotifications > 0 && (
                              <span className="ml-auto min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-semibold text-destructive-foreground">
                                {unreadNotifications > 99 ? "99+" : unreadNotifications}
                              </span>
                            )}
                          </DropdownMenuItem>
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

          {/* Main Content */}
          <main
            className={`flex-1 min-h-0 min-w-0 ${
              !isMobileMode && isDashboard
                  ? "overflow-hidden"
                  : "overflow-y-auto overflow-x-hidden"
            } ${isMobileMode && isDashboard ? "p-0" : "p-3"} ${
              isMobileMode && isDashboard
                  ? "pb-0"
                  : isMobileMode && shouldHideMobileDock(location.pathname)
                  ? location.pathname === "/visitas/nova"
                    ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
                    : "pb-6"
                  : showMobileActionDock
                    ? "pb-3"
                    : "pb-3"
            } md:p-5 ${
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
        {showMobileActionDock && (
          <MobilePageActionDock
            mobileSearch={config?.mobileSearch}
            mobilePrimaryAction={config?.mobilePrimaryAction}
            mobileActions={config?.mobileActions}
            primaryActions={config?.primaryActions}
            secondaryActions={config?.secondaryActions}
          />
        )}

        {showMobileDock && <MobileBottomNav />}
      </div>

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
    </>
  );
}

function MobilePageActionDock({
  mobileSearch,
  mobilePrimaryAction,
  mobileActions,
  primaryActions,
  secondaryActions,
}: {
  mobileSearch?: NonNullable<ReturnType<typeof usePageHeader>["config"]>["mobileSearch"];
  mobilePrimaryAction?: NonNullable<ReturnType<typeof usePageHeader>["config"]>["mobilePrimaryAction"];
  mobileActions?: React.ReactNode;
  primaryActions?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}) {
  const fallbackActions = mobileActions ?? (
    <>
      {secondaryActions}
      {primaryActions}
    </>
  );
  const PrimaryIcon = mobilePrimaryAction?.icon ?? Plus;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.125rem+var(--mobile-keyboard-inset,0px))] z-40 flex justify-center px-4 md:hidden">
      <div className="pointer-events-auto flex min-h-14 w-full max-w-[22rem] items-center gap-2 rounded-3xl border border-border/65 bg-background/95 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
        {mobileSearch ? (
          <div className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-2xl border border-border/60 bg-card/70 py-1 pl-3 pr-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={mobileSearch.value}
              onChange={(event) => mobileSearch.onChange(event.target.value)}
              placeholder={mobileSearch.placeholder ?? "Buscar..."}
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label={mobileSearch.placeholder ?? "Buscar"}
            />
            {mobileSearch.menu ? (
              <div className="shrink-0 [&_button]:h-8 [&_button]:w-8 [&_button]:rounded-xl">
                {mobileSearch.menu}
              </div>
            ) : (
              <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        ) : null}

        {mobileActions ? (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto scrollbar-none [&_button]:h-11 [&_button]:rounded-2xl [&_button]:text-xs [&_button]:font-semibold">
            {mobileActions}
          </div>
        ) : !mobileSearch ? (
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto scrollbar-none [&_button]:h-11 [&_button]:rounded-2xl [&_button]:text-xs [&_button]:font-semibold">
            {fallbackActions}
          </div>
        ) : null}

        {mobilePrimaryAction ? (
          <button
            type="button"
            onClick={mobilePrimaryAction.onClick}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-primary/90"
            aria-label={mobilePrimaryAction.label}
            title={mobilePrimaryAction.label}
          >
            <PrimaryIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
