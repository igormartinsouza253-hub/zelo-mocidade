import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BarChart3, Calendar, FileText, Home, Pin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "./useAuth";

export type DockItemId =
  | "home"
  | "membros"
  | "reunioes"
  | "aniversariantes"
  | "estatisticas"
  | "notas";

export interface DockItemConfig {
  id: DockItemId;
  title: string;
  url: string;
  order: number;
  enabled: boolean;
}

const DOCK_STORAGE_KEY = "dock-preferences-v1";

const ALL_DOCK_ITEMS: DockItemConfig[] = [
  { id: "membros", title: "Membros", url: "/membros", order: 1, enabled: true },
  { id: "reunioes", title: "Reuniões", url: "/reunioes", order: 2, enabled: true },
  { id: "home", title: "Início", url: "/", order: 3, enabled: true },
  { id: "aniversariantes", title: "Agenda", url: "/calendario", order: 4, enabled: true },
  { id: "estatisticas", title: "Estatísticas", url: "/estatisticas", order: 5, enabled: false },
  { id: "notas", title: "Notas", url: "/notas", order: 6, enabled: false },
];

const DEFAULT_DOCK_ITEMS: DockItemConfig[] = ALL_DOCK_ITEMS.filter((item) => item.enabled);

export const DOCK_ICON_MAP: Record<DockItemId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  membros: Users,
  reunioes: Pin,
  aniversariantes: Calendar,
  estatisticas: BarChart3,
  notas: FileText,
};

function sanitizeItems(rawItems: DockItemConfig[]): DockItemConfig[] {
  const storedById = new Map<DockItemId, DockItemConfig>();

  rawItems
    .filter((item): item is DockItemConfig => !!item && !!item.id && !!item.url)
    .forEach((item) => {
      if (!storedById.has(item.id)) {
        storedById.set(item.id, item);
      }
    });

  const merged: DockItemConfig[] = ALL_DOCK_ITEMS.map((master) => {
    const stored = storedById.get(master.id);

    return {
      ...master,
      ...stored,
      id: master.id,
      title: master.title,
      url: master.url,
      order: stored?.order ?? master.order,
      enabled: stored?.enabled ?? master.enabled,
    };
  });

  storedById.forEach((item, id) => {
    if (!ALL_DOCK_ITEMS.find((master) => master.id === id)) {
      merged.push({ ...item, enabled: false });
    }
  });

  merged.sort((a, b) => a.order - b.order);

  const enabledItems: DockItemConfig[] = [];
  const disabledItems: DockItemConfig[] = [];

  for (const item of merged) {
    if (item.enabled && enabledItems.length < 5) {
      enabledItems.push({
        ...item,
        enabled: true,
        order: enabledItems.length + 1,
      });
    } else {
      disabledItems.push({
        ...item,
        enabled: false,
      });
    }
  }

  return [...enabledItems, ...disabledItems];
}

interface DockPreferencesContextValue {
  items: DockItemConfig[];
  enabledItems: DockItemConfig[];
  setItems: React.Dispatch<React.SetStateAction<DockItemConfig[]>>;
}

const DockPreferencesContext = createContext<DockPreferencesContextValue | undefined>(
  undefined,
);

export function DockPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<DockItemConfig[]>(DEFAULT_DOCK_ITEMS);

  const loadLocalPreferences = () => {
    if (typeof window === "undefined") return false;

    try {
      const stored = window.localStorage.getItem(DOCK_STORAGE_KEY);
      if (!stored) return false;

      const parsed = JSON.parse(stored) as DockItemConfig[];
      setItems(sanitizeItems(parsed));
      return true;
    } catch (error) {
      console.warn("Não foi possível carregar preferências locais da dock:", error);
      return false;
    }
  };

  useEffect(() => {
    const loadDockPreferences = async () => {
      if (!user) {
        loadLocalPreferences();
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("dashboard_layout")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Não foi possível carregar preferências da dock na nuvem. Usando dados locais.", error);
          loadLocalPreferences();
          return;
        }

        const layout = data?.dashboard_layout;
        if (
          layout &&
          typeof layout === "object" &&
          !Array.isArray(layout) &&
          Array.isArray(layout.dockPreferences)
        ) {
          setItems(sanitizeItems(layout.dockPreferences as unknown as DockItemConfig[]));
          return;
        }
      } catch (error) {
        console.warn("Não foi possível processar preferências da dock na nuvem. Usando dados locais.", error);
        loadLocalPreferences();
        return;
      }

      loadLocalPreferences();
    };

    loadDockPreferences();
  }, [user]);

  useEffect(() => {
    const persist = async () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(sanitizeItems(items)));
        } catch (error) {
          console.warn("Não foi possível salvar preferências locais da dock:", error);
        }
      }

      if (!user) return;

      try {
        const { data: existingData, error: loadError } = await supabase
          .from("user_preferences")
          .select("id, dashboard_layout")
          .eq("user_id", user.id)
          .maybeSingle();

        if (loadError && loadError.code !== "PGRST116") {
          console.warn("Não foi possível carregar preferências antes de salvar dock na nuvem:", loadError);
          return;
        }

        const dashboardLayout =
          typeof existingData?.dashboard_layout === "object" &&
          existingData.dashboard_layout !== null
            ? (existingData.dashboard_layout as Record<string, Json | undefined>)
            : {};

        const updatedLayout = {
          ...dashboardLayout,
          dockPreferences: sanitizeItems(items).map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            order: item.order,
            enabled: item.enabled,
          })),
        };

        const { error } = existingData
          ? await supabase
              .from("user_preferences")
              .update({
                dashboard_layout: updatedLayout as Json,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingData.id)
          : await supabase.from("user_preferences").insert([
              {
                user_id: user.id,
                dashboard_layout: updatedLayout as Json,
                updated_at: new Date().toISOString(),
              },
            ]);

        if (error) {
          console.warn("Não foi possível salvar preferências da dock na nuvem:", error);
        }
      } catch (error) {
        console.warn("Não foi possível persistir preferências da dock na nuvem:", error);
      }
    };

    persist();
  }, [items, user]);

  const sanitizedItems = sanitizeItems(items);
  const enabledItems = sanitizedItems.filter((item) => item.enabled).slice(0, 5);

  return (
    <DockPreferencesContext.Provider value={{ items: sanitizedItems, enabledItems, setItems }}>
      {children}
    </DockPreferencesContext.Provider>
  );
}

export function useDockPreferences() {
  const context = useContext(DockPreferencesContext);

  if (!context) {
    throw new Error("useDockPreferences deve ser usado dentro de um DockPreferencesProvider");
  }

  return context;
}
