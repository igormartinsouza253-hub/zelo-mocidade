import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences";
import { cn } from "@/lib/utils";

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
  primary?: boolean;
};

const QUICK_ACTIONS: SidebarAction[] = [
  { label: "Novo membro", icon: UserPlus, path: "/membros/novo" },
  { label: "Nova reunião", icon: CalendarPlus, path: "/reunioes/nova", primary: true },
  { label: "Nova visita", icon: Handshake, path: "/visitas/nova" },
  { label: "Novo evento", icon: Plus, path: "/calendario?new=1" },
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
  const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { shortcuts } = useSidebarPreferences();
  const { config } = usePageHeader();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) window.clearTimeout(expandTimeoutRef.current);
      if (collapseTimeoutRef.current) window.clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  const visibleShortcuts = useMemo(
    () => shortcuts.filter((s) => s.visible).sort((a, b) => a.order - b.order),
    [shortcuts],
  );

  const hiddenShortcuts = useMemo(
    () => shortcuts.filter((s) => !s.visible).sort((a, b) => a.order - b.order),
    [shortcuts],
  );

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
    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    expandTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(true);
      expandTimeoutRef.current = null;
    }, 360);
  };

  const handleMouseLeave = () => {
    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }

    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(false);
      collapseTimeoutRef.current = null;
    }, 780);
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed bottom-4 left-4 top-4 z-40 hidden rounded-2xl border border-sidebar-border/80 bg-sidebar-background/95 text-sidebar-foreground shadow-[var(--shadow-elevated)] backdrop-blur-md transition-[width] duration-300 ease-in-out md:flex md:flex-col",
        isExpanded ? "w-72" : "w-24",
      )}
    >
      <div className="flex h-full min-h-0 flex-col px-3 py-3">
        <div className={cn("flex items-center gap-3", isExpanded ? "justify-start" : "justify-center")}>
          <button
            type="button"
            onClick={() => navigateTo("/")}
            className={cn(
              "flex items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isExpanded ? "shrink-0" : "h-14 w-full",
            )}
            aria-label="Ir para o início"
            title="Início"
          >
            <ZeloLogo className={cn(isExpanded ? "h-12 w-12" : "h-11 w-11", "rounded-2xl p-1")} />
          </button>

          {isExpanded && (
            <div className="min-w-0 flex-1 animate-fade-in">
              <p className="truncate text-sm font-bold leading-tight text-foreground">Zelo</p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{groupLabel}</p>
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 animate-fade-in [&_form>div]:rounded-xl [&_form>div]:px-2 [&_form>div]:py-1 [&_form>div>div]:py-0.5 [&_input]:h-7 [&_input]:text-xs">
            <GlobalSearchBar />
          </div>
        )}

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <SidebarSection title="Atalhos" expanded={isExpanded} subtle signal={visibleShortcuts.length > 5}>
            {visibleShortcuts.map((shortcut) => {
              const Icon = SIDEBAR_ICON_MAP[shortcut.id] ?? shortcut.icon;
              return (
                <SidebarButton
                  key={shortcut.id}
                  icon={Icon}
                  label={shortcut.label}
                  expanded={isExpanded}
                  active={isActive(shortcut.path)}
                  onClick={() => navigateTo(shortcut.path)}
                />
              );
            })}
          </SidebarSection>

          <SidebarSection title="Ações rápidas" expanded={isExpanded} grouped signal={QUICK_ACTIONS.length > 3}>
            {QUICK_ACTIONS.map((action) => (
              <SidebarButton
                key={action.path}
                icon={action.icon}
                label={action.label}
                expanded={isExpanded}
                active={isActive(action.path)}
                primary={action.primary}
                onClick={() => navigateTo(action.path)}
              />
            ))}
          </SidebarSection>

          {isExpanded && (config?.primaryActions || config?.secondaryActions) && (
            <section className="min-h-0 animate-fade-in overflow-hidden rounded-2xl border border-border/45 bg-background/55 p-2">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Página
              </p>
              <div className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1 scrollbar-none [&_button]:w-full [&_button]:justify-start">
                {config?.secondaryActions}
                {config?.primaryActions}
              </div>
            </section>
          )}
        </div>
        <div className="mt-3 space-y-2 border-t border-sidebar-border/60 pt-3">
          <SidebarButton
            icon={Bell}
            label="Notificações"
            expanded={isExpanded}
            onClick={onOpenNotifications}
            badge={unreadNotifications}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-3 rounded-xl text-left transition-colors hover:bg-accent",
                  isExpanded
                    ? "w-full border border-sidebar-border/70 bg-background/70 p-2"
                    : "h-14 w-full justify-center rounded-2xl p-0",
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
                {isExpanded && (
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

              {hiddenShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
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

              {hiddenShortcuts.length > 0 && <DropdownMenuSeparator />}

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
  className,
  grouped = false,
  subtle = false,
  signal = false,
  children,
}: {
  title: string;
  expanded: boolean;
  className?: string;
  grouped?: boolean;
  subtle?: boolean;
  signal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative min-h-0",
        expanded
          ? "overflow-hidden rounded-2xl border p-2"
          : "overflow-visible rounded-2xl border px-2 py-2",
        grouped && "border-primary/25 bg-primary/10 shadow-[var(--shadow-soft)]",
        subtle && "border-border/45 bg-background/45",
        className,
      )}
    >
      {expanded && (
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
      )}
      <div
        className={cn(
          "space-y-2 overflow-y-auto scrollbar-none",
          expanded ? "max-h-[min(31vh,15.5rem)] pr-1" : "max-h-[min(42vh,22rem)]",
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

function SidebarButton({
  icon: Icon,
  label,
  expanded,
  active = false,
  primary = false,
  badge,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  expanded: boolean;
  active?: boolean;
  primary?: boolean;
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
          ? "border-primary/40 bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
          : primary
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "text-sidebar-foreground hover:border-sidebar-border/70 hover:bg-accent",
      )}
      title={label}
    >
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
