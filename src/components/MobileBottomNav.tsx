import React from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

type DockItem = {
  id: string;
  label: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

const FIXED_DOCK: DockItem[] = [
  { id: "home", label: "Início", url: "/", icon: Home },
  { id: "membros", label: "Membros", url: "/membros", icon: Users },
  { id: "reunioes", label: "Reuniões", url: "/reunioes", icon: Handshake },
  { id: "calendario", label: "Agenda", url: "/calendario", icon: CalendarDays },
];

// Páginas que vão para o menu (as que não estão na dock fixa)
const MENU_PAGES: DockItem[] = [
  // Mantém aqui as rotas principais que existem hoje e não estão na dock fixa.
  // Ordem por uso/importance (ajustável conforme feedback)
  { id: "notas", label: "Notas", url: "/notas", icon: StickyNote },
  { id: "visitas", label: "Visitas", url: "/visitas", icon: MapPin },

  { id: "estatisticas", label: "Estatísticas", url: "/estatisticas", icon: BarChart3 },
  { id: "busca", label: "Busca", url: "/busca", icon: Search },

  { id: "cargos", label: "Cargos", url: "/cargos", icon: Award },
  { id: "config", label: "Configurações", url: "/configuracoes", icon: Settings },
];
export function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-2 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-end gap-2">
        {/* Dock retangular arredondada (menos curva que a atual) */}
        <div className="w-[78vw] max-w-sm rounded-2xl bg-background/85 border border-border/50 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between h-14 px-2">
            {FIXED_DOCK.map((item) => {
              const active = isActive(item.url);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.url}
                    end={item.url === "/"}
                  className="flex-1 h-full flex items-center justify-center"
                >
                  <div
                    className={`flex flex-col items-center justify-center h-11 w-14 rounded-xl transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] leading-none mt-1 font-medium">
                      {item.label}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Botão de Menu quadrado arredondado */}
        <Popover>
          <PopoverTrigger asChild>
            {(() => {
              const fixedActive = FIXED_DOCK.some((d) => isActive(d.url));
              const activeMenu = MENU_PAGES.find((p) => isActive(p.url));
              const MenuIcon = !fixedActive && activeMenu ? activeMenu.icon : LayoutGrid;
              const label = !fixedActive && activeMenu ? activeMenu.label : "Menu";

              return (
                <button
                  type="button"
                  className="h-14 w-14 rounded-2xl bg-background/85 border border-border/50 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 shadow-[var(--shadow-card)] flex items-center justify-center text-foreground"
                  aria-label={fixedActive ? "Abrir menu" : `Abrir menu (${label})`}
                >
                  <MenuIcon className="h-5 w-5" />
                </button>
              );
            })()}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            sideOffset={10}
            className="w-[88vw] max-w-sm rounded-2xl border border-border/50 bg-popover/95 backdrop-blur-xl supports-[backdrop-filter]:bg-popover/80 shadow-[var(--shadow-card)] p-3"
          >
            <div className="grid grid-cols-3 gap-2">
              {MENU_PAGES.map((p) => {
                const Icon = p.icon;
                return (
                  <NavLink
                    key={p.id}
                    to={p.url}
                    className="rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors p-3 min-h-[92px] flex flex-col items-center justify-center gap-2"
                  >
                    {/* Ícone sempre com alto contraste (preto no claro / branco no escuro) */}
                    <span className="h-11 w-11 rounded-xl bg-primary text-foreground flex items-center justify-center shadow-[var(--shadow-card)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="w-full text-center text-[11px] font-medium text-muted-foreground leading-tight truncate">
                      {p.label}
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