import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Filter, Mic2, SortAsc, Trash2, Users, UserPlus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDateLocal } from "@/lib/date-utils";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Label as PieLabel } from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
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
import { MobileActionBar } from "@/components/mobile/MobileActionBar";
import { cn } from "@/lib/utils";

const ENABLE_MEETING_SUMMARY_SLIDES = false;
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useIsMobile } from "@/hooks/use-mobile";
interface Membro {
  id: string;
  nome: string;
  faixa_etaria: string;
  foto_url?: string | null;
  ativo?: boolean;
  orou?: boolean;
}

interface Oracao {
  nome: string;
  tipo: "membro" | "visita" | "nao_identificado";
  membro_id?: string;
}

interface ReuniaoData {
  id: string;
  data: string;
  tema: string | null;
  observacoes: string | null;
  numero_visitas: number;
  recitativos_individuais: number;
  quem_atendeu: string | null;
  palavra_referencia: string | null;
  oracoes: Oracao[] | null;
  created_by_user_id: string | null;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface BarChartData {
  faixa: string;
  total: number;
  presentes: number;
}

const FAIXA_COLORS: Record<string, string> = {
  "Crianças": "hsl(var(--faixa-criancas))",
  "Meninos": "hsl(var(--faixa-meninos))",
  "Moços": "hsl(var(--faixa-mocos))",
  "Meninas": "hsl(var(--faixa-meninas))",
  "Moças": "hsl(var(--faixa-mocas))",
  "Visitantes": "hsl(var(--faixa-visitas))"
};

const AGE_GROUP_COLORS = FAIXA_COLORS;
const FAIXAS_ETARIAS = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

const VisualizarReuniao = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { activeGroupId } = useActiveGroup();
  const isMobile = useIsMobile();
  const [reuniao, setReuniao] = useState<ReuniaoData | null>(null);
  const [membrosPresentes, setMembrosPresentes] = useState<Membro[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [barChartData, setBarChartData] = useState<BarChartData[]>([]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [selectedSlide, setSelectedSlide] = useState(0);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Filtros e ordenação
  const [selectedFaixas, setSelectedFaixas] = useState<string[]>([]);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);

  useEffect(() => {
    if (!carouselApi) return;
    const update = () => setSelectedSlide(carouselApi.selectedScrollSnap());
    update();
    carouselApi.on("select", update);
    carouselApi.on("reInit", update);
    return () => {
      carouselApi.off("select", update);
    };
  }, [carouselApi]);

  const loadReuniao = useCallback(async () => {
    if (!activeGroupId || !id) return;

    try {
      const { data: reuniaoData, error: reuniaoError } = await supabase
        .from("reunioes")
        .select("*")
        .eq("id", id)
        .eq("group_id", activeGroupId)
        .single();

      if (reuniaoError) throw reuniaoError;

      const parsedOracoes = Array.isArray(reuniaoData.oracoes)
        ? (reuniaoData.oracoes as unknown as Oracao[])
        : null;

      setReuniao({
        id: reuniaoData.id,
        data: reuniaoData.data,
        tema: reuniaoData.tema,
        observacoes: reuniaoData.observacoes,
        numero_visitas: reuniaoData.numero_visitas,
        recitativos_individuais: reuniaoData.recitativos_individuais || 0,
        quem_atendeu: reuniaoData.quem_atendeu ?? null,
        palavra_referencia: reuniaoData.palavra_referencia ?? null,
        oracoes: parsedOracoes,
        created_by_user_id: reuniaoData.created_by_user_id ?? null,
      });

      if (reuniaoData.created_by_user_id) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", reuniaoData.created_by_user_id)
          .maybeSingle();
        setCreatedByName(creatorProfile?.username ?? null);
      } else {
        setCreatedByName(null);
      }

      const { data: presencas, error: presencasError } = await supabase
        .from("presencas")
        .select("membro_id, membro_nome, membro_faixa_etaria, orou")
        .eq("group_id", activeGroupId)
        .eq("reuniao_id", id);

      if (presencasError) throw presencasError;

      const membroIds = presencas?.map((p) => p.membro_id) || [];

      // tenta usar snapshot primeiro; se faltar (dados antigos), faz fallback no cadastro atual
      let membrosList: Membro[] = (presencas || [])
        .filter((p) => Boolean(p.membro_id))
        .map((p) => ({
          id: p.membro_id,
          nome: p.membro_nome || "(sem nome)",
          faixa_etaria: p.membro_faixa_etaria || "",
          orou: Boolean(p.orou),
        }));

      const needsFallback = membrosList.some((m) => !m.faixa_etaria || m.nome === "(sem nome)");

      if (membroIds.length > 0) {
        const { data: membrosStatus, error: membrosStatusError } = await supabase
          .from("membros")
          .select("id, nome, faixa_etaria, foto_url, ativo")
          .eq("group_id", activeGroupId)
          .in("id", membroIds);

        if (membrosStatusError) throw membrosStatusError;

        const byId = new Map((membrosStatus || []).map((m) => [m.id, m] as const));

        membrosList = membrosList.map((m) => {
          const current = byId.get(m.id);
          const nome = m.nome && m.nome !== "(sem nome)" ? m.nome : (current?.nome ?? m.nome);
          const faixa = m.faixa_etaria ? m.faixa_etaria : (current?.faixa_etaria ?? m.faixa_etaria);
          return { id: m.id, nome, faixa_etaria: faixa, foto_url: current?.foto_url ?? null, ativo: current?.ativo ?? undefined, orou: m.orou };
        });

        if (needsFallback && membrosList.length === 0) {
          membrosList = (membrosStatus || []).map((m) => ({
            id: m.id,
            nome: m.nome,
            faixa_etaria: m.faixa_etaria,
            foto_url: m.foto_url ?? null,
            ativo: m.ativo,
          }));
        }

        setMembrosPresentes(membrosList);

        // Process data for chart (usa snapshot/faixa congelada)
        const faixasCount: Record<string, number> = {};
        membrosList.forEach((membro) => {
          if (!membro.faixa_etaria) return;
          faixasCount[membro.faixa_etaria] = (faixasCount[membro.faixa_etaria] || 0) + 1;
        });

        const data: ChartData[] = Object.entries(faixasCount).map(([faixa, count]) => ({
          name: faixa,
          value: count,
          color: AGE_GROUP_COLORS[faixa] || "hsl(var(--primary))",
        }));

        if (reuniaoData.numero_visitas > 0) {
          data.push({
            name: "Visitantes",
            value: reuniaoData.numero_visitas,
            color: AGE_GROUP_COLORS["Visitantes"],
          });
        }

        setChartData(data);

        // Create bar chart data (mantém como está: total atual por faixa)
        const { data: allMembros } = await supabase
          .from("membros")
          .select("faixa_etaria")
          .eq("group_id", activeGroupId);

        const faixasTotal: Record<string, number> = {};
        (allMembros || []).forEach((membro) => {
          faixasTotal[membro.faixa_etaria] = (faixasTotal[membro.faixa_etaria] || 0) + 1;
        });

        const barData = Object.keys(faixasTotal).map((faixa) => ({
          faixa,
          total: faixasTotal[faixa],
          presentes: faixasCount[faixa] || 0,
        }));
        setBarChartData(barData);
      } else {
        const data: ChartData[] = [];
        if (reuniaoData.numero_visitas > 0) {
          data.push({
            name: "Visitantes",
            value: reuniaoData.numero_visitas,
            color: AGE_GROUP_COLORS["Visitantes"],
          });
        }
        setChartData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar reunião:", error);
      navigate("/reunioes");
    }
  }, [activeGroupId, id, navigate]);

  useEffect(() => {
    void loadReuniao();
  }, [loadReuniao]);

  const getTotalParticipantes = () => {
    return membrosPresentes.length + (reuniao?.numero_visitas || 0);
  };

  // Nova lógica: se recitativos_individuais for 0, total = total participantes
  const getTotalRecitativos = () => {
    const totalParticipantes = membrosPresentes.length + (reuniao?.numero_visitas || 0);
    const recitativosIndividuais = reuniao?.recitativos_individuais || 0;
    
    if (recitativosIndividuais === 0) {
      return totalParticipantes;
    }
    return totalParticipantes + recitativosIndividuais;
  };

  const toggleFaixa = (faixa: string) => {
    setSelectedFaixas(prev =>
      prev.includes(faixa) ? prev.filter(f => f !== faixa) : [...prev, faixa]
    );
  };

  const clearFilters = () => {
    setSelectedFaixas([]);
    setSortAlphabetically(false);
  };

  // Filtrar e ordenar membros
  const getFilteredAndSortedMembros = () => {
    let filtered = membrosPresentes;
    
    if (selectedFaixas.length > 0) {
      filtered = filtered.filter(m => selectedFaixas.includes(m.faixa_etaria));
    }
    
    if (sortAlphabetically) {
      filtered = [...filtered].sort((a, b) => a.nome.localeCompare(b.nome));
    }
    
    return filtered;
  };

  // Agrupar por faixa etária
  const getMembrosGroupedByFaixa = () => {
    const filtered = getFilteredAndSortedMembros();
    const grouped: Record<string, Membro[]> = {};
    
    filtered.forEach(membro => {
      if (!grouped[membro.faixa_etaria]) {
        grouped[membro.faixa_etaria] = [];
      }
      grouped[membro.faixa_etaria].push(membro);
    });
    
    // Ordenar dentro de cada grupo se necessário
    if (sortAlphabetically) {
      Object.keys(grouped).forEach(faixa => {
        grouped[faixa].sort((a, b) => a.nome.localeCompare(b.nome));
      });
    }
    
    return grouped;
  };

  const hasActiveFilters = selectedFaixas.length > 0;

  if (!reuniao) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Carregando...</div>;
  }

