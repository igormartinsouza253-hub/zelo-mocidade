import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  Plus,
  Users,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
  Handshake,
  MoreVertical,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useOfflineMode } from "@/hooks/useOfflineMode";

interface Membro {
  id: string;
  nome: string;
  faixa_etaria: string;
  foto_url: string | null;
}

interface Visita {
  id: string;
  created_at: string;
  data_visita: string | null;
  membro_visitado_id: string;
  motivo: string;
  membros_presentes: string[];
  observacoes: string | null;
  is_past: boolean;
}

interface EnrichedVisita extends Visita {
  membro_visitado_nome: string;
  membros_presentes_nomes: string[];
}

export default function DesktopVisitas() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { activeGroupId } = useActiveGroup();
  const { canWrite } = useOfflineMode();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [visitasRaw, setVisitasRaw] = useState<Visita[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(true);
  const [loadingMembros, setLoadingMembros] = useState(true);

  const [suggestions, setSuggestions] = useState<Membro[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [selectedVisita, setSelectedVisita] = useState<EnrichedVisita | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<EnrichedVisita | null>(null);
  const { setConfig } = usePageHeader();

  const loadMembros = useCallback(async () => {
    if (!activeGroupId) return;

    try {
      setLoadingMembros(true);
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, faixa_etaria, foto_url")
        .eq("group_id", activeGroupId)
        .order("nome");

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoadingMembros(false);
    }
  }, [activeGroupId]);

  const loadVisitas = useCallback(async () => {
    if (!activeGroupId) return;

    try {
      setLoadingVisitas(true);
      const { data, error } = await supabase
        .from("visitas")
        .select("*")
        .eq("group_id", activeGroupId)
        .order("data_visita", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const normalized: Visita[] = (data || []).map((v) => ({
        ...v,
        membros_presentes: (v.membros_presentes || []) as string[],
      }));

      setVisitasRaw(normalized);
    } catch (error) {
      console.error("Erro ao carregar visitas:", error);
      toast.error("Erro ao carregar visitas");
    } finally {
      setLoadingVisitas(false);
    }
  }, [activeGroupId]);

  const loadSuggestions = useCallback(async () => {
    if (!activeGroupId) return;

    try {
      setLoadingSuggestions(true);

      const { data: reunioes, error: reunioesError } = await supabase
        .from("reunioes")
        .select("id, data")
        .eq("group_id", activeGroupId)
        .order("data", { ascending: false })
        .limit(4);

      if (reunioesError) throw reunioesError;

      if (!reunioes || reunioes.length === 0) {
        setSuggestions([]);
        return;
      }

      const reuniaoIds = reunioes.map((r) => r.id);

      const { data: presencas, error: presencasError } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id")
        .eq("group_id", activeGroupId)
        .in("reuniao_id", reuniaoIds);

      if (presencasError) throw presencasError;

      const { data: visitasData, error: visitasError } = await supabase
        .from("visitas")
        .select("membro_visitado_id")
        .eq("group_id", activeGroupId);

      if (visitasError) throw visitasError;

      const membrosQueJaReceberamVisita = new Set(
        (visitasData || []).map((v) => v.membro_visitado_id as string),
      );

      const presentesPorReuniao = new Map<string, Set<string>>();
      (presencas || []).forEach((p) => {
        const set = presentesPorReuniao.get(p.reuniao_id) || new Set<string>();
        set.add(p.membro_id as string);
        presentesPorReuniao.set(p.reuniao_id, set);
      });

      const sugestoes: Membro[] = [];

      for (const membro of membros) {
        if (membrosQueJaReceberamVisita.has(membro.id)) continue;
        if (!['Meninos', 'Meninas', 'Moços', 'Moças'].includes(membro.faixa_etaria)) continue;

        const faltasSeguidas = reuniaoIds.every((reuniaoId) => {
          const presentes = presentesPorReuniao.get(reuniaoId) || new Set<string>();
          return !presentes.has(membro.id);
        });

        if (faltasSeguidas) {
          sugestoes.push(membro);
        }
      }

      setSuggestions(sugestoes);
    } catch (error) {
      console.error("Erro ao carregar sugestões de visita:", error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [activeGroupId, membros]);

  useEffect(() => {
    if (!activeGroupId) {
      setMembros([]);
      setVisitasRaw([]);
      setSuggestions([]);
      setLoadingMembros(false);
      setLoadingVisitas(false);
      setLoadingSuggestions(false);
      return;
    }

    setSelectedVisita(null);
    void loadMembros();
    void loadVisitas();
  }, [activeGroupId, loadMembros, loadVisitas]);

  useEffect(() => {
    if (membros.length > 0) void loadSuggestions();
  }, [loadSuggestions, membros.length, visitasRaw.length]);

  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`visitas-changes:${activeGroupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas", filter: `group_id=eq.${activeGroupId}` },
        () => {
          void loadVisitas();
          void loadSuggestions();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeGroupId, loadSuggestions, loadVisitas]);

  const visitasEnriquecidas = useMemo<EnrichedVisita[]>(() => {
    if (visitasRaw.length === 0) return [];

    const membrosMap = new Map(membros.map((m) => [m.id, m] as const));

    return visitasRaw.map((v) => {
      const membroVisitado = membrosMap.get(v.membro_visitado_id);
      const membro_visitado_nome = membroVisitado ? membroVisitado.nome : "Membro desconhecido";

      const membros_presentes_nomes = (v.membros_presentes || []).map((id) => {
        const m = membrosMap.get(id);
        return m ? m.nome : "—";
      });

      return {
        ...v,
        membro_visitado_nome,
        membros_presentes_nomes,
      };
    });
  }, [visitasRaw, membros]);

  useEffect(() => {
    setConfig({
      title: "Visitas",
      icon: Handshake,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Visitas" }],
      showBackButton: true,
      backTo: "/",
      primaryActions: (
        <>
          <Button
            variant="outline"
            size={isMobile ? "sm" : "default"}
            className="gap-1.5 md:gap-2 text-xs md:text-sm"
            onClick={() => setSuggestionsOpen(true)}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Sugestões
          </Button>
          <Button
            size={isMobile ? "sm" : "default"}
            className="gap-1.5 md:gap-2 text-xs md:text-sm"
            disabled={!canWrite}
            title={!canWrite ? "Disponível somente com conexão" : undefined}
            onClick={() => navigate("/visitas/nova")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova visita
          </Button>
        </>
      ),
    });

    return () => setConfig(null);
  }, [canWrite, isMobile, navigate, setConfig]);

  const futuras = useMemo(
    () =>
      visitasEnriquecidas
        .filter((visita) => !visita.is_past)
        .sort((a, b) => {
          const aTime = a.data_visita ? new Date(a.data_visita).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.data_visita ? new Date(b.data_visita).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }),
    [visitasEnriquecidas],
  );
  const passadas = useMemo(
    () =>
      visitasEnriquecidas
        .filter((visita) => visita.is_past)
        .sort((a, b) => {
          const aTime = a.data_visita ? new Date(a.data_visita).getTime() : 0;
          const bTime = b.data_visita ? new Date(b.data_visita).getTime() : 0;
          return bTime - aTime;
        }),
    [visitasEnriquecidas],
  );

  useEffect(() => {
    setSelectedVisita((current) => {
      if (!current) return null;
      return visitasEnriquecidas.find((visita) => visita.id === current.id) || null;
    });
  }, [visitasEnriquecidas]);

  const formatDateTime = (value: string | null) => {
    if (!value) return "Sem data definida";
    const date = new Date(value);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleMarkAsDone = async (visita: EnrichedVisita) => {
    if (!canWrite) {
      toast.info("Esta ação exige conexão. O modo offline é somente leitura.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitas")
        .update({ is_past: true, data_visita: now })
        .eq("id", visita.id)
        .eq("group_id", activeGroupId);

      if (error) throw error;
      toast.success("Visita marcada como concluída");
      await loadVisitas();
    } catch (error) {
      console.error("Erro ao concluir visita:", error);
      toast.error("Erro ao concluir visita");
    }
  };

  const handleDeleteVisita = async (visita: EnrichedVisita) => {
    if (!canWrite) {
      toast.info("Esta ação exige conexão. O modo offline é somente leitura.");
      return;
    }

    try {
      const { error } = await supabase.from("visitas").delete().eq("id", visita.id).eq("group_id", activeGroupId);
      if (error) throw error;
      toast.success("Visita excluída com sucesso");
      setDeleteCandidate(null);
      setSelectedVisita(null);
      await loadVisitas();
    } catch (error) {
      console.error("Erro ao excluir visita:", error);
      toast.error("Erro ao excluir visita");
    }
  };

  const handleEditVisita = (visita: EnrichedVisita) => {
    if (!canWrite) {
      toast.info("Esta ação exige conexão. O modo offline é somente leitura.");
      return;
    }
    navigate(`/visitas/nova?id=${visita.id}`);
  };

  const renderVisitaItem = (visita: EnrichedVisita) => {
    const active = selectedVisita?.id === visita.id;

    return (
    <button
      key={visita.id}
      type="button"
      onClick={() => setSelectedVisita((current) => current?.id === visita.id ? null : visita)}
      className={`group flex min-h-[5.35rem] w-full items-center gap-4 rounded-2xl border p-3 text-left outline-none transition-all hover:border-primary/50 hover:bg-secondary/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 ${
        active
          ? "border-primary bg-primary/10 ring-1 ring-inset ring-primary/55"
          : "border-border/55 bg-background/50"
      }`}
    >
      <Avatar className="h-12 w-12 shrink-0 rounded-xl">
        <AvatarImage
          src={membros.find((membro) => membro.id === visita.membro_visitado_id)?.foto_url || undefined}
          alt={visita.membro_visitado_nome}
        />
        <AvatarFallback className="rounded-xl bg-secondary text-sm font-semibold">
          {visita.membro_visitado_nome
            .split(" ")
            .map((nome) => nome[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-foreground">{visita.membro_visitado_nome}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            visita.is_past ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-primary"
          }`}>
            {visita.is_past ? "Realizada" : "Agendada"}
          </span>
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-muted-foreground">{visita.motivo}</span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateTime(visita.data_visita)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {visita.membros_presentes.length} {visita.membros_presentes.length === 1 ? "membro presente" : "membros presentes"}
        </span>
      </span>

      <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-70 transition-opacity group-hover:opacity-100" />
    </button>
    );
  };

  const renderVisitSection = (
    title: string,
    items: EnrichedVisita[],
    emptyMessage: string,
    tone: "upcoming" | "past",
  ) => (
    <section className="space-y-2.5">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-border/50 bg-card/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${tone === "upcoming" ? "bg-primary" : "bg-muted-foreground/60"}`} />
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h3>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">{items.length}</span>
      </div>

      {items.length ? (
        <div className="space-y-2.5">
          {items.map(renderVisitaItem)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  );

  const selectedMember = selectedVisita
    ? membros.find((membro) => membro.id === selectedVisita.membro_visitado_id)
    : null;

  const selectedParticipants = selectedVisita
    ? selectedVisita.membros_presentes.map((id) => membros.find((membro) => membro.id === id)).filter(Boolean) as Membro[]
    : [];

  const renderSelectedSummary = () => {
    if (!selectedVisita) return null;
    const status = selectedVisita.is_past ? "foi realizada" : "está agendada";
    const participants = selectedVisita.membros_presentes.length;
    return (
      <>
        A visita a <strong>{selectedVisita.membro_visitado_nome}</strong> {status} para{" "}
        <strong>{formatDateTime(selectedVisita.data_visita)}</strong>, com o motivo{" "}
        <strong>{selectedVisita.motivo}</strong>. Participam {participants}{" "}
        {participants === 1 ? "membro do grupo" : "membros do grupo"}.
      </>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <div className={`grid h-full min-h-0 gap-3 p-3 ${
        selectedVisita
          ? "grid-cols-[minmax(20rem,0.86fr)_minmax(36rem,1.7fr)]"
          : "grid-cols-1"
      }`}>
        <Card className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border-border/60 bg-card/90 shadow-none">
          <CardHeader className="px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Visitas registradas</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {visitasEnriquecidas.length} {visitasEnriquecidas.length === 1 ? "visita encontrada" : "visitas encontradas"}
                </p>
              </div>
              <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-secondary px-3 text-sm font-semibold tabular-nums text-foreground">
                {visitasEnriquecidas.length}
              </span>
            </div>
          </CardHeader>

          <CardContent className="min-h-0 flex-1 px-4 pb-4 pt-1">
            <div className="h-full min-h-0 overflow-y-auto p-1 pr-2 scrollbar-thin">
              {loadingVisitas || loadingMembros ? (
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <div key={index} className="flex min-h-[5.35rem] w-full items-center gap-4 rounded-2xl border border-border/55 bg-background/45 p-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-1/2" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visitasEnriquecidas.length ? (
                <div className="space-y-5">
                  {renderVisitSection("Visitas agendadas", futuras, "Nenhuma visita futura agendada.", "upcoming")}
                  {renderVisitSection("Visitas passadas", passadas, "Nenhuma visita realizada até o momento.", "past")}
                </div>
              ) : (
                <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 text-center">
                  <Handshake className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="font-semibold text-foreground">Nenhuma visita encontrada</p>
                  <p className="text-sm text-muted-foreground">Registre uma nova visita para começar.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedVisita ? (
          <Card className="flex min-h-0 flex-col overflow-hidden rounded-[20px] border-border/60 bg-card/90 shadow-none">
            <CardHeader className="px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0 rounded-xl">
                    <AvatarImage src={selectedMember?.foto_url || undefined} alt={selectedVisita.membro_visitado_nome} />
                    <AvatarFallback className="rounded-xl bg-secondary text-sm font-semibold">
                      {selectedVisita.membro_visitado_nome
                        .split(" ")
                        .map((nome) => nome[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-muted-foreground">Detalhes da visita</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        selectedVisita.is_past ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-primary"
                      }`}>
                        {selectedVisita.is_past ? "Realizada" : "Agendada"}
                      </span>
                    </div>
                    <CardTitle className="truncate text-2xl leading-tight">{selectedVisita.membro_visitado_nome}</CardTitle>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      {selectedMember?.faixa_etaria || "Faixa etária não informada"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!selectedVisita.is_past ? (
                    <button
                      type="button"
                      className="member-card-action"
                      disabled={!canWrite}
                      title={!canWrite ? "Disponível somente com conexão" : undefined}
                      onClick={() => void handleMarkAsDone(selectedVisita)}
                      aria-label="Marcar visita como concluída"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="member-card-action-label">Concluir</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="member-card-action"
                    disabled={!canWrite}
                    title={!canWrite ? "Disponível somente com conexão" : undefined}
                    onClick={() => handleEditVisita(selectedVisita)}
                    aria-label="Editar visita"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="member-card-action-label">Editar</span>
                  </button>
                  <button
                    type="button"
                    className="member-card-action member-card-action-danger"
                    disabled={!canWrite}
                    title={!canWrite ? "Disponível somente com conexão" : undefined}
                    onClick={() => setDeleteCandidate(selectedVisita)}
                    aria-label="Excluir visita"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="member-card-action-label">Excluir</span>
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-0 scrollbar-thin">
              <section className="rounded-2xl border border-border/60 bg-background/50 p-4">
                <h3 className="text-xl font-semibold text-foreground">Resumo da visita</h3>
                <p className="mt-2 text-base font-medium leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
                  {renderSelectedSummary()}
                </p>
              </section>

              <section className="grid min-h-[22rem] flex-1 grid-cols-[minmax(17rem,0.72fr)_minmax(25rem,1.28fr)] gap-4">
                <div className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border/60 bg-background/50 p-4">
                  <h3 className="text-xl font-semibold text-foreground">Informações</h3>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 rounded-xl bg-secondary/65 p-3">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data e horário</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">{formatDateTime(selectedVisita.data_visita)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-secondary/65 p-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Situação</p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {selectedVisita.is_past ? "Visita já realizada" : "Visita agendada"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl bg-secondary/65 p-3">
                      <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivo</p>
                        <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{selectedVisita.motivo}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Membros presentes</p>
                      <p className="text-xs font-medium text-muted-foreground">Equipe registrada na visita</p>
                    </div>
                    <span className="text-3xl font-bold tabular-nums text-foreground">{selectedVisita.membros_presentes.length}</span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-4">
                  <div className="flex min-h-[12rem] flex-1 flex-col rounded-2xl border border-border/60 bg-background/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold text-foreground">Participantes</h3>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {selectedParticipants.length} {selectedParticipants.length === 1 ? "membro" : "membros"}
                      </span>
                    </div>

                    {selectedParticipants.length ? (
                      <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 scrollbar-none">
                        {selectedParticipants.map((membro) => (
                          <div key={membro.id} className="flex min-w-0 items-center gap-2.5 rounded-xl bg-secondary/65 p-2.5">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={membro.foto_url || undefined} alt={membro.nome} />
                              <AvatarFallback className="text-[10px] font-semibold">
                                {membro.nome
                                  .split(" ")
                                  .map((nome) => nome[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{membro.nome}</p>
                              <p className="truncate text-xs text-muted-foreground">{membro.faixa_etaria}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 px-4 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum membro foi informado como presente.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                    <h3 className="text-xl font-semibold text-foreground">Observações</h3>
                    <p className={`mt-2 whitespace-pre-line text-sm leading-relaxed ${
                      selectedVisita.observacoes ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {selectedVisita.observacoes || "Nenhuma observação registrada para esta visita."}
                    </p>
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>
        ) : null}

        <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Sugestões de visita
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 md:space-y-4 max-h-[420px] overflow-y-auto">
              <p className="text-xs md:text-sm text-muted-foreground">
                Com base nas últimas reuniões de jovens, estes membros estão há algumas semanas sem aparecer e ainda não
                receberam uma visita registrada.
              </p>

              {loadingSuggestions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 md:h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : suggestions.length === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground">
                  Nenhum jovem em situação crítica de faltas nas últimas reuniões.
                </p>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2 md:px-3 md:py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.foto_url || undefined} alt={m.nome} />
                          <AvatarFallback className="text-[10px]">
                            {m.nome
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <p className="text-xs md:text-sm font-medium text-foreground truncate">{m.nome}</p>
                          <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                            {m.faixa_etaria} • Faltou às últimas reuniões de jovens
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 md:h-8 text-[11px] md:text-xs flex-shrink-0"
                        disabled={!canWrite}
                        title={!canWrite ? "Disponível somente com conexão" : undefined}
                        onClick={() => {
                          setSuggestionsOpen(false);
                          navigate(`/visitas/nova?membroId=${m.id}`);
                        }}
                      >
                        Agendar visita
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(deleteCandidate)} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
              <AlertDialogDescription>
                A visita a {deleteCandidate?.membro_visitado_nome || "este membro"} será excluída permanentemente.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteCandidate && void handleDeleteVisita(deleteCandidate)}
              >
                Excluir visita
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
