import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Home, Users, Pin, Calendar, BarChart3, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  // Mantemos o id legado "aniversariantes" para preservar preferências já salvas,
  // mas apontamos para a nova Agenda unificada.
  { id: "aniversariantes", title: "Agenda", url: "/calendario", order: 4, enabled: true },
  // Itens adicionais começam desativados e aparecem em "Outros atalhos disponíveis"
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
  // Mapa com o que veio salvo no dispositivo, para preservar preferências do usuário
  const storedById = new Map<DockItemId, DockItemConfig>();

  rawItems
    .filter((item): item is DockItemConfig => !!item && !!item.id && !!item.url)
    .forEach((item) => {
      if (!storedById.has(item.id)) {
        storedById.set(item.id, item);
      }
    });

  // Mescla a tabela-mestra com o que o usuário já personalizou
  const merged: DockItemConfig[] = ALL_DOCK_ITEMS.map((master) => {
    const stored = storedById.get(master.id);

    const mergedItem: DockItemConfig = {
      ...master,
      ...stored,
      // Garantir consistência de chaves principais
      id: master.id,
      title: master.title,
      url: master.url,
      order: stored?.order ?? master.order,
      enabled: stored?.enabled ?? master.enabled,
    };

    return mergedItem;
  });

  // Itens desconhecidos (vindos de versões futuras) são preservados como desativados
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
 
  // Load from Supabase dashboard_layout (dockPreferences) or fallback to localStorage
  useEffect(() => {
    const loadDockPreferences = async () => {
      if (!user) return;
 
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("dashboard_layout")
          .eq("user_id", user.id)
          .maybeSingle();
 
        if (error) {
          console.error("Erro ao carregar preferências da dock do backend:", error);
          return;
        }
 
        const layout = data?.dashboard_layout as any;
        if (layout && Array.isArray(layout.dockPreferences)) {
          const cloudItems = layout.dockPreferences as DockItemConfig[];
          setItems(sanitizeItems(cloudItems));
          return;
        }
      } catch (error) {
        console.error("Erro ao processar preferências da dock do backend:", error);
      }
 
      // Fallback para localStorage quando não houver nada salvo em nuvem
      if (typeof window === "undefined") return;
      try {
        const stored = window.localStorage.getItem(DOCK_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as DockItemConfig[];
          setItems(sanitizeItems(parsed));
        }
      } catch (error) {
        console.error("Erro ao carregar preferências da dock do localStorage:", error);
      }
    };
 
    loadDockPreferences();
  }, [user?.id]);
 
  // Persist automatically whenever items change (localStorage + backend)
  useEffect(() => {
    const persist = async () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            DOCK_STORAGE_KEY,
            JSON.stringify(sanitizeItems(items)),
          );
        } catch (error) {
          console.error("Erro ao salvar preferências da dock no localStorage:", error);
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
          console.error("Erro ao carregar user_preferences antes de salvar dock:", loadError);
          return;
        }
 
        const dashboardLayout =
          typeof existingData?.dashboard_layout === "object" &&
          existingData.dashboard_layout !== null
            ? (existingData.dashboard_layout as Record<string, any>)
            : {};
 
        const serializedDock = sanitizeItems(items).map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          order: item.order,
          enabled: item.enabled,
        }));
 
        const updatedLayout = {
          ...dashboardLayout,
          dockPreferences: serializedDock,
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
              user_id: user.id,
              dashboard_layout: updatedLayout as any,
              updated_at: new Date().toISOString(),
            },
          ]);
 
          error = insertError;
        }
 
        if (error) {
          console.error("Erro ao salvar preferências da dock no backend:", error);
        }
      } catch (error) {
        console.error("Erro ao persistir preferências da dock no backend:", error);
      }
    };
 
    persist();
  }, [items, user?.id]);

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
