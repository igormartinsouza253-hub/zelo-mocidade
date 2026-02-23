import { createContext, useContext, useEffect, useState } from "react";
import { Home, Users, Handshake, CalendarDays, Award, BarChart3, StickyNote, MapPin } from "lucide-react";
import { SidebarShortcut } from "@/types/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const DEFAULT_SHORTCUTS: SidebarShortcut[] = [
  { id: "home", label: "Início", icon: Home, path: "/", visible: true, order: 1 },
  { id: "members", label: "Membros", icon: Users, path: "/membros", visible: true, order: 2 },
  { id: "meetings", label: "Reuniões", icon: Handshake, path: "/reunioes", visible: true, order: 3 },
  { id: "roles", label: "Cargos", icon: Award, path: "/cargos", visible: true, order: 4 },
  { id: "stats", label: "Estatísticas", icon: BarChart3, path: "/estatisticas", visible: true, order: 5 },
  { id: "birthdays", label: "Agenda", icon: CalendarDays, path: "/calendario", visible: false, order: 6 },
  { id: "notes", label: "Notas", icon: StickyNote, path: "/notas", visible: false, order: 7 },
  { id: "visits", label: "Visitas", icon: MapPin, path: "/visitas", visible: false, order: 8 },
];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  home: Home,
  members: Users,
  meetings: Handshake,
  roles: Award,
  stats: BarChart3,
  birthdays: CalendarDays,
  notes: StickyNote,
  visits: MapPin,
};

interface SidebarPreferencesContextValue {
  shortcuts: SidebarShortcut[];
  loading: boolean;
  savePreferences: (shortcuts: SidebarShortcut[]) => Promise<void>;
}

const SidebarPreferencesContext = createContext<SidebarPreferencesContextValue | undefined>(
  undefined
);

export function SidebarPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<SidebarShortcut[]>(DEFAULT_SHORTCUTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    } else {
      setShortcuts(DEFAULT_SHORTCUTS);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading sidebar preferences:", error);
        return;
      }

      if (data?.dashboard_layout && typeof data.dashboard_layout === "object") {
        const prefs = data.dashboard_layout as any;
        if (prefs.sidebarShortcuts && Array.isArray(prefs.sidebarShortcuts)) {
          const mappedShortcuts: SidebarShortcut[] = prefs.sidebarShortcuts.map(
            (s: any, index: number) => {
              const id = s.id || s.path || `item-${index}`;
              const defaultDef = DEFAULT_SHORTCUTS.find((d) => d.id === id);
              const Icon = (defaultDef?.icon || Home);

              const baseShortcut: SidebarShortcut = {
                id,
                label: s.label || defaultDef?.label || "Atalho",
                icon: Icon,
                path: s.path || defaultDef?.path || "/",
                visible:
                  typeof s.visible === "boolean"
                    ? s.visible
                    : typeof defaultDef?.visible === "boolean"
                      ? defaultDef.visible
                      : true,
                order:
                  typeof s.order === "number"
                    ? s.order
                    : typeof defaultDef?.order === "number"
                      ? defaultDef.order
                      : index + 1,
              };

              return baseShortcut;
            }
          );

          // Merge with DEFAULT_SHORTCUTS to ensure new default items (like "visits") appear
          const mergedShortcuts: SidebarShortcut[] = [...mappedShortcuts];

          for (const def of DEFAULT_SHORTCUTS) {
            const exists = mergedShortcuts.some((s) => s.id === def.id);
            if (!exists) {
              mergedShortcuts.push(def);
            }
          }

          mergedShortcuts.sort((a, b) => a.order - b.order);

          setShortcuts(mergedShortcuts);
        }
      }
    } catch (error) {
      console.error("Error loading sidebar preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newShortcuts: SidebarShortcut[]) => {
    try {
      // Atualiza o estado global imediatamente para refletir na UI (sidebar + config)
      setShortcuts(newShortcuts);

      const { data: existingData, error: loadError } = await supabase
        .from("user_preferences")
        .select("id, dashboard_layout")
        .eq("user_id", user?.id)
        .single();

      if (loadError && loadError.code !== "PGRST116") {
        console.error("Error loading user_preferences before save:", loadError);
        return;
      }

      const dashboardLayout =
        typeof existingData?.dashboard_layout === "object" &&
        existingData?.dashboard_layout !== null
          ? (existingData.dashboard_layout as Record<string, any>)
          : {};

      const serializedShortcuts = newShortcuts.map((s) => ({
        id: s.id,
        label: s.label,
        iconName: s.icon.name,
        path: s.path,
        visible: s.visible,
        order: s.order,
      }));

      const updatedLayout = {
        ...dashboardLayout,
        sidebarShortcuts: serializedShortcuts,
      };

      let error = null;

      if (existingData) {
        const { error: updateError } = await supabase
          .from("user_preferences")
          .update({
            dashboard_layout: updatedLayout as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id);

        error = updateError;
      } else {
        const { error: insertError } = await supabase.from("user_preferences").insert([
          {
            user_id: user?.id!,
            dashboard_layout: updatedLayout as any,
            updated_at: new Date().toISOString(),
          },
        ]);

        error = insertError;
      }

      if (error) throw error;
    } catch (error) {
      console.error("Error saving sidebar preferences:", error);
      throw error;
    }
  };

  return (
    <SidebarPreferencesContext.Provider value={{ shortcuts, loading, savePreferences }}>
      {children}
    </SidebarPreferencesContext.Provider>
  );
}

export function useSidebarPreferences() {
  const context = useContext(SidebarPreferencesContext);
  if (!context) {
    throw new Error("useSidebarPreferences must be used within a SidebarPreferencesProvider");
  }
  return context;
}
