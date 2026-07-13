import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarPlus,
  Handshake,
  Home,
  LogOut,
  MapPin,
  MoreHorizontal,
  Plus,
  Settings,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { ZeloLogo } from "@/components/ZeloLogo";
import { cn } from "@/lib/utils";
import type { SidebarShortcut } from "@/types/sidebar";

const SIDEBAR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  home: Home,
  members: Users,
  meetings: Handshake,
  birthdays: CalendarDays,
  roles: Award,
  stats: BarChart3,
  notes: StickyNote,
  visits: MapPin,
};

type ModernSidebarProps = {
  user: any;
  profile: { username: string | null; email: string | null; avatar_url: string | null } | null;
  activeGroupName?: string | null;
  loadingGroup?: boolean;
  unreadNotifications: number;
  onOpenNotifications: () => void;
  onSignOut: () => void;
};

type SidebarAction = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
};

const QUICK_ACTIONS: SidebarAction[] = [
  { label: "Novo membro", icon: UserPlus, path: "/membros/novo" },
  { label: "Nova reunião", icon: CalendarPlus, path: "/reunioes/nova" },
  { label: "Nova visita", icon: Handshake, path: "/visitas/nova" },
  { label: "Novo evento", icon: Plus, path: "/calendario?new=1" },
];

const PRIMARY_SHORTCUTS: SidebarShortcut[] = [
  { id: "home", label: "Início", icon: Home, path: "/", visible: true, order: 1 },
  { id: "members", label: "Membros", icon: Users, path: "/membros", visible: true, order: 2 },
  { id: "meetings", label: "Reuniões", icon: Handshake, path: "/reunioes", visible: true, order: 3 },
  { id: "birthdays", label: "Agenda", icon: CalendarDays, path: "/calendario", visible: true, order: 4 },
  { id: "stats", label: "Estatísticas", icon: BarChart3, path: "/estatisticas", visible: true, order: 5 },
];

const SECONDARY_SHORTCUTS: SidebarShortcut[] = [
  { id: "roles", label: "Cargos", icon: Award, path: "/cargos", visible: false, order: 6 },
  { id: "notes", label: "Notas", icon: StickyNote, path: "/notas", visible: false, order: 7 },
  { id: "visits", label: "Visitas", icon: MapPin, path: "/visitas", visible: false, order: 8 },
];

