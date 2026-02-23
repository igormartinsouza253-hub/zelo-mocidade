import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { WIDGET_REGISTRY } from "./widgetRegistry";
import * as Icons from "lucide-react";
import type { WidgetSize } from "./types";

interface WidgetSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeWidgets: string[];
  onAddWidget: (widgetId: string, size: WidgetSize) => void;
  onRemoveWidget: (widgetId: string) => void;
}

export const WidgetSidebar = ({
  isOpen,
  onClose,
  activeWidgets,
  onAddWidget,
  onRemoveWidget,
}: WidgetSidebarProps) => {
  if (!isOpen) return null;

  const handleAddWithSize = (widgetId: string, size: WidgetSize) => {
    onAddWidget(widgetId, size);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full md:w-96 bg-card border-l border-border shadow-xl z-50 animate-slide-in-right">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Gerenciar Widgets</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-4">
                Adicione ou remova widgets da sua tela inicial. Escolha também o tamanho desejado.
              </div>

              {Object.values(WIDGET_REGISTRY).map((widget) => {
                const isActive = activeWidgets.includes(widget.id);
                const IconComponent = Icons[widget.icon as keyof typeof Icons] as any;

                return (
                  <Card
                    key={widget.id}
                    className={`border transition-all ${
                      isActive
                        ? "border-primary/40 bg-accent/30"
                        : "border-border/40 hover:border-primary/20"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {IconComponent && <IconComponent className="h-5 w-5 text-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground mb-1">
                            {widget.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mb-2">
                            {widget.description}
                          </p>
                          {!isActive && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleAddWithSize(widget.id, "sm")}
                              >
                                3x2
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleAddWithSize(widget.id, "md")}
                              >
                                3x3
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleAddWithSize(widget.id, "lg")}
                              >
                                6x3
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                          <Button
                            variant={isActive ? "destructive" : "default"}
                            size="sm"
                            onClick={() =>
                              isActive
                                ? onRemoveWidget(widget.id)
                                : handleAddWithSize(widget.id, "md")
                            }
                          >
                            {isActive ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          {!isActive && (
                            <span className="text-[10px] text-muted-foreground">
                              Padrão: 3x3
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </>
  );
};
