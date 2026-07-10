import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { WidgetSize } from "../types";

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

const decodeEntities = (value: string) => {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
};

const noteToText = (html: string) =>
  decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n\s+/g, "\n")
      .replace(/[ \t]+/g, " ")
      .trim(),
  );

const getNoteParts = (conteudo: string) => {
  const text = noteToText(conteudo);
  if (!text) return { title: "Nota sem título", preview: "Nota sem texto" };

  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] || "Nota sem título";
  const previewSource = lines.length > 1 ? lines.slice(1).join(" ") : text;
  const preview = previewSource === title ? text : previewSource;

  return {
    title: title.length > 42 ? `${title.slice(0, 42).trim()}...` : title,
    preview: preview.length > 140 ? `${preview.slice(0, 140).trim()}...` : preview,
  };
};

const formatNoteDate = (dateString: string) => {
  const date = new Date(dateString);
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
  const [day, month] = formatted.split(" de ");

  if (!day || !month) return formatted;
  return `${day} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
};

export const NotasWidget = ({ size, notas }: NotasWidgetProps) => {
  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);
  const compact = size === "sm";

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
    }, 220);
  };

  useEffect(() => {
    return () => cancelScheduledNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notasOrdenadas = [...notas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const notasVisiveis = compact ? notasOrdenadas.slice(0, 1) : notasOrdenadas;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-primary/55 bg-card p-1.5 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="shrink-0 rounded-[13px] bg-primary p-1.5 text-primary-foreground">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <div className="min-w-0 px-1.5 leading-none">
            <h3 className={compact ? "truncate text-[12px] font-bold uppercase" : "truncate text-[16px] font-bold uppercase"}>
              Notas rápidas
            </h3>
            <p className={compact ? "mt-1 truncate text-[10px] font-medium opacity-95" : "mt-1 truncate text-[12px] font-medium opacity-95"}>
              Anotações recentes
            </p>
          </div>
          <button
            type="button"
            className={compact ? "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-foreground/18 text-primary-foreground transition-colors hover:bg-primary-foreground/25" : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-foreground/18 text-primary-foreground transition-colors hover:bg-primary-foreground/25"}
            onClick={(event) => {
              event.stopPropagation();
              navigate("/notas/nova");
            }}
            aria-label="Criar nota"
          >
            <Plus className={compact ? "h-5 w-5" : "h-6 w-6"} />
          </button>
        </div>
      </div>

      <CardContent className={compact ? "min-h-0 flex-1 px-1.5 pb-1.5 pt-1.5" : "min-h-0 flex-1 px-1.5 pb-1.5 pt-2"}>
        {notasOrdenadas.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[14px] border border-dashed border-primary/35 px-3 text-center text-sm font-medium text-muted-foreground">
            Nenhuma nota cadastrada
          </div>
        ) : (
          <div className={compact ? "h-full min-h-0 overflow-y-auto pr-1 scrollbar-none" : "h-full min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-none"}>
            {notasVisiveis.map((nota) => {
              const { title, preview } = getNoteParts(nota.conteudo);

              return (
                <button
                  key={nota.id}
                  type="button"
                  className={compact ? "flex w-full flex-col rounded-[13px] border border-primary/55 bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/35" : "flex w-full flex-col rounded-[13px] border border-primary/55 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/35"}
                  onClick={() => navigateWithDelay(`/notas/editar/${nota.id}`)}
                  onDoubleClick={cancelScheduledNavigate}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <h4 className={compact ? "min-w-0 flex-1 truncate text-[13px] font-bold leading-tight text-foreground" : "min-w-0 flex-1 truncate text-[16px] font-bold leading-tight text-foreground"}>
                      {title}
                    </h4>
                    <span className={compact ? "shrink-0 text-[11px] font-bold leading-tight text-primary" : "shrink-0 text-[14px] font-bold leading-tight text-primary"}>
                      {formatNoteDate(nota.created_at)}
                    </span>
                  </div>
                  <p className={compact ? "mt-1 line-clamp-3 text-[11px] font-semibold leading-snug text-muted-foreground" : "mt-1 line-clamp-3 text-[13px] font-semibold leading-snug text-muted-foreground"}>
                    {preview}
                  </p>
                </button>
              );
            })}
            {!compact && notasVisiveis.length < 2 ? (
              <button
                type="button"
                className="flex min-h-[4.5rem] w-full flex-col items-start justify-center rounded-[13px] border border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 text-left text-primary transition-colors hover:bg-primary/10"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate("/notas/nova");
                }}
              >
                <span className="text-[13px] font-bold">Criar próxima nota</span>
                <span className="mt-1 text-[12px] font-medium text-muted-foreground">
                  Use este espaço para registrar lembretes rápidos.
                </span>
              </button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
