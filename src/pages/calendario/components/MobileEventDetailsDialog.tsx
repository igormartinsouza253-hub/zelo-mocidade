import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type EventoTipo = "ajuntamento" | "saida" | "visita";

export type MobileEventDetails = {
  baseId: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  tipo: EventoTipo;
  descricao?: string | null;
  local?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MobileEventDetails | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (event: MobileEventDetails) => void;
  onDeleted: () => void;
};

export function MobileEventDetailsDialog({ open, onOpenChange, event, canEdit, canDelete, onEdit, onDeleted }: Props) {
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setConfirmOpen(false);
  }, [open]);

  const timeLabel = React.useMemo(() => {
    if (!event) return "";
    return event.allDay
      ? "Dia inteiro"
      : `${format(event.start, "HH:mm", { locale: ptBR })} — ${format(event.end, "HH:mm", { locale: ptBR })}`;
  }, [event]);

  const handleDelete = async () => {
    if (!event) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("eventos").delete().eq("id", event.baseId);
      if (error) throw error;

      toast.success("Evento excluído.");
      setConfirmOpen(false);
      onOpenChange(false);
      onDeleted();
    } catch (e: any) {
      console.error(e);
      toast.error("Sem permissão para excluir ou não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="p-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base">Detalhes do evento</DialogTitle>
            <DialogDescription className="text-xs">
              {event ? format(event.start, "EEEE, dd 'de' MMMM", { locale: ptBR }) : ""}
            </DialogDescription>
          </DialogHeader>

          {!event ? null : (
            <div className="mt-4 space-y-4">
              <section className="space-y-1">
                <div className="text-lg font-semibold text-foreground leading-tight">
                  {event.title}
                </div>
                <div className="text-sm text-muted-foreground">{timeLabel}</div>
              </section>

              <section className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {event.tipo}
                </Badge>
                {event.local ? (
                  <Badge variant="outline" className="text-[10px]">
                    {event.local}
                  </Badge>
                ) : null}
              </section>

              {event.descricao ? (
                <section className="rounded-xl border border-border/60 bg-card p-3 text-sm text-foreground whitespace-pre-wrap">
                  {event.descricao}
                </section>
              ) : null}

              {canEdit || canDelete ? (
                <section className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onEdit(event)}
                    disabled={!canEdit}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setConfirmOpen(true)}
                    disabled={!canDelete}
                  >
                    Excluir
                  </Button>
                </section>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Você não tem permissão para editar/excluir este evento.
                </div>
              )}
            </div>
          )}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Se o evento tiver recorrência, você estará excluindo o evento base.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                {deleting ? "Excluindo…" : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
