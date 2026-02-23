import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VisitDetailsDialogData = {
  title: string;
  membroNome: string;
  quando: Date;
  source: "agenda" | "registrada";
  motivo?: string | null;
  observacoes?: string | null;
  visitaId?: string | null;
  canEditAgendamento?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: VisitDetailsDialogData | null;
  onOpenVisita?: () => void;
  onEditarAgendamento?: () => void;
};

export function VisitDetailsDialog({ open, onOpenChange, data, onOpenVisita, onEditarAgendamento }: Props) {
  if (!data) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        {/* overlay transparente para manter o calendário “visível ao lado” */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-transparent" />

        <DialogPrimitive.Content
          className={cn(
            // painel lateral arredondado (retângulo) para alinhar com o padrão do app
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
                  <span className="font-medium text-foreground">{data.membroNome}</span>
                </span>
                <span className="block">
                  {format(data.quando, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </DialogPrimitive.Description>
            </div>

            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {(data.motivo || data.observacoes) ? (
              <div className="space-y-3">
                {data.motivo && (
                  <div className="text-sm">
                    <div className="text-xs font-medium text-muted-foreground">Motivo</div>
                    <div className="text-foreground">{data.motivo}</div>
                  </div>
                )}
                {data.observacoes && (
                  <div className="text-sm">
                    <div className="text-xs font-medium text-muted-foreground">Observações</div>
                    <div className="whitespace-pre-wrap text-foreground">{data.observacoes}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem detalhes adicionais.</div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end">
            {data.source === "agenda" && data.canEditAgendamento && (
              <Button variant="outline" onClick={onEditarAgendamento}>
                Editar agendamento
              </Button>
            )}
            {data.visitaId && <Button onClick={onOpenVisita}>Abrir visita</Button>}
            {!data.visitaId && (
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
