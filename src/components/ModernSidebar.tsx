import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Handshake, CalendarDays, Award, BarChart3, StickyNote, MapPin } from "lucide-react";
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences";
import { cn } from "@/lib/utils";

const SIDEBAR_ICON_MAP: Record<string, React.ComponentType<any>> = {
  home: Home,
  members: Users,
  meetings: Handshake,
  birthdays: CalendarDays,
  roles: Award,
  stats: BarChart3,
  notes: StickyNote,
  visits: MapPin,
};

export function ModernSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { shortcuts } = useSidebarPreferences();
  const location = useLocation();
  const navigate = useNavigate();
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const visibleShortcuts = shortcuts
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true);
    }, 1500); // 1.5 segundos
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsExpanded(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden md:flex rounded-xl bg-sidebar-background/95 backdrop-blur-sm border border-sidebar-border shadow-[var(--shadow-card)] transition-all duration-300 ease-in-out flex flex-col py-4 px-3",
        isExpanded ? "w-60" : "w-16",
      )}
    >
      {/* Atalhos visíveis */}
      <div className="flex-1 flex flex-col items-center gap-2.5 px-1">
        {visibleShortcuts.map((shortcut) => {
          const Icon = SIDEBAR_ICON_MAP[shortcut.id] ?? shortcut.icon;
          const active = isActive(shortcut.path);

          return (
            <button
              key={shortcut.id}
              onClick={() => navigate(shortcut.path)}
              className={cn(
                "flex items-center gap-3 rounded-lg transition-all duration-200 group border border-transparent",
                isExpanded ? "px-3.5 py-2.5 w-full justify-start" : "w-11 h-11 justify-center",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "hover:bg-accent text-sidebar-foreground hover:border-sidebar-border/70",
              )}
            >
              <Icon className={cn("shrink-0 transition-transform group-hover:scale-110", "h-5 w-5")} />
              {isExpanded && (
                <span className="text-sm font-medium animate-fade-in truncate">
                  {shortcut.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
