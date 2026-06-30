import React from "react";
import { useLocation } from "react-router-dom";
import {
  Award,
  BarChart3,
  CalendarDays,
  Handshake,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  Settings,
  StickyNote,
  Users,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DockItem = {
  id: string;
  label: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const FIXED_DOCK: DockItem[] = [
  { id: "home", label: "Inicio", url: "/", icon: Home },
  { id: "membros", label: "Membros", url: "/membros", icon: Users },
  { id: "reunioes", label: "Reuni\u00f5es", url: "/reunioes", icon: Handshake },
  { id: "calendario", label: "Agenda", url: "/calendario", icon: CalendarDays },
];

const MENU_PAGES: DockItem[] = [
  { id: "notas", label: "Notas", url: "/notas", icon: StickyNote },
  { id: "visitas", label: "Visitas", url: "/visitas", icon: MapPin },
  { id: "estatisticas", label: "Estat\u00edsticas", url: "/estatisticas", icon: BarChart3 },
  { id: "busca", label: "Busca", url: "/busca", icon: Search },
  { id: "cargos", label: "Cargos", url: "/cargos", icon: Award },
  { id: "config", label: "Config.", url: "/configuracoes", icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.625rem)] z-50 flex justify-center px-4 md:hidden">
      <div className="pointer-events-auto flex w-full max-w-[22rem] items-end gap-2">
        <div className="min-w-0 flex-1 rounded-3xl border border-border/65 bg-background/95 shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
          <div className="flex h-16 items-center gap-1.5 px-2 py-2">
            {FIXED_DOCK.map((item) => {
              const active = isActive(item.url);
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.id}
                  to={item.url}
                  end={item.url === "/"}
                  className="h-full min-w-0 flex-1"
                >
                  <div
                    className={`flex h-full w-full flex-col items-center justify-center rounded-2xl transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="mt-1 text-[10px] font-semibold leading-none">
                      {item.label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            {(() => {
              const fixedActive = FIXED_DOCK.some((item) => isActive(item.url));
              const activeMenu = MENU_PAGES.find((item) => isActive(item.url));
              const MenuIcon = !fixedActive && activeMenu ? activeMenu.icon : LayoutGrid;
              const label = !fixedActive && activeMenu ? activeMenu.label : "Menu";

              return (
                <button
                  type="button"
                  className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-3xl border border-border/65 bg-background/95 text-foreground shadow-[var(--shadow-card)] backdrop-blur-xl transition-colors hover:bg-accent/40 supports-[backdrop-filter]:bg-background/90"
                  aria-label={fixedActive ? "Abrir menu" : `Abrir menu (${label})`}
                >
                  <MenuIcon className="h-5 w-5" />
                  <span className="mt-1 text-[10px] font-semibold leading-none">
                    Menu
                  </span>
                </button>
              );
            })()}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={12}
            className="w-[calc(100vw-2rem)] max-w-[22rem] rounded-3xl border border-border/55 bg-background/98 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/94"
          >
            <div className="grid grid-cols-3 gap-2.5">
              {MENU_PAGES.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.id}
                    to={item.url}
                    className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/72 p-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="w-full truncate text-center text-[11px] font-semibold leading-tight text-muted-foreground">
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
