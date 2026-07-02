import { useEffect, useState } from "react";
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
  const [reuniao, setReuniao] = useState<ReuniaoData | null>(null);
  const [membrosPresentes, setMembrosPresentes] = useState<Membro[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [barChartData, setBarChartData] = useState<any[]>([]);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [selectedSlide, setSelectedSlide] = useState(0);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Filtros e ordenação
  const [selectedFaixas, setSelectedFaixas] = useState<string[]>([]);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);

  useEffect(() => {
    if (id) {
      loadReuniao();
    }
  }, [id]);

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

  const loadReuniao = async () => {
    try {
      const { data: reuniaoData, error: reuniaoError } = await supabase
        .from("reunioes")
        .select("*")
        .eq("id", id)
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
        .eq("reuniao_id", id);

      if (presencasError) throw presencasError;

      const membroIds = presencas?.map((p) => p.membro_id) || [];

      // tenta usar snapshot primeiro; se faltar (dados antigos), faz fallback no cadastro atual
      let membrosList: Membro[] = (presencas || [])
        .filter((p) => Boolean(p.membro_id))
        .map((p: any) => ({
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
        const { data: allMembros } = await supabase.from("membros").select("faixa_etaria");

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
  };

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
  const ageSummary = FAIXAS_ETARIAS.map((faixa) => ({
    faixa,
    total: membrosPresentes.filter((membro) => membro.faixa_etaria === faixa).length,
  }));
  const resumoItems = [
    { label: "Participantes", value: getTotalParticipantes(), icon: Users },
    { label: "Visitas", value: reuniao.numero_visitas || 0, icon: UserPlus },
    { label: "Individuais", value: reuniao.recitativos_individuais || 0, icon: Mic2 },
  ];
  const carouselSlideCount = 3;

  return (
    <div className="min-h-screen bg-background pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <div className="mx-auto w-full max-w-4xl px-3 py-4">
        {/* Header interno removido: o AppLayout já fornece voltar + título no mobile */}

        <div className="space-y-3">
          <section className="grid grid-cols-2 gap-2">
            <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Participantes</p>
                <p className="mt-1 text-2xl font-black leading-none tabular-nums text-foreground">
                  {getTotalParticipantes()}
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reunião — {formatDateLocal(reuniao.data)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
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
            <CardHeader className="pb-2">
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
            <CardContent className="pt-0">
              <Carousel setApi={setCarouselApi} opts={{ align: "start" }} className="w-full">
                <CarouselContent>
                  <CarouselItem>
                    <div className="min-h-[270px] rounded-[1.25rem] bg-background/45 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Distribuição</h3>
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {getTotalParticipantes()} pessoas
                        </Badge>
                      </div>
                      {chartData.length > 0 ? (
                        <div className="space-y-3">
                          <div className="mx-auto h-[168px] w-[168px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="52%"
                                  outerRadius="72%"
                                  startAngle={90}
                                  endAngle={-270}
                                  paddingAngle={4}
                                  cornerRadius={10}
                                  minAngle={3}
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
                                  {chartData.map((entry, index) => (
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

                  <CarouselItem>
                    <div className="min-h-[270px] rounded-[1.25rem] bg-background/45 p-3">
                      <div className="mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Participação</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Total de membros vs presentes</p>
                      </div>
                      {barChartData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={172}>
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
                          <div className="mt-2 grid grid-cols-2 gap-2">
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
                        </>
                      ) : (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                          Sem dados para comparar participação
                        </div>
                      )}
                    </div>
                  </CarouselItem>

                  <CarouselItem>
                    <div className="min-h-[270px] rounded-[1.25rem] bg-background/45 p-3">
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
                </CarouselContent>
              </Carousel>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Mic2 className="h-4 w-4 text-primary" />
                Quem orou
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
              <CardHeader>
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
              <CardContent>
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
