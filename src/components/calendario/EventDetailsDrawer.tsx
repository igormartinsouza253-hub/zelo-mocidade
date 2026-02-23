import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EventDetailsDrawerData = {
  title: string;
  subtitle?: string;
  quando: { start: Date; end: Date; allDay?: boolean };
  local?: string | null;
  descricao?: string | null;
  sections?: { label: string; value: React.ReactNode }[];
  kindLabel: string;
  canEdit?: boolean;
  footer?: React.ReactNode;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: EventDetailsDrawerData | null;
  onEditar?: () => void;
};

export function EventDetailsDrawer({ open, onOpenChange, data, onEditar }: Props) {
  if (!data) return null;

  const whenText = data.quando.allDay
    ? format(data.quando.start, "dd/MM/yyyy", { locale: ptBR })
    : `${format(data.quando.start, "dd/MM/yyyy HH:mm", { locale: ptBR })} — ${format(data.quando.end, "HH:mm", { locale: ptBR })}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-transparent" />

        <DialogPrimitive.Content
          className={cn(
            "fixed bottom-3 right-3 top-3 z-50 flex w-full max-w-md flex-col rounded-2xl border bg-background shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b p-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-base font-semibold text-foreground">
                {data.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                <span className="block truncate">
                  <span className="font-medium text-foreground">{data.kindLabel}</span>
                  {data.subtitle ? <span className="text-muted-foreground"> · {data.subtitle}</span> : null}
                </span>
                <span className="block">{whenText}</span>
                {data.local ? <span className="block truncate">{data.local}</span> : null}
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {data.sections?.length ? (
              <dl className="space-y-3">
                {data.sections.map((s) => (
                  <div key={s.label} className="text-sm">
                    <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
                    <dd className="mt-0.5 text-foreground">{s.value}</dd>
                  </div>
                ))}
              </dl>
            ) : data.descricao ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="text-xs font-medium text-muted-foreground">Detalhes</div>
                  <div className="whitespace-pre-wrap text-foreground">{data.descricao}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem detalhes adicionais.</div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end">
            {data.footer ? (
              data.footer
            ) : data.canEdit && onEditar ? (
              <Button onClick={onEditar}>Editar</Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
