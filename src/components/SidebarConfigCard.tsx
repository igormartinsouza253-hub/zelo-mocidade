import { useState, useEffect } from "react";
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences";
import { SidebarShortcut } from "@/types/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Save, Home, Users, Handshake, CalendarDays, Award, BarChart3, StickyNote, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";

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

export function SidebarConfigCard() {
  const { shortcuts, loading, savePreferences } = useSidebarPreferences();
  const [localShortcuts, setLocalShortcuts] = useState<SidebarShortcut[]>(shortcuts);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when shortcuts load
  useEffect(() => {
    if (!loading) {
      setLocalShortcuts(shortcuts);
    }
  }, [loading, shortcuts]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(localShortcuts);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order
    const updated = items.map((item, index) => ({
      ...item,
      order: index + 1,
    }));

    setLocalShortcuts(updated);
    setHasChanges(true);
  };

  const handleToggleVisibility = (id: string) => {
    const updated = localShortcuts.map((s) => {
      if (s.id === id) {
        return { ...s, visible: !s.visible };
      }
      return s;
    });

    setLocalShortcuts(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await savePreferences(localShortcuts);
      setHasChanges(false);
      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configuração");
    }
  };

  const visibleShortcuts = localShortcuts.filter((s) => s.visible);
  const visibleCount = visibleShortcuts.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar Barra Lateral</CardTitle>
        <CardDescription>
          Personalize os atalhos exibidos na barra lateral. Atalhos extras ficam acessíveis pelo menu ☰.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            Atalhos visíveis: {visibleCount}
          </span>
          {hasChanges && (
            <Button onClick={handleSave} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              Salvar alterações
            </Button>
          )}
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="shortcuts">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {localShortcuts.map((shortcut, index) => {
                  const Icon = SIDEBAR_ICON_MAP[shortcut.id] ?? shortcut.icon;
                  return (
                    <Draggable
                      key={shortcut.id}
                      draggableId={shortcut.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all",
                            snapshot.isDragging && "shadow-lg ring-2 ring-primary",
                            !shortcut.visible && "opacity-50"
                          )}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing"
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>

                          <Icon className="h-5 w-5 text-primary" />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{shortcut.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {shortcut.path}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Label htmlFor={`visible-${shortcut.id}`} className="text-xs cursor-pointer">
                              {shortcut.visible ? "Visível" : "Oculto"}
                            </Label>
                            <Switch
                              id={`visible-${shortcut.id}`}
                              checked={shortcut.visible}
                              onCheckedChange={() => handleToggleVisibility(shortcut.id)}
                            />
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

      </CardContent>
    </Card>
  );
}