export function ModernSidebar({
  user,
  profile,
  activeGroupName,
  loadingGroup = false,
  unreadNotifications,
  onOpenNotifications,
  onSignOut,
}: ModernSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [lockedExpanded, setLockedExpanded] = useState<boolean | null>(null);
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInsideRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) window.clearTimeout(expandTimeoutRef.current);
      if (collapseTimeoutRef.current) window.clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const visibleShortcuts = PRIMARY_SHORTCUTS;
  const hiddenShortcuts = SECONDARY_SHORTCUTS;
  const sidebarExpanded = lockedExpanded ?? isExpanded;

  const isActive = (path: string) => {
    const [pathname] = path.split("?");
    if (pathname === "/") return location.pathname === "/";
    return location.pathname.startsWith(pathname);
  };

  const displayName =
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Minha conta";
  const displayEmail = profile?.email || user?.email || "";
  const fallbackInitial = (profile?.username || user?.email || "U").charAt(0).toUpperCase();
  const groupLabel = loadingGroup ? "Carregando..." : activeGroupName || "Nenhum grupo";

  const navigateTo = (path: string) => {
    navigate(path);
  };

  const handleMouseEnter = () => {
    pointerInsideRef.current = true;
    if (lockedExpanded !== null) return;

    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    expandTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(true);
      expandTimeoutRef.current = null;
    }, 220);
  };

  const handleMouseLeave = () => {
    pointerInsideRef.current = false;
    if (lockedExpanded !== null) return;

    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }

    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      collapseTimeoutRef.current = null;
    }, 520);
  };

  const clearSidebarTimers = () => {
    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }

    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  };

  const handlePopupOpenChange = (open: boolean) => {
    if (open) {
      clearSidebarTimers();
      setLockedExpanded((current) => current ?? isExpanded);
      return;
    }

    setLockedExpanded(null);

    if (!pointerInsideRef.current) {
      collapseTimeoutRef.current = window.setTimeout(() => {
        setIsExpanded(false);
        collapseTimeoutRef.current = null;
      }, 180);
    }
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed bottom-4 left-4 top-4 z-40 hidden rounded-2xl border border-sidebar-border/80 bg-sidebar-background/95 text-sidebar-foreground shadow-[var(--shadow-elevated)] backdrop-blur-md transition-[width,box-shadow] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] will-change-[width] md:flex md:flex-col",
        sidebarExpanded ? "w-72" : "w-20",
      )}
    >
      <div className="flex h-full min-h-0 flex-col px-3 py-3">
        <div className={cn("flex items-center gap-3", sidebarExpanded ? "justify-start" : "justify-center")}>
          <button
            type="button"
            onClick={() => navigateTo("/")}
            className={cn(
              "flex items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              sidebarExpanded ? "shrink-0" : "h-12 w-full",
            )}
            aria-label="Ir para o início"
            title="Início"
          >
            <ZeloLogo compact className={cn(sidebarExpanded ? "h-12 w-12" : "h-10 w-10", "rounded-2xl p-1")} />
          </button>

          {sidebarExpanded && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <p className="truncate text-sm font-bold leading-tight text-foreground">Zelo</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{groupLabel}</p>
            </div>
          )}
        </div>

        {sidebarExpanded && (
          <div className="mt-3 animate-fade-in [&_form>div]:rounded-xl [&_form>div]:px-2 [&_form>div]:py-1 [&_form>div>div]:py-0.5 [&_input]:h-7 [&_input]:text-xs">
            <GlobalSearchBar />
          </div>
        )}

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <SidebarSection title="Navegação" expanded={sidebarExpanded} signal={false}>
            {visibleShortcuts.map((shortcut) => {
              const Icon = SIDEBAR_ICON_MAP[shortcut.id] ?? shortcut.icon;
              return (
                <SidebarButton
                  key={shortcut.id}
                  icon={Icon}
                  label={shortcut.label}
                  expanded={sidebarExpanded}
                  active={isActive(shortcut.path)}
                  onClick={() => navigateTo(shortcut.path)}
                />
              );
            })}

            {hiddenShortcuts.length > 0 && (
              <MoreShortcutsMenu
                shortcuts={hiddenShortcuts}
                expanded={sidebarExpanded}
                navigateTo={navigateTo}
                onOpenChange={handlePopupOpenChange}
              />
            )}
          </SidebarSection>

          <CreateMenu expanded={sidebarExpanded} navigateTo={navigateTo} onOpenChange={handlePopupOpenChange} />
        </div>

        <div className="mt-3 space-y-2 border-t border-sidebar-border/60 pt-3">
          <SidebarButton
            icon={Bell}
            label="Notificações"
            expanded={sidebarExpanded}
            onClick={onOpenNotifications}
            badge={unreadNotifications}
          />

          <DropdownMenu onOpenChange={handlePopupOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-accent",
                  sidebarExpanded
                    ? "w-full border border-sidebar-border/70 bg-background/70 p-2"
                    : "h-12 w-full justify-center p-0",
                )}
                aria-label="Conta"
                title="Conta"
              >
                <Avatar className="h-8 w-8 rounded-xl">
                  <AvatarImage className="rounded-xl object-cover" src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="rounded-xl bg-accent text-sm font-semibold text-foreground">
                    {fallbackInitial}
                  </AvatarFallback>
                </Avatar>
                {sidebarExpanded && (
                  <div className="min-w-0 flex-1 animate-fade-in">
                    <p className="truncate text-xs font-semibold text-foreground">{displayName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{displayEmail || groupLabel}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="w-64">
              <div className="flex items-center gap-3 px-2 py-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-accent text-sm font-semibold text-foreground">
                    {fallbackInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{displayEmail}</p>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => navigateTo("/grupo/info")} className="cursor-pointer">
                <Users className="mr-2 h-4 w-4" />
                Visualizar grupo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/configuracoes")} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  expanded,
  signal = false,
  children,
}: {
  title: string;
  expanded: boolean;
  signal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative min-h-0">
      {expanded && (
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
      )}
      <div
        className={cn(
          "space-y-1.5 overflow-y-auto scrollbar-none",
          expanded ? "max-h-[min(46vh,24rem)] pr-1" : "max-h-[min(52vh,27rem)]",
        )}
      >
        {children}
      </div>
      {expanded && signal && (
        <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-center">
          <span className="h-1 w-8 rounded-full bg-muted-foreground/25" />
        </div>
      )}
    </section>
  );
}

function CreateMenu({
  expanded,
  navigateTo,
  onOpenChange,
}: {
  expanded: boolean;
  navigateTo: (path: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-primary/90",
            expanded ? "h-11 w-full gap-3 px-3" : "mx-auto h-12 w-12 justify-center px-0",
          )}
          aria-label="Criar"
          title="Criar"
        >
          <Plus className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
          {expanded && <span className="min-w-0 flex-1 truncate text-left animate-fade-in">Criar</span>}
          {expanded && <MoreHorizontal className="h-4 w-4 shrink-0 opacity-80" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-56">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.path}
              onClick={() => navigateTo(action.path)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreShortcutsMenu({
  shortcuts,
  expanded,
  navigateTo,
  onOpenChange,
}: {
  shortcuts: SidebarShortcut[];
  expanded: boolean;
  navigateTo: (path: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative flex items-center gap-3 rounded-xl border border-transparent text-sm font-semibold text-muted-foreground transition-all duration-200 hover:border-sidebar-border/70 hover:bg-accent hover:text-foreground",
            expanded ? "h-11 w-full px-3" : "mx-auto h-11 w-11 justify-center px-0",
          )}
          aria-label="Mais atalhos"
          title="Mais atalhos"
        >
          <MoreHorizontal className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
          {expanded && <span className="min-w-0 flex-1 truncate text-left animate-fade-in">Mais</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-56">
        {shortcuts.map((shortcut) => {
          const Icon = SIDEBAR_ICON_MAP[shortcut.id] ?? shortcut.icon;
          return (
            <DropdownMenuItem
              key={shortcut.id}
              onClick={() => navigateTo(shortcut.path)}
              className="cursor-pointer"
            >
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              <span>{shortcut.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarButton({
  icon: Icon,
  label,
  expanded,
  active = false,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  expanded: boolean;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-transparent text-sm font-semibold transition-all duration-200",
        expanded ? "h-11 w-full px-3" : "mx-auto h-11 w-11 justify-center px-0",
        active
          ? "border-primary/35 bg-primary/15 text-primary"
          : "text-sidebar-foreground hover:border-sidebar-border/70 hover:bg-accent",
      )}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      {active && expanded && <span className="absolute left-0 h-5 w-1 rounded-r-full bg-primary" />}
      <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
      {expanded && <span className="min-w-0 flex-1 truncate text-left animate-fade-in">{label}</span>}
      {showBadge && (
        <span
          className={cn(
            "inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground",
            !expanded && "absolute right-1 top-1 min-w-4 px-1 text-[9px]",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
