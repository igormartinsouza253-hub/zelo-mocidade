import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Users, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";

interface Membro {
  id: string;
  nome: string;
  faixa_etaria: string;
  foto_url: string | null;
}

interface VisitaRow {
  id: string;
  created_at: string;
  data_visita: string | null;
  membro_visitado_id: string;
  motivo: string;
  membros_presentes: string[];
  observacoes: string | null;
  is_past: boolean;
}

const NovaVisita = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingVisita, setLoadingVisita] = useState(false);

  const [tipoVisita, setTipoVisita] = useState<"passada" | "futura">("futura");
  const [membroVisitadoId, setMembroVisitadoId] = useState("");
  const [dataVisitaDate, setDataVisitaDate] = useState("");
  const [dataVisitaTime, setDataVisitaTime] = useState("");
  const [motivo, setMotivo] = useState("");
  const [membrosPresentesIds, setMembrosPresentesIds] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkedEventoId, setLinkedEventoId] = useState<string | null>(null);

  useEffect(() => {
    const baseBreadcrumbs = [
      { label: "Início", href: "/" },
      { label: "Visitas", href: "/visitas" },
    ];

    setConfig({
      title: editingId ? "Editar visita" : "Nova visita",
      breadcrumbs: [
        ...baseBreadcrumbs,
        { label: editingId ? "Editar" : "Nova visita" },
      ],
      showBackButton: true,
      backTo: "/visitas",
    });

    return () => setConfig(null);
  }, [editingId, setConfig]);

  useEffect(() => {
    void loadMembros();
  }, []);

  useEffect(() => {
    const id = searchParams.get("id");
    const membroId = searchParams.get("membroId");
    const eventoId = searchParams.get("eventoId");

    if (eventoId) setLinkedEventoId(eventoId);

    if (id) {
      setEditingId(id);
      void loadVisita(id);
    } else if (membroId) {
      setMembroVisitadoId(membroId);
    }
  }, [searchParams]);

  const loadMembros = async () => {
    try {
      setLoadingMembros(true);
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, faixa_etaria, foto_url")
        .order("nome");

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoadingMembros(false);
    }
  };

  const isoToDateInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    return `${yyyy}-${mm}-${dd}`;
  };

  const isoToTimeInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${hh}:${min}`;
  };

  const dateTimeToIso = (date: string, time?: string) => {
    // date: "YYYY-MM-DD"; time: "HH:mm" (opcional)
    const t = time?.trim() ? time : "00:00";
    const d = new Date(`${date}T${t}`); // interpreta como horário local
    return d.toISOString();
  };

  const isDatePast = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return false;
    const selected = new Date(y, m - 1, d, 0, 0, 0, 0);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    return selected.getTime() < todayStart.getTime();
  };

  const loadVisita = async (id: string) => {
    try {
      setLoadingVisita(true);
      const { data, error } = await supabase
        .from("visitas")
        .select("*")
        .eq("id", id)
        .single<VisitaRow>();

      if (error) throw error;
      if (!data) return;

      setTipoVisita(data.is_past ? "passada" : "futura");
      setMembroVisitadoId(data.membro_visitado_id);
      setDataVisitaDate(data.data_visita ? isoToDateInput(data.data_visita) : "");
      setDataVisitaTime(data.data_visita ? isoToTimeInput(data.data_visita) : "");
      setMotivo(data.motivo);
      setMembrosPresentesIds((data.membros_presentes || []) as string[]);
      setObservacoes(data.observacoes || "");
    } catch (error) {
      console.error("Erro ao carregar visita:", error);
      toast.error("Erro ao carregar visita para edição");
    } finally {
      setLoadingVisita(false);
    }
  };

  const toggleMembroPresente = (id: string) => {
    setMembrosPresentesIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setTipoVisita("futura");
    setMembroVisitadoId("");
    setDataVisitaDate("");
    setDataVisitaTime("");
    setMotivo("");
    setMembrosPresentesIds([]);
    setObservacoes("");
    setEditingId(null);
  };

  const handleSaveVisita = async () => {
    if (!membroVisitadoId) {
      toast.error("Selecione o membro que será visitado");
      return;
    }

    if (!motivo.trim()) {
      toast.error("Informe o motivo da visita");
      return;
    }

    // Regra mobile: se não registrar data, salva como futura.
    const hasDate = Boolean(dataVisitaDate);

    // Se a data for passada, obriga preencher hora.
    const datePast = hasDate ? isDatePast(dataVisitaDate) : false;
    if (datePast && !dataVisitaTime.trim()) {
      toast.error("Para uma data passada, informe também a hora da visita");
      return;
    }

    const dataVisitaIso = hasDate ? dateTimeToIso(dataVisitaDate, dataVisitaTime) : null;
    const computedIsPast = dataVisitaIso ? new Date(dataVisitaIso).getTime() < Date.now() : false;

    // Mantém validações apenas quando o usuário marcou como "passada"
    // (mas a classificação final será baseada na data)
    if (tipoVisita === "passada") {
      if (!hasDate) {
        toast.error("Informe a data da visita realizada");
        return;
      }

      if (membrosPresentesIds.length === 0) {
        toast.error("Selecione os membros que participaram da visita");
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        group_id: activeGroupId,
        membro_visitado_id: membroVisitadoId,
        motivo: motivo.trim(),
        membros_presentes: membrosPresentesIds,
        observacoes: observacoes.trim() || null,
        // classificação baseada na data (hoje) — se sem data, futura
        is_past: computedIsPast,
        data_visita: dataVisitaIso,
      };

      let visitaIdToLink: string | null = null;

      if (editingId) {
        const { error } = await supabase.from("visitas").update(payload).eq("id", editingId);

        if (error) throw error;
        toast.success("Visita atualizada com sucesso");
        visitaIdToLink = editingId;
      } else {
        const { data, error } = await supabase
          .from("visitas")
          .insert([payload])
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Visita registrada com sucesso");
        visitaIdToLink = data?.id ?? null;
      }

      // Se esta visita veio de uma visita agendada na Agenda, vincula o evento ao registro.
      if (linkedEventoId && visitaIdToLink) {
        const { error: linkError } = await supabase
          .from("eventos")
          .update({ visita_id: visitaIdToLink, updated_at: new Date().toISOString() })
          .eq("id", linkedEventoId);
        if (linkError) throw linkError;
      }

      navigate("/visitas");
    } catch (error) {
      console.error("Erro ao salvar visita:", error);
      toast.error("Erro ao salvar visita");
    } finally {
      setSaving(false);
    }
  };

  const selectedMembro = useMemo(
    () => membros.find((m) => m.id === membroVisitadoId) || null,
    [membroVisitadoId, membros],
  );

  return (
    <div className="w-full h-full flex justify-start bg-background">
      <div className={"w-full px-4 md:px-6 py-4 md:py-6 " + (isMobile ? "pb-32" : "")}>
        {/* No mobile, o header (voltar+título) vem da barra superior do layout */}
        {!isMobile && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex flex-col gap-1">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {editingId ? "Editar visita" : "Nova visita"}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground max-w-xl">
                {editingId
                  ? "Atualize as informações de uma visita já registrada."
                  : "Registre uma nova visita futura ou passada, incluindo participantes e observações."}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:min-h-[360px]">
          <div className="md:flex-1 md:min-h-0">
            <Card className="h-full shadow-[var(--shadow-soft)] border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Plus className="h-4 w-4 text-primary" />
                  {editingId ? "Informações da visita" : "Registrar visita"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 md:max-h-[520px] md:overflow-y-auto pr-1 md:pr-2 scrollbar-thin">
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm">Tipo de visita</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={tipoVisita === "futura" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTipoVisita("futura")}
                      className="flex-1 h-8 text-xs md:h-9 md:text-sm"
                    >
                      Futura
                    </Button>
                    <Button
                      type="button"
                      variant={tipoVisita === "passada" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTipoVisita("passada")}
                      className="flex-1 h-8 text-xs md:h-9 md:text-sm"
                    >
                      Passada
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs md:text-sm">Membro visitado</Label>
                  <Select
                    value={membroVisitadoId}
                    onValueChange={setMembroVisitadoId}
                    disabled={loadingMembros || loadingVisita}
                  >
                    <SelectTrigger className="h-9 text-xs md:text-sm">
                      <SelectValue placeholder="Selecione o membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {membros.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={m.foto_url || undefined} alt={m.nome} />
                              <AvatarFallback className="text-[10px]">
                                {m.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{m.nome}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedMembro && (
                    <p className="text-[11px] md:text-xs text-muted-foreground">
                      Faixa etária: {selectedMembro.faixa_etaria}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs md:text-sm">Data e hora</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="date"
                          className="h-8 text-xs md:h-9 md:text-sm"
                          value={dataVisitaDate}
                          onChange={(e) => setDataVisitaDate(e.target.value)}
                        />
                        <Input
                          type="time"
                          className="h-8 text-xs md:h-9 md:text-sm"
                          value={dataVisitaTime}
                          onChange={(e) => setDataVisitaTime(e.target.value)}
                        />
                      </div>
                    </div>
                    {dataVisitaDate && isDatePast(dataVisitaDate) ? (
                      <p className="text-[10px] md:text-xs text-muted-foreground">
                        Para datas passadas, a hora é obrigatória.
                      </p>
                    ) : (
                      <p className="text-[10px] md:text-xs text-muted-foreground">
                        A hora é opcional para datas futuras.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs md:text-sm">Motivo da visita</Label>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      rows={tipoVisita === "passada" ? 3 : 2}
                      className="min-h-[60px] md:min-h-[72px] resize-none text-xs md:text-sm"
                      placeholder="Ex.: ausência em reuniões, enfermidade, apoio espiritual..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs md:text-sm flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      Membros presentes na visita
                    </Label>
                    {tipoVisita === "futura" && (
                      <span className="text-[10px] md:text-xs text-muted-foreground">
                        Opcional para visitas futuras
                      </span>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border/80 p-2 space-y-1.5 bg-background/40">
                    {loadingMembros ? (
                      <>
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Skeleton className="h-3.5 w-3.5 rounded" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        ))}
                      </>
                    ) : membros.length === 0 ? (
                      <p className="text-[11px] md:text-xs text-muted-foreground">
                        Nenhum membro cadastrado ainda.
                      </p>
                    ) : (
                      membros.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 text-[11px] md:text-xs cursor-pointer select-none"
                        >
                          <Checkbox
                            checked={membrosPresentesIds.includes(m.id)}
                            onCheckedChange={() => toggleMembroPresente(m.id)}
                            className="h-3.5 w-3.5"
                          />
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={m.foto_url || undefined} alt={m.nome} />
                            <AvatarFallback className="text-[9px]">
                              {m.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{m.nome}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {tipoVisita === "passada" && (
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      Obrigatório informar quem participou da visita já realizada.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs md:text-sm">Observações (opcional)</Label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={2}
                    className="min-h-[56px] md:min-h-[64px] resize-none text-xs md:text-sm"
                    placeholder="Anote detalhes importantes da visita"
                  />
                </div>

                {!isMobile && (
                  <div className="flex flex-col md:flex-row gap-2 md:gap-3 pt-1 md:pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 md:h-9 text-xs md:text-sm flex-1 order-2 md:order-1"
                      onClick={resetForm}
                      disabled={saving || loadingVisita}
                    >
                      Limpar formulário
                    </Button>
                    <Button
                      type="button"
                      className="h-8 md:h-9 text-xs md:text-sm flex-1 order-1 md:order-2"
                      onClick={handleSaveVisita}
                      disabled={saving || loadingMembros || loadingVisita}
                    >
                      {saving
                        ? "Salvando..."
                        : editingId
                        ? "Atualizar visita"
                        : "Registrar visita"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action bar inferior somente no mobile (substitui a dock padrão) */}
        {isMobile && (
          <MobileActionBar>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={saving || loadingVisita}
            >
              Limpar
            </Button>
            <Button
              type="button"
              onClick={handleSaveVisita}
              disabled={saving || loadingMembros || loadingVisita}
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Registrar visita"}
            </Button>
          </MobileActionBar>
        )}
      </div>
    </div>
  );
};

export default NovaVisita;