  const filteredMembros = getFilteredAndSortedMembros();
  const groupedMembros = getMembrosGroupedByFaixa();
  const prayingMembers = membrosPresentes.filter((membro) => membro.orou);
  const prayingMemberNames = Array.from(new Set([
    ...prayingMembers.map((membro) => membro.nome),
    ...(reuniao.oracoes || [])
      .filter((oracao) => oracao.tipo === "membro")
      .map((oracao) => oracao.nome),
  ].filter(Boolean)));
  const ageSummary = [...FAIXAS_ETARIAS, "Visitantes"].map((faixa) => ({
    faixa,
    total: faixa === "Visitantes"
      ? (reuniao.numero_visitas || 0)
      : membrosPresentes.filter((membro) => membro.faixa_etaria === faixa).length,
  }));
  const pieChartData = chartData.length === 1
    ? [
        chartData[0],
        {
          name: "__rounding_gap",
          value: Math.max(chartData[0].value * 0.04, 0.25),
          color: "transparent",
        },
      ]
    : chartData;
  const resumoItems = [
    { label: "Participantes", value: getTotalParticipantes(), icon: Users },
    { label: "Visitas", value: reuniao.numero_visitas || 0, icon: UserPlus },
    { label: "Individuais", value: reuniao.recitativos_individuais || 0, icon: Mic2 },
  ];
  const carouselSlideCount = 2;
  const desktopGroupedMembros = FAIXAS_ETARIAS
    .map((faixa) => ({
      faixa,
      membros: membrosPresentes
        .filter((membro) => membro.faixa_etaria === faixa)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    }))
    .filter((grupo) => grupo.membros.length > 0);
  const outrosMembros = membrosPresentes
    .filter((membro) => !FAIXAS_ETARIAS.includes(membro.faixa_etaria))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  if (outrosMembros.length > 0) {
    desktopGroupedMembros.push({ faixa: "Outros", membros: outrosMembros });
  }

