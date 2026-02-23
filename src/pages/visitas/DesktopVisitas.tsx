import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageHeader } from "@/components/layout/PageHeaderContext";

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

  const [membros, setMembros] = useState<Membro[]>([]);
  const [visitasRaw, setVisitasRaw] = useState<Visita[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(true);
  const [loadingMembros, setLoadingMembros] = useState(true);

  const [suggestions, setSuggestions] = useState<Membro[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [selectedVisita, setSelectedVisita] = useState<EnrichedVisita | null>(null);
  const [hoveredList, setHoveredList] = useState<"futuras" | "passadas" | null>(null);
  const { setConfig } = usePageHeader();

  useEffect(() => {
    void loadMembros();
    void loadVisitas();
  }, []);

  useEffect(() => {
    if (membros.length > 0 && visitasRaw.length >= 0) {
      void loadSuggestions();
    }
  }, [membros.length, visitasRaw.length]);

  useEffect(() => {
    const channel = supabase
      .channel("visitas-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas" },
        () => {
          void loadVisitas();
          void loadSuggestions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const loadVisitas = async () => {
    try {
      setLoadingVisitas(true);
      const { data, error } = await supabase
        .from("visitas")
        .select("*")
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
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);

      const { data: reunioes, error: reunioesError } = await supabase
        .from("reunioes")
        .select("id, data")
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
        .in("reuniao_id", reuniaoIds);

      if (presencasError) throw presencasError;

      const { data: visitasData, error: visitasError } = await supabase
        .from("visitas")
        .select("membro_visitado_id");

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
  };

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
            onClick={() => navigate("/visitas/nova")}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova visita
          </Button>
        </>
      ),
    });

    return () => setConfig(null);
  }, [isMobile, navigate, setConfig]);

  const futuras = useMemo(() => visitasEnriquecidas.filter((v) => !v.is_past), [visitasEnriquecidas]);
  const passadas = useMemo(() => visitasEnriquecidas.filter((v) => v.is_past), [visitasEnriquecidas]);

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
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitas")
        .update({ is_past: true, data_visita: now })
        .eq("id", visita.id);

      if (error) throw error;
      toast.success("Visita marcada como concluída");
    } catch (error) {
      console.error("Erro ao concluir visita:", error);
      toast.error("Erro ao concluir visita");
    }
  };

  const handleDeleteVisita = async (visita: EnrichedVisita) => {
    const confirmDelete = window.confirm("Tem certeza que deseja excluir esta visita?");
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from("visitas").delete().eq("id", visita.id);
      if (error) throw error;
      toast.success("Visita excluída com sucesso");
    } catch (error) {
      console.error("Erro ao excluir visita:", error);
      toast.error("Erro ao excluir visita");
    }
  };

  const handleEditVisita = (visita: EnrichedVisita) => {
    navigate(`/visitas/nova?id=${visita.id}`);
  };

  const renderVisitaItem = (visita: EnrichedVisita, isFuture: boolean) => (
    <button
      key={visita.id}
      type="button"
      onClick={() => setSelectedVisita(visita)}
      className="w-full text-left rounded-lg border border-border/70 bg-card p-2.5 md:p-3.5 space-y-1.5 md:space-y-2 hover:border-primary/60 hover:bg-accent/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs md:text-sm font-medium text-foreground truncate">{visita.membro_visitado_nome}</p>
          <p className="text-[11px] md:text-xs text-muted-foreground truncate">{visita.motivo}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDateTime(visita.data_visita)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isFuture && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7 md:h-8 md:w-8"
                title="Marcar como concluída"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleMarkAsDone(visita);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7 md:h-8 md:w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleEditVisita(visita);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-7 w-7 md:h-8 md:w-8 text-destructive border-destructive/70"
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteVisita(visita);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {visita.membros_presentes_nomes.length > 0 && (
        <p className="text-[10px] md:text-xs text-muted-foreground truncate">
          Com: {visita.membros_presentes_nomes.join(", ")}
        </p>
      )}
      {visita.observacoes && (
        <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">Obs.: {visita.observacoes}</p>
      )}
    </button>
  );

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full w-full px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-[420px] md:min-h-[520px]">
          <ResizablePanel defaultSize={50} minSize={40}>
            <div className="flex flex-col h-full pr-1 md:pr-2">
              <Card className="flex-1 min-h-0">
                <CardHeader className="pb-2 md:pb-3 flex items-center justify-between gap-2">
                  <CardTitle className="text-sm md:text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Detalhes da visita
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full overflow-y-auto pb-4">
                  {!selectedVisita ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                      <Users className="h-8 w-8 md:h-10 md:w-10 opacity-60" />
                      <p className="text-sm md:text-base font-medium">Selecione uma visita na lista ao lado</p>
                      <p className="text-xs md:text-sm max-w-sm">
                        Escolha uma visita futura ou passada na coluna direita para ver todos os detalhes aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 md:space-y-5">
                      <div className="flex items-start gap-3 md:gap-4">
                        <Avatar className="h-10 w-10 md:h-12 md:w-12">
                          <AvatarImage
                            src={
                              membros.find((m) => m.id === selectedVisita.membro_visitado_id)?.foto_url || undefined
                            }
                            alt={selectedVisita.membro_visitado_nome}
                          />
                          <AvatarFallback className="text-xs md:text-sm">
                            {selectedVisita.membro_visitado_nome
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm md:text-base font-semibold text-foreground truncate">
                              {selectedVisita.membro_visitado_nome}
                            </p>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] md:text-xs font-medium bg-accent text-accent-foreground">
                              {selectedVisita.is_past ? "Visita passada" : "Visita futura"}
                            </span>
                          </div>
                          <p className="text-[11px] md:text-xs text-muted-foreground">{selectedVisita.motivo}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1.5">
                          <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Data e horário
                          </p>
                          <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs md:text-sm text-foreground">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{formatDateTime(selectedVisita.data_visita)}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Situação
                          </p>
                          <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs md:text-sm text-foreground">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{selectedVisita.is_past ? "Visita já realizada" : "Agendada para a data acima"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Membros presentes
                        </p>
                        {selectedVisita.membros_presentes_nomes.length === 0 ? (
                          <p className="text-[11px] md:text-xs text-muted-foreground">
                            Nenhum membro informado como presente nesta visita.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedVisita.membros_presentes_nomes.map((nome) => {
                              const membro = membros.find((m) => m.nome === nome);
                              return (
                                <div
                                  key={nome}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2.5 py-1 text-[11px] md:text-xs text-foreground"
                                >
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={membro?.foto_url || undefined} alt={nome} />
                                    <AvatarFallback className="text-[9px]">
                                      {nome
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="max-w-[120px] md:max-w-[160px] truncate">{nome}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Observações
                        </p>
                        {selectedVisita.observacoes ? (
                          <p className="text-xs md:text-sm text-foreground whitespace-pre-line rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                            {selectedVisita.observacoes}
                          </p>
                        ) : (
                          <p className="text-[11px] md:text-xs text-muted-foreground">
                            Nenhuma observação registrada para esta visita.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/60 mt-2">
                        {!selectedVisita.is_past && (
                          <Button
                            variant="outline"
                            size={isMobile ? "sm" : "default"}
                            className="gap-1.5 md:gap-2 text-xs md:text-sm"
                            onClick={() => void handleMarkAsDone(selectedVisita)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Marcar como concluída
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size={isMobile ? "sm" : "default"}
                          className="gap-1.5 md:gap-2 text-xs md:text-sm"
                          onClick={() => handleEditVisita(selectedVisita)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar visita
                        </Button>
                        <Button
                          variant="destructive"
                          size={isMobile ? "sm" : "default"}
                          className="gap-1.5 md:gap-2 text-xs md:text-sm"
                          onClick={() => void handleDeleteVisita(selectedVisita)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir visita
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle className="hidden md:flex" />

          <ResizablePanel defaultSize={50} minSize={35}>
            <div className="flex flex-col h-full pl-1 md:pl-2">
              <div className="flex flex-col h-full gap-3 md:gap-4">
                <Card
                  className={`flex-1 min-h-0 overflow-hidden transition-[flex-grow] duration-300 ${
                    isMobile
                      ? ""
                      : hoveredList === "futuras"
                        ? "flex-[4]"
                        : hoveredList === "passadas"
                          ? "flex-[1]"
                          : "flex-[2]"
                  }`}
                  onMouseEnter={() => !isMobile && setHoveredList("futuras")}
                  onMouseLeave={() => !isMobile && setHoveredList(null)}
                >
                  <CardHeader className="pb-2 md:pb-3 flex items-center justify-between gap-2">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Visitas agendadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-full overflow-y-auto pb-4 space-y-2 md:space-y-3">
                    {loadingVisitas ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 md:h-20 w-full rounded-lg" />
                        ))}
                      </>
                    ) : futuras.length === 0 ? (
                      <p className="text-xs md:text-sm text-muted-foreground">Nenhuma visita futura agendada.</p>
                    ) : (
                      futuras.map((v) => renderVisitaItem(v, true))
                    )}
                  </CardContent>
                </Card>

                <Card
                  className={`flex-1 min-h-0 overflow-hidden transition-[flex-grow] duration-300 ${
                    isMobile
                      ? ""
                      : hoveredList === "passadas"
                        ? "flex-[4]"
                        : hoveredList === "futuras"
                          ? "flex-[1]"
                          : "flex-[2]"
                  }`}
                  onMouseEnter={() => !isMobile && setHoveredList("passadas")}
                  onMouseLeave={() => !isMobile && setHoveredList(null)}
                >
                  <CardHeader className="pb-2 md:pb-3 flex items-center justify-between gap-2">
                    <CardTitle className="text-sm md:text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Histórico de visitas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-full overflow-y-auto pb-4 space-y-2 md:space-y-3">
                    {loadingVisitas ? (
                      <>
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 md:h-20 w-full rounded-lg" />
                        ))}
                      </>
                    ) : passadas.length === 0 ? (
                      <p className="text-xs md:text-sm text-muted-foreground">Nenhuma visita registrada até o momento.</p>
                    ) : (
                      passadas.map((v) => renderVisitaItem(v, false))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

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
      </div>
    </div>
  );
}
