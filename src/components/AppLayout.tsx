import React from "react";
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
  ChevronDown,
  CalendarPlus,
  UserPlus,
  SlidersHorizontal,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { DockPreferencesProvider } from "@/hooks/useDockPreferences";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ZeloLogo } from "@/components/ZeloLogo";
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
import { OfflineBanner } from "@/components/OfflineBanner";
import { useOfflineMode } from "@/hooks/useOfflineMode";

interface AppLayoutProps {
  children: React.ReactNode;
}

const routeTitles: Record<string, { title: string; icon: LucideIcon }> = {
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

const desktopRootPaths = new Set([
  "/",
  "/membros",
  "/reunioes",
  "/calendario",
  "/visitas",
  "/notas",
  "/estatisticas",
  "/configuracoes",
  "/grupo",
]);

function resolveParentPath(pathname: string) {
  if (pathname.startsWith("/membros/")) return "/membros";
  if (pathname.startsWith("/reunioes/")) return "/reunioes";
  if (pathname.startsWith("/visitas/")) return "/visitas";
  if (pathname.startsWith("/notas/")) return "/notas";
  if (pathname.startsWith("/grupo/")) return "/grupo";
  if (pathname.startsWith("/calendario/")) return "/calendario";
  if (pathname.startsWith("/configuracoes/")) return "/configuracoes";
  if (pathname.startsWith("/estatisticas/")) return "/estatisticas";

  return null;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <DockPreferencesProvider>
      <PageHeaderProvider>
        <AppLayoutShell>{children}</AppLayoutShell>
      </PageHeaderProvider>
    </DockPreferencesProvider>
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
  const { isOffline } = useOfflineMode();
  const isViewportMobile = useIsMobile();
  const heartbeatWarningAtRef = useRef(0);
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

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [desktopSearchQuery, setDesktopSearchQuery] = useState("");
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [globalSuggestions, setGlobalSuggestions] = useState<Array<{ id: string; label: string; helper: string; href: string; kind: "page" | "member" | "meeting" }>>([]);
  const scopedSearch = config?.mobileSearch;

  useEffect(() => {
    setDesktopSearchQuery(scopedSearch?.value ?? "");
  }, [location.pathname, scopedSearch?.value]);

  useEffect(() => {
    if (!desktopSearchOpen) return;
    desktopSearchInputRef.current?.focus();
  }, [desktopSearchOpen]);

  const submitDesktopSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstSuggestion = globalSuggestions[0];
    if (!scopedSearch && firstSuggestion) {
      navigate(firstSuggestion.href);
      setDesktopSearchOpen(false);
    }
  };

  useEffect(() => {
    if (!desktopSearchOpen || scopedSearch || !activeGroupId) {
      setGlobalSuggestions([]);
      return;
    }

    const query = desktopSearchQuery.trim();
    if (!query) {
      setGlobalSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const normalized = query.toLocaleLowerCase("pt-BR");
      const pages = [
        ["Início", "Dashboard e visão geral", "/"],
        ["Membros", "Cadastro e gestão de membros", "/membros"],
        ["Reuniões", "Reuniões e presenças", "/reunioes"],
        ["Calendário", "Eventos e agenda", "/calendario"],
        ["Visitas", "Registro de visitas", "/visitas"],
        ["Notas", "Notas rápidas", "/notas"],
        ["Estatísticas", "Indicadores do grupo", "/estatisticas"],
        ["Configurações", "Preferências do aplicativo", "/configuracoes"],
      ].filter(([label, helper]) => `${label} ${helper}`.toLocaleLowerCase("pt-BR").includes(normalized));

      const pattern = `%${query.replace(/[%_]/g, "")}%`;
      const [membersResult, meetingsResult] = await Promise.all([
        supabase.from("membros").select("id, nome, faixa_etaria").eq("group_id", activeGroupId).ilike("nome", pattern).limit(5),
        supabase.from("reunioes").select("id, data, tema").eq("group_id", activeGroupId).ilike("tema", pattern).order("data", { ascending: false }).limit(5),
      ]);

      setGlobalSuggestions([
        ...pages.map(([label, helper, href]) => ({ id: `page-${href}`, label, helper, href, kind: "page" as const })),
        ...((membersResult.data ?? []).map((item) => ({ id: `member-${item.id}`, label: item.nome, helper: item.faixa_etaria || "Membro", href: `/membros/visualizar/${item.id}`, kind: "member" as const }))),
        ...((meetingsResult.data ?? []).map((item) => ({ id: `meeting-${item.id}`, label: item.tema || "Reunião", helper: item.data, href: `/reunioes/visualizar/${item.id}`, kind: "meeting" as const }))),
      ].slice(0, 10));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [activeGroupId, desktopSearchOpen, desktopSearchQuery, scopedSearch]);

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

    void supabase.rpc("generate_today_birthday_notifications", {
      _group_id: activeGroupId,
      _recipient_user_id: user.id,
    });

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
            },
            { onConflict: "group_id,user_id" },
          );
        if (error) throw error;
      } catch (e) {
        const now = Date.now();
        if (now - heartbeatWarningAtRef.current > 120000) {
          heartbeatWarningAtRef.current = now;
          console.warn("Heartbeat: não foi possível atualizar presença. O app continua funcionando.", e);
        }
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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  useEffect(() => {
    if (!isOffline) return;
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/calendario" && params.has("new")) {
      params.delete("new");
      navigate({ pathname: "/calendario", search: params.toString() }, { replace: true });
      toast.info("A criação de eventos fica indisponível enquanto você está offline.");
    }
  }, [isOffline, location.pathname, location.search, navigate]);

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

  const isDesktopSubpage =
    !desktopRootPaths.has(location.pathname) &&
    (config?.showBackButton ?? true);

  const handleDesktopBack = () => {
    const parentPath = resolveParentPath(location.pathname);
    const target = config?.backTo ?? parentPath;
    if (target) {
      navigate(target);
    } else {
      navigate(-1);
    }
  };

  const handleMobileBack = () => {
    if (config?.backTo) {
      navigate(config.backTo);
    } else {
      navigate(-1);
    }
  };

  const morePage = [
    { label: "Visitas", path: "/visitas" },
    { label: "Notas", path: "/notas" },
    { label: "Estatísticas", path: "/estatisticas" },
    { label: "Cargos", path: "/cargos" },
  ].find((item) => location.pathname.startsWith(item.path));
  const contextualPageLabel = location.pathname === "/membros/novo"
    ? "Novo Membro"
    : location.pathname.startsWith("/membros/editar/")
      ? "Editar Membro"
      : null;
  const contextualCreate = contextualPageLabel
    ? null
    : location.pathname.startsWith("/membros")
    ? { label: "Novo membro", href: "/membros/novo", icon: UserPlus }
    : location.pathname.startsWith("/reunioes")
      ? { label: "Nova reunião", href: "/reunioes/nova", icon: Handshake }
      : location.pathname.startsWith("/calendario")
        ? { label: "Novo evento", href: "/calendario?new=1", icon: CalendarPlus }
        : location.pathname.startsWith("/visitas")
          ? { label: "Nova visita", href: "/visitas/nova", icon: Handshake }
          : location.pathname.startsWith("/notas")
            ? { label: "Nova nota", href: "/notas/nova", icon: FileText }
        : null;
  const isSettingsPage = location.pathname.startsWith("/configuracoes");

  return (
    <>
       <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <OfflineBanner />
        {/* Navegação principal desktop */}
        {!isMobileMode && (
          <header className="desktop-topbar relative hidden h-[68px] shrink-0 items-center px-[18px] md:flex">
            <div className="flex h-11 shrink-0 items-center gap-2 rounded-[20px] border border-border bg-card px-2">
              {isDesktopSubpage ? (
                <button
                  type="button"
                  onClick={handleDesktopBack}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label="Voltar"
                  title="Voltar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : null}
              <ZeloLogo compact className="h-8 w-8 rounded-xl p-1.5" />
              {contextualPageLabel ? (
                <span className="flex h-8 items-center rounded-[15px] bg-secondary px-3 text-xs font-bold text-foreground">
                  {contextualPageLabel}
                </span>
              ) : contextualCreate ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isOffline) {
                      toast.info("Esta ação exige conexão. O modo offline é somente leitura.");
                      return;
                    }
                    navigate(contextualCreate.href);
                  }}
                  disabled={isOffline}
                  className="flex h-8 items-center justify-center gap-2 rounded-[15px] bg-primary px-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  aria-label={contextualCreate.label}
                >
                  <contextualCreate.icon className="h-4 w-4" />
                  <span className="whitespace-nowrap text-xs">{contextualCreate.label}</span>
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex h-8 w-12 items-center justify-center rounded-[15px] bg-secondary text-foreground transition-colors hover:bg-secondary/80" aria-label="Criar novo item">
                      <Plus className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={10} className="w-52 rounded-xl p-1.5">
                    <DropdownMenuItem disabled={isOffline} onClick={() => navigate("/reunioes/nova")} className="h-10 cursor-pointer rounded-lg font-medium">
                      <Handshake className="mr-2 h-4 w-4" /> Nova reunião
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isOffline} onClick={() => navigate("/membros/novo")} className="h-10 cursor-pointer rounded-lg font-medium">
                      <UserPlus className="mr-2 h-4 w-4" /> Novo membro
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isOffline} onClick={() => navigate("/calendario?new=1")} className="h-10 cursor-pointer rounded-lg font-medium">
                      <CalendarPlus className="mr-2 h-4 w-4" /> Novo evento
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isOffline} onClick={() => navigate("/visitas/nova")} className="h-10 cursor-pointer rounded-lg font-medium">
                      <Handshake className="mr-2 h-4 w-4" /> Nova visita
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={isOffline} onClick={() => navigate("/notas/nova")} className="h-10 cursor-pointer rounded-lg font-medium">
                      <FileText className="mr-2 h-4 w-4" /> Nova nota
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <nav className="absolute left-1/2 flex h-11 w-[min(620px,42vw)] -translate-x-1/2 items-center gap-2 rounded-[20px] border border-border bg-card p-1.5" aria-label="Navegação principal">
              {[
                ["Início", "/"],
                ["Membros", "/membros"],
                ["Reuniões", "/reunioes"],
                ["Calendário", "/calendario"],
              ].map(([label, path]) => {
                const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
                return (
                  <button key={path} type="button" onClick={() => navigate(path)} className={`h-8 flex-1 rounded-[13px] px-4 text-xs font-bold uppercase tracking-tight ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>
                    {label}
                  </button>
                );
              })}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-[13px] px-4 text-xs font-bold uppercase ${morePage ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}>
                    {morePage?.label ?? "Mais"} <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/visitas")}>Visitas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/notas")}>Notas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/estatisticas")}>Estatísticas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/cargos")}>Cargos</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            <div className="ml-auto flex h-11 shrink-0 items-center gap-3 rounded-[20px] border border-border bg-card px-2">
              {config?.desktopTopbarActions ? <div className="flex h-9 items-center">{config.desktopTopbarActions}</div> : null}
              <form onSubmit={submitDesktopSearch} className={`relative flex h-8 min-w-0 items-center rounded-[14px] transition-[width,background-color] duration-300 ${desktopSearchOpen ? "w-[230px] bg-secondary px-1" : "w-8"}`}>
                <button type={desktopSearchOpen ? "submit" : "button"} onClick={() => !desktopSearchOpen && setDesktopSearchOpen(true)} className="topbar-icon h-8 w-8 shrink-0" aria-label={desktopSearchOpen ? "Pesquisar" : "Abrir pesquisa"}><Search /></button>
                <input
                  ref={desktopSearchInputRef}
                  value={desktopSearchQuery}
                  onChange={(event) => {
                    setDesktopSearchQuery(event.target.value);
                    scopedSearch?.onChange(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setDesktopSearchOpen(false);
                      desktopSearchInputRef.current?.blur();
                    }
                  }}
                  onBlur={() => window.setTimeout(() => setDesktopSearchOpen(false), 180)}
                  className={`min-w-0 flex-1 border-0 bg-transparent pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground ${desktopSearchOpen ? "opacity-100" : "pointer-events-none w-0 opacity-0"}`}
                  placeholder={scopedSearch?.placeholder ?? "Buscar páginas e dados..."}
                  aria-label="Pesquisar no Zelo"
                  tabIndex={desktopSearchOpen ? 0 : -1}
                />
                {desktopSearchOpen && !scopedSearch && desktopSearchQuery.trim() ? (
                  <div className="absolute right-0 top-[calc(100%+12px)] z-[70] w-[340px] overflow-hidden rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-[var(--shadow-elevated)]">
                    {globalSuggestions.length ? globalSuggestions.map((item) => (
                      <button key={item.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { navigate(item.href); setDesktopSearchOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-accent">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">{item.kind === "page" ? <FileText className="h-4 w-4" /> : item.kind === "member" ? <Users className="h-4 w-4" /> : <Handshake className="h-4 w-4" />}</span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.label}</span><span className="block truncate text-[11px] text-muted-foreground">{item.helper}</span></span>
                      </button>
                    )) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma sugestão encontrada neste grupo.</p>}
                  </div>
                ) : null}
              </form>
              {scopedSearch?.menu ? <div className="topbar-page-tools flex h-9 items-center">{scopedSearch.menu}</div> : null}
              <button type="button" onClick={() => setIsNotificationsDrawerOpen((open) => !open)} className={`topbar-expand-action topbar-square-action relative ${isNotificationsDrawerOpen ? "is-active keep-label" : ""}`} aria-label="Notificações"><Bell /><span className="topbar-action-label">Notificações</span>{unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />}</button>
              <button type="button" onClick={() => navigate("/configuracoes")} className={`topbar-expand-action topbar-square-action ${isSettingsPage ? "is-active keep-label" : ""}`} aria-label="Configurações"><Settings /><span className="topbar-action-label">Configurações</span></button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><button type="button" className="topbar-expand-action" aria-label="Conta"><Avatar className="topbar-action-avatar h-5 w-5"><AvatarImage src={profile?.avatar_url || undefined} /><AvatarFallback className="text-[9px]">{(profile?.username || user?.email || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar><span className="topbar-action-label">Conta</span></button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sair</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
        )}

        {/* Main Content - respeita a margem da barra recolhida em telas grandes */}
         <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                        <ZeloLogo compact className="h-10 w-10 rounded-xl p-1" />
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