  if (!isMobile) {
    return (
      <div className="h-full w-full overflow-hidden bg-background p-3">
        <div className="grid h-full min-h-0 grid-cols-[minmax(24rem,0.92fr)_minmax(26rem,1fr)] gap-3">
          <section className="flex min-h-0 flex-col gap-2.5">
            <Card className="flex-none rounded-[20px] border-border/60 bg-card/90 shadow-none">
              <CardContent className="flex items-center justify-between gap-4 px-4 py-2">
                <h1 className="min-w-0 truncate text-xl font-extrabold text-foreground">
                  Reunião de Jovens <span className="font-semibold text-muted-foreground">- {formatDateLocal(reuniao.data)}</span>
                </h1>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="member-card-action member-card-action-danger"
                    onClick={() => setShowDeleteDialog(true)}
                    aria-label="Excluir reunião"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="member-card-action-label">Excluir</span>
                  </button>
                  <button
                    type="button"
                    className="member-card-action"
                    onClick={() => navigate(`/reunioes/${id}`)}
                    aria-label="Editar reunião"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="member-card-action-label">Editar</span>
                  </button>
                </div>
              </CardContent>
            </Card>

            <div className="grid flex-none grid-cols-2 gap-2.5">
              <Card className="rounded-[18px] border-border/60 bg-card/90 shadow-none">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-base font-extrabold text-foreground">Participantes</span>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-secondary px-2.5 text-xl font-black tabular-nums text-foreground">
                    {getTotalParticipantes()}
                  </span>
                </CardContent>
              </Card>
              <Card className="rounded-[18px] border-border/60 bg-card/90 shadow-none">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-base font-extrabold text-foreground">Total</span>
                  <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-secondary px-3 text-2xl font-black tabular-nums text-foreground">
                    {getTotalRecitativos()}
                  </span>
                </CardContent>
              </Card>
            </div>

            <Card className="flex-none rounded-[18px] border-border/60 bg-card/90 shadow-none">
              <CardContent className="px-4 py-2">
                <p className="text-xs font-semibold text-muted-foreground">Tema:</p>
                <p className="truncate text-sm font-extrabold text-foreground">{reuniao.tema || "Sem tema definido"}</p>
              </CardContent>
            </Card>

            <div className="grid flex-none grid-cols-2 gap-2.5">
              <Card className="rounded-[18px] border-border/60 bg-card/90 shadow-none">
                <CardContent className="px-4 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Quem atendeu:</p>
                  <p className="truncate text-sm font-extrabold text-foreground">{reuniao.quem_atendeu || "Não informado"}</p>
                </CardContent>
              </Card>
              <Card className="rounded-[18px] border-border/60 bg-card/90 shadow-none">
                <CardContent className="px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground">Palavra pregada:</p>
                  <p className="truncate text-sm font-extrabold text-foreground">{reuniao.palavra_referencia || "Não informada"}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="flex-none rounded-[18px] border-border/60 bg-card/90 shadow-none">
              <CardContent className="px-4 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-foreground">Quem orou</p>
                    <p className="text-xs font-medium text-muted-foreground">Membros que participaram da oração</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-sm font-black tabular-nums text-foreground">
                    {prayingMemberNames.length}
                  </span>
                </div>
                <div className="mt-2 flex min-h-8 flex-nowrap items-center gap-2 overflow-x-auto scrollbar-none">
                  {prayingMemberNames.length > 0 ? prayingMemberNames.map((nome) => (
                    <span key={nome} className="max-w-[48%] shrink-0 truncate rounded-full border border-border/60 bg-background/55 px-3 py-1 text-xs font-semibold text-foreground">
                      {nome}
                    </span>
                  )) : (
                    <span className="text-xs font-medium text-muted-foreground">Nenhum membro marcado nesta reunião.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border-border/60 bg-card/90 shadow-none">
              <CardHeader className="px-4 pb-1 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Dados da Reunião:</CardTitle>
                    <p className="text-xs font-medium text-muted-foreground">Distribuição, participação e resumo</p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: carouselSlideCount }).map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          selectedSlide === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-4 pb-3 pt-0">
                <Carousel setApi={setCarouselApi} opts={{ align: "start" }} className="h-full min-h-0 w-full [&>div]:h-full">
                  <CarouselContent className="ml-0 h-full min-h-0 items-stretch">
                    <CarouselItem className="flex h-full min-h-0 pl-0">
                      <div className="grid h-full w-full grid-cols-[minmax(9rem,0.86fr)_minmax(12rem,1fr)] gap-3 overflow-hidden rounded-[1.25rem] bg-background/45 p-3">
                        <div className="flex min-h-0 flex-col rounded-2xl bg-card/65 p-3">
                          <h3 className="text-sm font-extrabold text-foreground">Distribuição</h3>
                          <div className="mt-2 grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-1">
                            {ageSummary.map((item) => (
                              <div key={item.faixa} className="flex items-center justify-between gap-3">
                                <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-foreground">
                                  <span className="h-3 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: FAIXA_COLORS[item.faixa] }} />
                                  <span className="truncate">{item.faixa}</span>
                                </span>
                                <span className="text-xs font-black tabular-nums text-foreground">{String(item.total).padStart(2, "0")}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                            <span className="text-xs font-extrabold text-foreground">Total participantes</span>
                            <span className="text-lg font-black tabular-nums text-foreground">{getTotalParticipantes()}</span>
                          </div>
                        </div>
                        <div className="flex min-h-0 items-center justify-center">
                          {chartData.length > 0 ? (
                            <div className="h-full max-h-[16rem] min-h-[12rem] w-full max-w-[18rem]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="50%"
                                    outerRadius="74%"
                                    startAngle={90}
                                    endAngle={-270}
                                    paddingAngle={5}
                                    cornerRadius={999}
                                    minAngle={18}
                                    dataKey="value"
                                  >
                                    <PieLabel
                                      position="center"
                                      content={({ viewBox }) => {
                                        if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                                        return (
                                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                            <tspan x={viewBox.cx} dy="-0.2em" className="fill-foreground text-2xl font-black">
                                              {getTotalParticipantes()}
                                            </tspan>
                                            <tspan x={viewBox.cx} dy="1.45em" className="fill-muted-foreground text-[10px] font-bold">
                                              PESSOAS
                                            </tspan>
                                          </text>
                                        );
                                      }}
                                    />
                                    {pieChartData.map((entry, index) => (
                                      <Cell key={`desktop-cell-${index}`} fill={entry.color} stroke="transparent" strokeWidth={0} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <p className="text-center text-sm text-muted-foreground">Nenhum participante registrado.</p>
                          )}
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem className="flex h-full min-h-0 pl-0">
                      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] bg-background/45 p-3">
                        <div className="mb-2">
                          <h3 className="text-sm font-extrabold text-foreground">Participação</h3>
                          <p className="text-xs text-muted-foreground">Total de membros vs presentes</p>
                        </div>
                        {barChartData.length > 0 ? (
                          <div className="grid min-h-0 flex-1 grid-cols-5 gap-2 overflow-y-auto pb-1 scrollbar-none">
                            {barChartData.map((entry) => {
                              const total = Number(entry.total) || 0;
                              const presentes = Number(entry.presentes) || 0;
                              const percentual = total > 0 ? Math.min(100, Math.round((presentes / total) * 100)) : 0;
                              const color = FAIXA_COLORS[entry.faixa] || "hsl(var(--primary))";
                              return (
                                <div key={entry.faixa} className="flex min-h-[7rem] min-w-0 flex-col items-center justify-end gap-2 rounded-2xl bg-card/65 px-2 py-2">
                                  <div className="flex w-full flex-1 items-end justify-center">
                                    <div className="relative h-full min-h-[5rem] w-12 overflow-hidden rounded-full bg-muted/35 ring-1 ring-border/40">
                                      <div className="absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500" style={{ height: `${percentual}%`, backgroundColor: color }} />
                                    </div>
                                  </div>
                                  <div className="w-full text-center">
                                    <p className="truncate text-xs font-extrabold text-foreground">{entry.faixa}</p>
                                    <p className="text-[11px] font-semibold text-muted-foreground">{percentual}% <span aria-hidden="true">·</span> {presentes}/{total}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                            Sem dados para comparar participação.
                          </div>
                        )}
                      </div>
                    </CarouselItem>

                    {ENABLE_MEETING_SUMMARY_SLIDES && (
                    <CarouselItem className="flex h-full pl-0">
                      <div className="grid h-full w-full grid-cols-2 gap-3 overflow-hidden rounded-[1.25rem] bg-background/45 p-3">
                        <div className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">Total de recitativos</p>
                          <p className="mt-2 text-6xl font-black leading-none tabular-nums">{getTotalRecitativos()}</p>
                          <p className="mt-3 text-sm font-semibold opacity-85">
                            {reuniao.recitativos_individuais || 0} individuais · {reuniao.numero_visitas || 0} visitas
                          </p>
                        </div>
                        <div className="space-y-2">
                          {resumoItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.label} className="flex min-h-[3rem] items-center justify-between rounded-2xl bg-card/70 px-3 py-2">
                                <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                  <Icon className="h-4 w-4 text-primary" />
                                  {item.label}
                                </span>
                                <span className="text-xl font-black tabular-nums text-foreground">{item.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CarouselItem>
                    )}
                  </CarouselContent>
                </Carousel>
              </CardContent>
            </Card>
          </section>

          <Card className="flex min-h-0 flex-col rounded-[20px] border-border/60 bg-card/90 shadow-none">
            <CardHeader className="flex-none px-4 pb-1.5 pt-3">
              <CardTitle className="text-xl">Membros presentes</CardTitle>
              <p className="text-sm font-medium text-muted-foreground">
                {membrosPresentes.length} membro{membrosPresentes.length === 1 ? "" : "s"} organizado{membrosPresentes.length === 1 ? "" : "s"} por faixa etária
              </p>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-4 pb-4 pt-0">
              {desktopGroupedMembros.length > 0 ? (
                <div className="grid h-full min-h-0 auto-rows-max grid-cols-2 content-start gap-x-3 gap-y-3 overflow-y-auto overflow-x-hidden pr-1 scrollbar-none">
                  {desktopGroupedMembros.map((grupo) => (
                    <div key={grupo.faixa} className="col-span-2 h-auto min-h-fit">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-3 w-1.5 rounded-full" style={{ backgroundColor: FAIXA_COLORS[grupo.faixa] || "hsl(var(--primary))" }} />
                        <h3 className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
                          {grupo.faixa} ({grupo.membros.length})
                        </h3>
                      </div>
                      <div className="grid auto-rows-max grid-cols-2 gap-2">
                        {grupo.membros.map((membro) => (
                          <button
                            key={membro.id}
                            type="button"
                            className="flex min-h-[2.5rem] items-center gap-2 rounded-xl border border-border/55 bg-background/55 px-3 py-1 text-left transition-colors hover:bg-secondary/50"
                            onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                          >
                            <Avatar className="h-7 w-7 shrink-0 rounded-lg border border-border/50">
                              <AvatarImage className="rounded-lg object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                              <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                {membro.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{membro.nome}</span>
                            {membro.orou ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="Orou" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground">
                  Nenhum membro presente registrado.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta reunião? Esta ação não pode ser desfeita e todos os registros de presença serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!id) return;
                  await supabase.from("presencas").delete().eq("reuniao_id", id);
                  const { error } = await supabase.from("reunioes").delete().eq("id", id);
                  if (error) throw error;
                  navigate("/reunioes");
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <div className="mx-auto w-full max-w-4xl px-2.5 py-3">
        {/* Header interno removido: o AppLayout já fornece voltar + título no mobile */}

        <div className="space-y-3">
          <section className="grid grid-cols-2 gap-2">
            <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
              <CardContent className="p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Participantes</p>
                <p className="mt-1 text-2xl font-black leading-none tabular-nums text-foreground">
                  {getTotalParticipantes()}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
              <CardContent className="p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total recitativos</p>
                <p
                  className="mt-1 text-2xl font-black leading-none tabular-nums"
                  style={{ color: "hsl(var(--faixa-recitativos))" }}
                >
                  {getTotalRecitativos()}
                </p>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
            <CardHeader className="px-3 pb-2 pt-3">
              <CardTitle className="text-base">Reunião — {formatDateLocal(reuniao.data)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 px-3 pb-3 pt-0">
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <span className="text-xs text-muted-foreground">Tema</span>
                  <p className="font-medium text-sm">{reuniao.tema || "Sem tema definido"}</p>
                </div>

                {reuniao.quem_atendeu ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Quem atendeu</span>
                    <p className="font-medium text-sm">{reuniao.quem_atendeu}</p>
                  </div>
                ) : null}

                {reuniao.palavra_referencia ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Palavra</span>
                    <p className="font-medium text-sm">{reuniao.palavra_referencia}</p>
                  </div>
                ) : null}

                <div>
                  <span className="text-xs text-muted-foreground">Recitativos individuais</span>
                  <p className="font-medium text-sm">{reuniao.recitativos_individuais || 0}</p>
                </div>

                {reuniao.observacoes ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Observações</span>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{reuniao.observacoes}</p>
                  </div>
                ) : null}

                {Array.isArray(reuniao.oracoes) && reuniao.oracoes.length > 0 ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Orações registradas</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(reuniao.oracoes as Oracao[]).map((oracao, index) => (
                        <Badge
                          key={index}
                          variant={
                            oracao.tipo === "membro"
                              ? "outline"
                              : oracao.tipo === "visita"
                                ? "secondary"
                                : "destructive"
                          }
                          className="text-[11px]"
                        >
                          {oracao.nome}
                          {oracao.tipo === "visita" ? (
                            <span className="ml-1 text-[10px] opacity-80">(visita)</span>
                          ) : null}
                          {oracao.tipo === "nao_identificado" ? (
                            <span className="ml-1 text-[10px] opacity-80">(não identificado)</span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-1 text-xs text-muted-foreground">
                Criado por <span className="font-medium text-foreground">{createdByName ?? "usuário não identificado"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
            <CardHeader className="px-3 pb-1.5 pt-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    Dados da reunião
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Distribuição, participação e resumo
                  </p>
                </div>
                <div className="flex gap-1 pt-1">
                  {Array.from({ length: carouselSlideCount }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        selectedSlide === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/25"
                      )}
                    />
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              <Carousel setApi={setCarouselApi} opts={{ align: "start" }} className="w-full">
                <CarouselContent className="items-stretch">
                  <CarouselItem className="flex">
                    <div className="flex h-[320px] w-full flex-col overflow-hidden rounded-[1.25rem] bg-background/45 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Distribuição</h3>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {getTotalParticipantes()} pessoas
                        </Badge>
                      </div>
                      {chartData.length > 0 ? (
                        <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
                          <div className="mx-auto h-[148px] w-[148px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieChartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="52%"
                                  outerRadius="72%"
                                  startAngle={90}
                                  endAngle={-270}
                                  paddingAngle={5}
                                  cornerRadius={999}
                                  minAngle={18}
                                  fill="hsl(var(--primary))"
                                  dataKey="value"
                                >
                                  <PieLabel
                                    position="center"
                                    content={({ viewBox }) => {
                                      if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                                      return (
                                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                          <tspan x={viewBox.cx} dy="-0.2em" className="fill-foreground text-2xl font-bold">
                                            {getTotalParticipantes()}
                                          </tspan>
                                          <tspan x={viewBox.cx} dy="1.5em" className="fill-muted-foreground text-[10px] font-medium">
                                            pessoas
                                          </tspan>
                                        </text>
                                      );
                                    }}
                                  />
                                  {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" strokeWidth={0} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {chartData.map((entry, index) => (
                              <div key={index} className="flex items-center justify-between gap-2 rounded-2xl bg-card/70 px-2.5 py-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                                  <span className="truncate text-[11px] font-medium text-muted-foreground">{entry.name}</span>
                                </div>
                                <span className="text-[11px] font-bold tabular-nums text-foreground">{entry.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          Nenhum participante registrado nesta reunião
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  <CarouselItem className="flex">
                    <div className="flex h-[320px] w-full flex-col overflow-hidden rounded-[1.25rem] bg-background/45 p-2.5">
                      <div className="mb-2">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Participação</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Total de membros vs presentes</p>
                      </div>
                      {barChartData.length > 0 ? (
                        <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
                          <ResponsiveContainer width="100%" height={176}>
                            <BarChart data={barChartData} barGap={4}>
                              <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} style={{ fontSize: "10px" }} />
                              <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={26} style={{ fontSize: "10px" }} />
                              <Bar dataKey="total" fillOpacity={0.28} name="Total" radius={[10, 10, 4, 4]}>
                                {barChartData.map((entry, index) => (
                                  <Cell key={`cell-total-${index}`} fill={FAIXA_COLORS[entry.faixa] || "hsl(var(--muted))"} />
                                ))}
                              </Bar>
                              <Bar dataKey="presentes" name="Presentes" radius={[10, 10, 4, 4]}>
                                {barChartData.map((entry, index) => (
                                  <Cell key={`cell-presentes-${index}`} fill={FAIXA_COLORS[entry.faixa] || "hsl(var(--primary))"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-2xl bg-card/70 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/45" />
                                <span className="text-[11px] font-semibold text-muted-foreground">Total</span>
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">Membros cadastrados</p>
                            </div>
                            <div className="rounded-2xl bg-card/70 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                                <span className="text-[11px] font-semibold text-muted-foreground">Presentes</span>
                              </div>
                              <p className="mt-1 text-[10px] text-muted-foreground">Nesta reunião</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          Sem dados para comparar participação
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  {ENABLE_MEETING_SUMMARY_SLIDES && (
                  <CarouselItem className="flex">
                    <div className="h-[320px] w-full overflow-y-auto rounded-[1.25rem] bg-background/45 p-2.5 scrollbar-none">
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Resumo</h3>
                      <div className="mt-3 rounded-3xl bg-primary px-4 py-3 text-primary-foreground shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">Total de recitativos</p>
                        <p className="mt-1 text-4xl font-black leading-none tabular-nums">{getTotalRecitativos()}</p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {resumoItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.label} className="rounded-2xl bg-card/70 p-2.5">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                              <p className="mt-2 text-lg font-black leading-none tabular-nums">{item.value}</p>
                              <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.label}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {ageSummary.map((item) => (
                          <div key={item.faixa} className="flex items-center justify-between rounded-2xl bg-card/70 px-3 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: FAIXA_COLORS[item.faixa] }} />
                              {item.faixa}
                            </span>
                            <span className="text-xs font-bold tabular-nums text-foreground">{item.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CarouselItem>
                  )}
                </CarouselContent>
              </Carousel>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
            <CardHeader className="px-3 pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mic2 className="h-4 w-4 text-primary" />
                Quem orou
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0">
              {prayingMembers.length > 0 || (Array.isArray(reuniao.oracoes) && reuniao.oracoes.length > 0) ? (
                <div className="flex flex-wrap gap-2">
                  {prayingMembers.map((membro) => (
                    <Badge key={membro.id} variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                      {membro.nome}
                    </Badge>
                  ))}
                  {(reuniao.oracoes || []).map((oracao, index) => (
                    <Badge key={`${oracao.nome}-${index}`} variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                      {oracao.nome}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma oração marcada nesta reunião.</p>
              )}
            </CardContent>
          </Card>

          {membrosPresentes.length > 0 && (
            <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
              <CardHeader className="px-3 pb-2 pt-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Membros presentes ({filteredMembros.length})</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={sortAlphabetically ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSortAlphabetically(!sortAlphabetically)}
                      className="gap-1"
                    >
                      <SortAsc className="h-4 w-4" />
                      A-Z
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Filter className="h-4 w-4" />
                          Filtrar
                          {hasActiveFilters && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                              {selectedFaixas.length}
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="end">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Faixa etária</h4>
                            {hasActiveFilters && (
                              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-1 text-xs">
                                Limpar
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {FAIXAS_ETARIAS.map((faixa) => (
                              <div key={faixa} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`filter-${faixa}`}
                                  checked={selectedFaixas.includes(faixa)}
                                  onCheckedChange={() => toggleFaixa(faixa)}
                                />
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: FAIXA_COLORS[faixa] }} />
                                <Label htmlFor={`filter-${faixa}`} className="text-sm cursor-pointer">
                                  {faixa}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="space-y-4">
                  {Object.entries(groupedMembros).map(([faixa, membros]) => (
                    <div key={faixa}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: FAIXA_COLORS[faixa] }} />
                        <h4 className="font-semibold text-sm">
                          {faixa} ({membros.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {membros.map((membro) => (
                          <button
                            key={membro.id}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-background/55 p-2.5 text-left transition-colors hover:bg-accent/25"
                            onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                          >
                            <Avatar className="h-10 w-10 rounded-2xl border border-border/50">
                              <AvatarImage className="rounded-2xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary text-xs">
                                {membro.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">{membro.nome}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {membro.ativo === false ? "Não faz mais parte da mocidade" : membro.faixa_etaria}
                              </span>
                            </div>
                            {membro.orou ? <Badge variant="secondary" className="rounded-full text-[10px]">Orou</Badge> : null}
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: FAIXA_COLORS[membro.faixa_etaria] }}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <MobileActionBar floating>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </Button>
        <Button
          type="button"
          className="gap-2"
          onClick={() => navigate(`/reunioes/${id}`)}
        >
          <Edit className="h-4 w-4" />
          Editar
        </Button>
      </MobileActionBar>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta reunião? Esta ação não pode ser desfeita e todos os registros de presença serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!id) return;
                await supabase.from("presencas").delete().eq("reuniao_id", id);
                const { error } = await supabase.from("reunioes").delete().eq("id", id);
                if (error) throw error;
                navigate("/reunioes");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VisualizarReuniao;
