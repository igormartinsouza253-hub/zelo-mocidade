import * as React from "react";
import { addMinutes, format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type EventoTipo = "ajuntamento" | "saida" | "visita";

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartISO: string | null;
  userId: string | null;
  groupId: string | null;
  /** Se informado, entra em modo edição (UPDATE) */
  editingEventId?: string | null;
  initial?: {
    tipo: EventoTipo;
    titulo: string;
    descricao: string | null;
    local: string | null;
    diaInteiro: boolean;
    inicioISO: string;
    fimISO: string;
  } | null;
  onSaved?: () => void;
};

export function MobileEventUpsertDialog({
  open,
  onOpenChange,
  defaultStartISO,
  userId,
  groupId,
  editingEventId,
  initial,
  onSaved,
}: Props) {
  const [saving, setSaving] = React.useState(false);

  const defaultStart = React.useMemo(() => {
    const d = defaultStartISO ? new Date(defaultStartISO) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [defaultStartISO]);

  const [tipo, setTipo] = React.useState<EventoTipo>(initial?.tipo ?? "visita");
  const [titulo, setTitulo] = React.useState(initial?.titulo ?? "");
  const [descricao, setDescricao] = React.useState(initial?.descricao ?? "");
  const [local, setLocal] = React.useState(initial?.local ?? "");
  const [diaInteiro, setDiaInteiro] = React.useState(initial?.diaInteiro ?? false);
  const [inicio, setInicio] = React.useState(() => toDatetimeLocalValue(defaultStart));
  const [fim, setFim] = React.useState(() => toDatetimeLocalValue(addMinutes(defaultStart, 60)));

  React.useEffect(() => {
    if (!open) return;

    if (initial) {
      setTipo(initial.tipo);
      setTitulo(initial.titulo);
      setDescricao(initial.descricao ?? "");
      setLocal(initial.local ?? "");
      setDiaInteiro(!!initial.diaInteiro);
      setInicio(toDatetimeLocalValue(new Date(initial.inicioISO)));
      setFim(toDatetimeLocalValue(new Date(initial.fimISO)));
      return;
    }

    setTipo("visita");
    setTitulo("");
    setDescricao("");
    setLocal("");
    setDiaInteiro(false);
    setInicio(toDatetimeLocalValue(defaultStart));
    setFim(toDatetimeLocalValue(addMinutes(defaultStart, 60)));
  }, [defaultStart, initial, open]);

  const handleSave = async () => {
    if (!userId) {
      toast.error("Você precisa estar logado para salvar eventos.");
      return;
    }
    if (!groupId) {
      toast.error("Selecione/entre em um grupo antes de salvar eventos.");
      return;
    }
    if (!titulo.trim()) {
      toast.error("Informe um título.");
      return;
    }

    setSaving(true);
    try {
      const start = new Date(inicio);
      const end = new Date(fim);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        toast.error("Datas inválidas.");
        return;
      }

      if (end.getTime() < start.getTime()) {
        toast.error("O fim precisa ser após o início.");
        return;
      }

      const payload = {
        user_id: userId,
        group_id: groupId,
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() ? descricao.trim() : null,
        local: local.trim() ? local.trim() : null,
        data_inicio: start.toISOString(),
        data_fim: end.toISOString(),
        dia_inteiro: diaInteiro,
        // recorrencia/lembretes ficam nulos no mobile por enquanto
        recorrencia: null,
        lembretes: null,
      };

      if (editingEventId) {
        const { error } = await supabase.from("eventos").update(payload as any).eq("id", editingEventId);
        if (error) throw error;
        toast.success("Evento atualizado.");
      } else {
        const { error } = await supabase.from("eventos").insert([payload] as any);
        if (error) throw error;
        toast.success(`Evento criado (${format(start, "dd/MM", { locale: ptBR })})`);
      }

      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error("Não foi possível salvar o evento (permissão/RLS). ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingEventId ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            {editingEventId ? "Edite os dados do evento." : "Crie um evento rápido para este dia."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as EventoTipo)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ajuntamento">Ajuntamento</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="visita">Visita (agenda)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reunião com pais" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="local">Local (opcional)</Label>
            <Input id="local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: Salão" />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Dia inteiro</div>
              <div className="text-xs text-muted-foreground">Se ativado, o horário vira apenas informativo.</div>
            </div>
            <Switch checked={diaInteiro} onCheckedChange={setDiaInteiro} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="inicio">Início</Label>
              <Input id="inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fim">Fim</Label>
              <Input id="fim" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : editingEventId ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
