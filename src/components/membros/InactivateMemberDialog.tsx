import * as React from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type InactivateReason =
  | "Teste"
  | "Mudou de comum"
  | "Casou"
  | "Não congrega mais"
  | "Outro";

const DEFAULT_REASONS: InactivateReason[] = [
  "Teste",
  "Mudou de comum",
  "Casou",
  "Não congrega mais",
  "Outro",
];

export function InactivateMemberDialog({
  open,
  onOpenChange,
  title = "Inativar membro",
  description =
    "Informe o motivo. O membro não poderá ser selecionado em novas reuniões, mas continuará aparecendo nas reuniões antigas.",
  confirmLabel = "Inativar",
  reasons = DEFAULT_REASONS,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  reasons?: InactivateReason[];
  loading?: boolean;
  onConfirm: (payload: { reason: string; note: string | null }) => Promise<void> | void;
}) {
  const [reason, setReason] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setNote("");
    }
  }, [open]);

  const isOther = reason.trim() === "Outro";
  const canConfirm = Boolean(reason.trim()) && (!isOther || Boolean(note.trim()));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{isOther ? "Justificativa" : "Observação (opcional)"}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isOther
                  ? "Descreva o motivo"
                  : "Se quiser, adicione detalhes (ex.: mudança de comum, etc.)"
              }
              rows={3}
            />
            {isOther && (
              <p className="text-xs text-muted-foreground">
                Obrigatório quando o motivo for “Outro”.
              </p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              if (!canConfirm) return;
              await onConfirm({ reason: reason.trim(), note: note.trim() ? note.trim() : null });
            }}
            disabled={!canConfirm || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Salvando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
