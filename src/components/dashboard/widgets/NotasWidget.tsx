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
    return <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
        <CardHeader className={WIDGET_HEADER_PADDING["sm"] + " flex flex-row items-center justify-between"}>
          <CardTitle className={widgetTitleClass("sm")}>
            Notas rápidas
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => navigate("/notas/nova")}>
            <Plus className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center px-2 pb-2 pt-0.5 text-xs">
          {ultima ? <div className="space-y-1.5 cursor-pointer rounded-2xl md:rounded-full bg-accent/20 px-2.5 py-2" onClick={() => navigateWithDelay(`/notas/editar/${ultima.id}`)} onDoubleClick={cancelScheduledNavigate}>
              <div className="text-[10px] text-muted-foreground">
                {formatDateLocal(ultima.created_at)}
              </div>
              <div className="text-foreground leading-snug line-clamp-4" dangerouslySetInnerHTML={{
            __html: ultima.conteudo
          }} />
            </div> : <p className="text-[11px] text-muted-foreground">Nenhuma nota cadastrada</p>}
        </CardContent>
      </Card>;
  }
  const limit = size === "md" ? 4 : 6;
  return <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
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
      <CardContent className="flex-1 overflow-auto px-3 pb-3 pt-0.5 scrollbar-thin scrollbar-thumb-muted/50 scrollbar-track-transparent">
        <div className={size === "lg" ? "space-y-2.5" : "space-y-2"}>
           {notasOrdenadas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota cadastrada</p> : notasOrdenadas.slice(0, limit).map(nota => <div key={nota.id} className="p-2.5 rounded-2xl md:rounded-full bg-accent/20 border border-border/30 group hover:border-primary/40 transition-all cursor-pointer" onClick={() => navigateWithDelay(`/notas/editar/${nota.id}`)} onDoubleClick={cancelScheduledNavigate}>
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
                  <div className={size === "lg" ? "text-sm text-foreground leading-snug line-clamp-4" : "text-sm text-foreground leading-snug line-clamp-2"} dangerouslySetInnerHTML={{
            __html: nota.conteudo.slice(0, 200)
          }} />
                </div>)}
        </div>
      </CardContent>
    </Card>;
};