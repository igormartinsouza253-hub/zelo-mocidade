import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatDateLocal } from "@/lib/date-utils";
import { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface Nota {
  id: string;
  conteudo: string;
  created_at: string;
  user_id: string;
}
interface NotasWidgetProps {
  size: WidgetSize;
  notas: Nota[];
  onDelete: (id: string) => void;
}

const getNotaPreview = (conteudo: string) =>
  conteudo
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

export const NotasWidget = ({
  size,
  notas,
  onDelete
}: NotasWidgetProps) => {
  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);

  const cancelScheduledNavigate = () => {
    if (navigateTimerRef.current) {
      window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }
  };

  const navigateWithDelay = (to: string) => {
    cancelScheduledNavigate();
    navigateTimerRef.current = window.setTimeout(() => {
      navigate(to);
      navigateTimerRef.current = null;
    }, 240);
  };

  useEffect(() => {
    return () => cancelScheduledNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notasOrdenadas = [...notas].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (size === "sm") {
    const ultima = notasOrdenadas[0];
    return <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
        <CardHeader className={WIDGET_HEADER_PADDING["sm"] + " flex flex-row items-center justify-between"}>
          <CardTitle className={widgetTitleClass("sm")}>
            Notas rápidas
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => navigate("/notas/nova")}>
            <Plus className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-2 pb-2 pt-0.5 text-xs">
          {ultima ? <div className="space-y-1.5 cursor-pointer rounded-2xl border border-border/45 bg-card/70 px-2.5 py-2 transition-colors hover:bg-accent/35" onClick={() => navigateWithDelay(`/notas/editar/${ultima.id}`)} onDoubleClick={cancelScheduledNavigate}>
              <div className="text-[10px] text-muted-foreground">
                {formatDateLocal(ultima.created_at)}
              </div>
              <p className="text-foreground leading-snug line-clamp-4">
                {getNotaPreview(ultima.conteudo) || "Nota sem texto"}
              </p>
            </div> : <p className="text-[11px] text-muted-foreground">Nenhuma nota cadastrada</p>}
        </CardContent>
      </Card>;
  }
  const limit = size === "md" ? 3 : undefined;
  const notasVisiveis = limit ? notasOrdenadas.slice(0, limit) : notasOrdenadas;
  return <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
      <CardHeader className={WIDGET_HEADER_PADDING[size] + " px-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={widgetTitleClass(size)}>
            Notas rápidas
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate("/notas/nova")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-0.5 scrollbar-none">
        <div className={size === "lg" ? "space-y-2.5" : "space-y-2"}>
           {notasOrdenadas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota cadastrada</p> : notasVisiveis.map(nota => <div key={nota.id} className="group cursor-pointer rounded-2xl border border-border/45 bg-card/70 p-2.5 transition-all hover:border-primary/40 hover:bg-accent/35" onClick={() => navigateWithDelay(`/notas/editar/${nota.id}`)} onDoubleClick={cancelScheduledNavigate}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[11px] text-muted-foreground">
                      {formatDateLocal(nota.created_at)}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelScheduledNavigate();
                          navigate(`/notas/editar/${nota.id}`);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelScheduledNavigate();
                          onDelete(nota.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className={size === "lg" ? "text-sm text-foreground leading-snug line-clamp-4" : "text-sm text-foreground leading-snug line-clamp-2"}>
                    {getNotaPreview(nota.conteudo) || "Nota sem texto"}
                  </p>
                </div>)}
        </div>
      </CardContent>
    </Card>;
};
