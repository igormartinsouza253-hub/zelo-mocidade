import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endOfMonth, format } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { usePageHeader } from "@/components/layout/PageHeaderContext";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

import { resolveHslFromCssVar } from "@/lib/resolve-color";

type Stats = {
  mediaPorFaixa: { faixa: string; media: number; total: number; percentual: number }[];
  mediaTotal: number;
  mediaPorMes: { mes: string; media: number }[];
};

type MainChartData = {
  data: string;
  fullDate: string;
  [key: string]: number | string;
};

type Oracao = {
  nome: string;
  tipo: "membro" | "visita" | "nao_identificado";
  membro_id?: string;
};

type PrayerStats = {
  totalOracoes: number;
  mediaPorReuniao: number;
  reunioesComPalavra: number;
};

export default function MobileEstatisticasReunioes() {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();

  const FAIXA_COLORS: Record<string, string> = {
    "Crianças": resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    "Meninos": resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    "Moços": resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    "Meninas": resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    "Moças": resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    "Visitas": resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
    "Recitativos Individuais": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };

  const [stats, setStats] = useState<Stats>({ mediaPorFaixa: [], mediaTotal: 0, mediaPorMes: [] });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [mainChartData, setMainChartData] = useState<MainChartData[]>([]);
  const [allFaixas, setAllFaixas] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);

  const [prayerStats, setPrayerStats] = useState<PrayerStats>({
    totalOracoes: 0,
    mediaPorReuniao: 0,
    reunioesComPalavra: 0,
  });
  const [recentWords, setRecentWords] = useState<
    { id: string; data: string; tema: string | null; palavra_referencia: string }[]
  >([]);
  const [topPrayerMembers, setTopPrayerMembers] = useState<{ id: string; nome: string; total: number }[]>([]);

  // Filtros (mantidos, mas apresentados de forma compacta)
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({});
  const [startPeriod, setStartPeriod] = useState<string>("");
  const [endPeriod, setEndPeriod] = useState<string>("");
  const [avgStartPeriod, setAvgStartPeriod] = useState<string>("");
  const [avgEndPeriod, setAvgEndPeriod] = useState<string>("");

  // Carrosséis
  const [participacaoApi, setParticipacaoApi] = useState<CarouselApi | null>(null);
  const [participacaoIndex, setParticipacaoIndex] = useState(0);
  const [oracaoApi, setOracaoApi] = useState<CarouselApi | null>(null);
  const [oracaoIndex, setOracaoIndex] = useState(0);

  const participacaoSlideCount = useMemo(
    () => participacaoApi?.scrollSnapList().length ?? 3,
    [participacaoApi],
  );
  const oracaoSlideCount = useMemo(() => oracaoApi?.scrollSnapList().length ?? 2, [oracaoApi]);

  useEffect(() => {
    setConfig({
      title: "Estatísticas",
      showBackButton: true,
      backTo: "/",
    });

    void Promise.all([loadStats(), loadRecentMeetings(), loadMainChartData(), loadPrayerAndWordStats()]);
  }, []);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    if (avgStartPeriod && avgEndPeriod) {
      void loadStats(avgStartPeriod, avgEndPeriod);
    }
  }, [avgStartPeriod, avgEndPeriod]);

  useEffect(() => {
    if (availableDates.length > 0 && !avgStartPeriod && !avgEndPeriod) {
      const dates = Array.from(new Set(availableDates.map((d) => `${d.year}-${d.month}`)));
      setAvgStartPeriod(dates[0]);
      setAvgEndPeriod(dates[dates.length - 1]);
    }
  }, [availableDates, avgStartPeriod, avgEndPeriod]);

  useEffect(() => {
    if (!participacaoApi) return;
    const update = () => setParticipacaoIndex(participacaoApi.selectedScrollSnap());
    update();
    participacaoApi.on("select", update);
    participacaoApi.on("reInit", update);
    return () => {
      participacaoApi.off("select", update);
      participacaoApi.off("reInit", update);
    };
  }, [participacaoApi]);

  useEffect(() => {
    if (!oracaoApi) return;
    const update = () => setOracaoIndex(oracaoApi.selectedScrollSnap());
    update();
    oracaoApi.on("select", update);
    oracaoApi.on("reInit", update);
    return () => {
      oracaoApi.off("select", update);
      oracaoApi.off("reInit", update);
    };
  }, [oracaoApi]);

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split("-");
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${monthNames[parseInt(month) - 1]}/${year.substring(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const toggleCategory = (category: string) => {
    setVisibleCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const getVisibleCategories = () => {
    return [...allFaixas, "Visitas", "Recitativos Individuais"].filter((cat) => visibleCategories[cat]);
  };

  const getFilteredChartData = () => {
    if (!mainChartData.length || !startPeriod || !endPeriod) return mainChartData;

    return mainChartData.filter((d) => {
      const dateKey = (d.fullDate as string).substring(0, 7);
      return dateKey >= startPeriod && dateKey <= endPeriod;
    });
  };

  const loadRecentMeetings = async () => {
    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("id, data, tema, numero_visitas")
      .order("data", { ascending: false })
      .limit(5);

    const meetingsData = await Promise.all(
      (reunioes || []).map(async (meeting) => {
        const { data: presencas } = await supabase.from("presencas").select("id").eq("reuniao_id", meeting.id);

        return {
          ...meeting,
          totalParticipantes: (presencas?.length || 0) + (meeting.numero_visitas || 0),
        };
      }),
    );

    setRecentMeetings(meetingsData);
  };

  const loadPrayerAndWordStats = async () => {
    try {
      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, tema, oracoes, palavra_referencia")
        .order("data", { ascending: false });

      if (!reunioes || reunioes.length === 0) {
        setPrayerStats({ totalOracoes: 0, mediaPorReuniao: 0, reunioesComPalavra: 0 });
        setRecentWords([]);
        setTopPrayerMembers([]);
        return;
      }

      let totalOracoes = 0;
      let reunioesComPalavra = 0;
      const palavrasRecentes: { id: string; data: string; tema: string | null; palavra_referencia: string }[] = [];
      const prayerCountMap: Record<string, { nome: string; total: number }> = {};

      for (const reuniao of reunioes as any[]) {
        if (reuniao.palavra_referencia) {
          reunioesComPalavra += 1;
          palavrasRecentes.push({
            id: reuniao.id,
            data: reuniao.data,
            tema: reuniao.tema ?? null,
            palavra_referencia: reuniao.palavra_referencia,
          });
        }

        const oracoesArray = Array.isArray(reuniao.oracoes) ? (reuniao.oracoes as Oracao[]) : [];
        totalOracoes += oracoesArray.length;

        oracoesArray.forEach((oracao) => {
          if (oracao.tipo !== "membro") return;
          const key = oracao.membro_id || oracao.nome.toLowerCase();
          if (!prayerCountMap[key]) prayerCountMap[key] = { nome: oracao.nome, total: 0 };
          prayerCountMap[key].total += 1;
        });
      }

      const mediaPorReuniao = Math.round(totalOracoes / reunioes.length);
      const top = Object.entries(prayerCountMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([id, info]) => ({ id, nome: info.nome, total: info.total }));

      setPrayerStats({ totalOracoes, mediaPorReuniao, reunioesComPalavra });
      setRecentWords(palavrasRecentes.slice(0, 5));
      setTopPrayerMembers(top);
    } catch (error) {
      console.error("Erro ao carregar estatísticas de orações e palavras:", error);
    }
  };

  const loadStats = async (filterStart?: string, filterEnd?: string) => {
    try {
      let query = supabase.from("reunioes").select("id, data, numero_visitas, recitativos_individuais").order("data", {
        ascending: false,
      });

      if (filterStart && filterEnd) {
        const startDate = `${filterStart}-01`;
        const [year, month] = filterEnd.split("-");
        const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
        query = query.gte("data", startDate).lte("data", endDate);
      }

      const { data: reunioes } = await query;

      if (!reunioes || reunioes.length === 0) {
        setStats({ mediaPorFaixa: [], mediaTotal: 0, mediaPorMes: [] });
        return;
      }

      const { data: todasPresencas } = await supabase.from("presencas").select("membro_id, reuniao_id");
      const { data: membros } = await supabase.from("membros").select("id, faixa_etaria");

      const totalMembrosPorFaixa: Record<string, number> = {};
      membros?.forEach((membro) => {
        totalMembrosPorFaixa[membro.faixa_etaria] = (totalMembrosPorFaixa[membro.faixa_etaria] || 0) + 1;
      });

      const faixasCount: Record<string, { total: number }> = {};

      for (const reuniao of reunioes as any[]) {
        const presencasReuniao = todasPresencas?.filter((p) => p.reuniao_id === reuniao.id) || [];
        const membrosIds = presencasReuniao.map((p) => p.membro_id);
        const membrosPresentes = membros?.filter((m) => membrosIds.includes(m.id)) || [];

        membrosPresentes.forEach((membro) => {
          if (!faixasCount[membro.faixa_etaria]) faixasCount[membro.faixa_etaria] = { total: 0 };
          faixasCount[membro.faixa_etaria].total += 1;
        });
      }

      const mediaPorFaixa = Object.entries(faixasCount).map(([faixa, data]) => {
        const media = data.total / reunioes.length;
        const totalMembros = totalMembrosPorFaixa[faixa] || 1;
        const percentual = (media / totalMembros) * 100;

        return {
          faixa,
          media: Math.round(media),
          total: totalMembros,
          percentual,
        };
      });

      const totalPresencas = todasPresencas?.length || 0;
      const totalVisitas = (reunioes as any[]).reduce((sum, r) => sum + (r.numero_visitas || 0), 0);
      const mediaTotal = Math.round((totalPresencas + totalVisitas) / reunioes.length);

      const monthlyData: Record<string, { total: number; count: number }> = {};
      for (const reuniao of reunioes as any[]) {
        const monthKey = reuniao.data.substring(0, 7);
        const presencasReuniao = todasPresencas?.filter((p) => p.reuniao_id === reuniao.id) || [];

        if (!monthlyData[monthKey]) monthlyData[monthKey] = { total: 0, count: 0 };
        monthlyData[monthKey].total += presencasReuniao.length + (reuniao.numero_visitas || 0);
        monthlyData[monthKey].count += 1;
      }

      const mediaPorMes = Object.entries(monthlyData)
        .map(([mes, data]) => ({ mes: formatMonth(mes), media: Math.round(data.total / data.count) }))
        .reverse()
        .slice(0, 12);

      setStats({ mediaPorFaixa, mediaTotal, mediaPorMes });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const loadMainChartData = async () => {
    try {
      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, numero_visitas, recitativos_individuais")
        .order("data", { ascending: true });

      if (!reunioes || reunioes.length === 0) return;

      const { data: todasPresencas } = await supabase.from("presencas").select("membro_id, reuniao_id");
      const { data: membros } = await supabase.from("membros").select("id, faixa_etaria");

      const faixasSet = new Set<string>();
      membros?.forEach((m) => faixasSet.add(m.faixa_etaria));
      const faixas = Array.from(faixasSet);
      setAllFaixas(faixas);

      const initialVisible: Record<string, boolean> = {};
      faixas.forEach((f) => (initialVisible[f] = true));
      initialVisible["Visitas"] = true;
      initialVisible["Recitativos Individuais"] = true;
      setVisibleCategories(initialVisible);

      const chartData: MainChartData[] = (reunioes as any[]).map((reuniao) => {
        const presencasReuniao = todasPresencas?.filter((p) => p.reuniao_id === reuniao.id) || [];
        const membrosIds = presencasReuniao.map((p) => p.membro_id);
        const membrosPresentes = membros?.filter((m) => membrosIds.includes(m.id)) || [];

        const dataPoint: MainChartData = {
          data: formatDate(reuniao.data),
          fullDate: reuniao.data,
        };

        faixas.forEach((faixa) => {
          dataPoint[faixa] = membrosPresentes.filter((m) => m.faixa_etaria === faixa).length;
        });

        dataPoint["Visitas"] = reuniao.numero_visitas || 0;
        dataPoint["Recitativos Individuais"] = reuniao.recitativos_individuais || 0;

        return dataPoint;
      });

      setMainChartData(chartData);

      const dates = (reunioes as any[]).map((r) => {
        const [year, month] = r.data.split("-");
        return { year, month };
      });
      setAvailableDates(dates);

      if (reunioes.length > 0) {
        setStartPeriod((reunioes as any[])[0].data.substring(0, 7));
        setEndPeriod((reunioes as any[])[reunioes.length - 1].data.substring(0, 7));
      }
    } catch (error) {
      console.error("Erro ao carregar dados do gráfico principal:", error);
    }
  };

  const slideHeightClass = "h-[clamp(300px,42vh,420px)]";

  return (
    <div className="h-full w-full bg-background overflow-x-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24 space-y-3 scrollbar-none">
        <header className="px-0.5">
          <p className="text-xs text-muted-foreground">
            Visão geral de participação, faixas e registros de oração.
          </p>
        </header>

        <section aria-label="Visão rápida">
          <div className="grid grid-cols-3 gap-2">
            <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Média</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{stats.mediaTotal}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">por reunião</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Período</p>
                <p className="mt-1 text-sm font-semibold text-foreground truncate">
                  {startPeriod && endPeriod ? `${formatMonth(startPeriod)} → ${formatMonth(endPeriod)}` : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">gráfico</p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Orações</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{prayerStats.totalOracoes}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">registradas</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-label="Participação">
          <Card className="bg-card text-card-foreground border-border/50 shadow-[var(--shadow-card)] rounded-[2.25rem] overflow-hidden">
            <div className="p-3">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Participação</p>
                  <h2 className="mt-1 text-sm font-semibold text-foreground">Reuniões, faixas e tendência</h2>
                </div>
              </div>

              <div className="mt-3">
                <Carousel
                  setApi={(api) => setParticipacaoApi(api)}
                  opts={{ align: "start", loop: false }}
                  className="w-full max-w-full overflow-hidden"
                >
                  <CarouselContent>
                    <CarouselItem>
                      <div className={slideHeightClass + " w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Distribuição</p>
                          <p className="mt-1 text-xs text-muted-foreground">Toque para ver detalhes por reunião</p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <Select value={startPeriod} onValueChange={setStartPeriod}>
                              <SelectTrigger className="h-10 rounded-2xl">
                                <SelectValue placeholder="Início" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(new Set(availableDates.map((d) => `${d.year}-${d.month}`))).map((date) => (
                                  <SelectItem key={date} value={date}>
                                    {formatMonth(date)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Select value={endPeriod} onValueChange={setEndPeriod}>
                              <SelectTrigger className="h-10 rounded-2xl">
                                <SelectValue placeholder="Fim" />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from(new Set(availableDates.map((d) => `${d.year}-${d.month}`))).map((date) => (
                                  <SelectItem key={date} value={date}>
                                    {formatMonth(date)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="mt-3 rounded-3xl border border-border/50 bg-muted/20 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            {allFaixas.slice(0, 4).map((faixa) => (
                              <div key={faixa} className="flex items-center gap-2">
                                <Checkbox
                                  id={`cat-${faixa}`}
                                  checked={!!visibleCategories[faixa]}
                                  onCheckedChange={() => toggleCategory(faixa)}
                                />
                                <label htmlFor={`cat-${faixa}`} className="text-xs font-medium text-foreground truncate">
                                  {faixa}
                                </label>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="cat-visitas"
                                checked={!!visibleCategories["Visitas"]}
                                onCheckedChange={() => toggleCategory("Visitas")}
                              />
                              <label htmlFor="cat-visitas" className="text-xs font-medium text-foreground truncate">
                                Visitas
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="cat-recit"
                                checked={!!visibleCategories["Recitativos Individuais"]}
                                onCheckedChange={() => toggleCategory("Recitativos Individuais")}
                              />
                              <label htmlFor="cat-recit" className="text-xs font-medium text-foreground truncate">
                                Recitativos
                              </label>
                            </div>
                          </div>
                          {allFaixas.length > 4 && (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                              Para reduzir ruído no mobile, mostramos os principais atalhos aqui (as demais faixas seguem ativas).
                            </p>
                          )}
                        </div>

                        <div className="mt-3">
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={getFilteredChartData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis
                                dataKey="data"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "11px" }}
                                angle={-35}
                                textAnchor="end"
                                height={54}
                              />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "11px" }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" />
                              {getVisibleCategories().map((category, index, array) => {
                                const isLast = index === array.length - 1;
                                return (
                                  <Bar
                                    key={category}
                                    dataKey={category}
                                    stackId="a"
                                    fill={FAIXA_COLORS[category] || resolveHslFromCssVar("--muted", "220 13% 95%")} 
                                    name={category}
                                    radius={isLast ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                                  />
                                );
                              })}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem>
                      <div className={slideHeightClass + " w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Faixas</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Média vs total de membros</h3>
                        </div>

                        <div className="mt-3 rounded-3xl border border-border/50 bg-muted/20 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Select value={avgStartPeriod} onValueChange={setAvgStartPeriod}>
                                <SelectTrigger className="h-10 rounded-2xl">
                                  <SelectValue placeholder="Início" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from(new Set(availableDates.map((d) => `${d.year}-${d.month}`))).map((date) => (
                                    <SelectItem key={date} value={date}>
                                      {formatMonth(date)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Select value={avgEndPeriod} onValueChange={setAvgEndPeriod}>
                                <SelectTrigger className="h-10 rounded-2xl">
                                  <SelectValue placeholder="Fim" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from(new Set(availableDates.map((d) => `${d.year}-${d.month}`))).map((date) => (
                                    <SelectItem key={date} value={date}>
                                      {formatMonth(date)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <p className="mt-2 text-[10px] text-muted-foreground">
                            Fundo = total de membros • Frente = média de presença
                          </p>
                        </div>

                        <div className="mt-3">
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={stats.mediaPorFaixa}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="faixa" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              <Bar dataKey="total" fill="hsl(var(--primary))" fillOpacity={0.45} radius={[8, 8, 0, 0]}>
                                {stats.mediaPorFaixa.map((entry) => (
                                  <Cell
                                    key={`cell-total-${entry.faixa}`}
                                    fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")} 
                                    fillOpacity={0.45}
                                  />
                                ))}
                              </Bar>
                              <Bar dataKey="media" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]}>
                                {stats.mediaPorFaixa.map((entry) => (
                                  <Cell
                                    key={`cell-media-${entry.faixa}`}
                                    fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")} 
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem>
                      <div className={slideHeightClass + " w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Tendência</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Média mensal (12 meses)</h3>
                        </div>

                        <div className="mt-3">
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.mediaPorMes}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              <Bar dataKey="media" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Média" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CarouselItem>
                  </CarouselContent>
                </Carousel>

                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {Array.from({ length: participacaoSlideCount }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Ir para o slide ${idx + 1}`}
                      onClick={() => participacaoApi?.scrollTo(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === participacaoIndex ? "w-8 bg-primary" : "w-3 bg-muted"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="Orações e Palavra">
          <Card className="bg-card text-card-foreground border-border/50 shadow-[var(--shadow-card)] rounded-[2.25rem] overflow-hidden">
            <div className="p-3">
              <div className="px-1">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Oração & Palavra</p>
                <h2 className="mt-1 text-sm font-semibold text-foreground">Registros e destaques</h2>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-3xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Média</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{prayerStats.mediaPorReuniao}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">por reunião</p>
                </div>
                <div className="rounded-3xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Palavra</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{prayerStats.reunioesComPalavra}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">reuniões</p>
                </div>
                <div className="rounded-3xl border border-border/50 bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Top</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{topPrayerMembers[0]?.total ?? 0}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">orações</p>
                </div>
              </div>

              <div className="mt-3">
                <Carousel
                  setApi={(api) => setOracaoApi(api)}
                  opts={{ align: "start", loop: false }}
                  className="w-full max-w-full overflow-hidden"
                >
                  <CarouselContent>
                    <CarouselItem>
                      <div className={"h-[clamp(240px,30vh,320px)] w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Top 5</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Quem mais ora</h3>
                        </div>

                        <div className="mt-3 rounded-3xl border border-border/50 bg-muted/20 p-3">
                          {topPrayerMembers.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma oração vinculada a membros ainda.</p>
                          ) : (
                            <div className="h-52">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  layout="vertical"
                                  data={topPrayerMembers}
                                  margin={{ top: 0, right: 12, bottom: 0, left: 36 }}
                                >
                                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" hide />
                                  <YAxis
                                    type="category"
                                    dataKey="nome"
                                    stroke="hsl(var(--muted-foreground))"
                                    width={80}
                                    style={{ fontSize: "11px" }}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "var(--radius)",
                                    }}
                                  />
                                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} name="Orações" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem>
                      <div className={"h-[clamp(240px,30vh,320px)] w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Últimas</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Palavras registradas</h3>
                        </div>

                        <div className="mt-3 rounded-3xl border border-border/50 bg-muted/20 p-3">
                          {recentWords.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma palavra registrada ainda.</p>
                          ) : (
                            <div className="space-y-2">
                              {recentWords.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => navigate(`/reunioes/visualizar/${item.id}`)}
                                  className="w-full text-left rounded-2xl border border-border/50 bg-card px-3 py-2 shadow-[var(--shadow-card)] active:shadow-[var(--shadow-elevated)] transition-shadow"
                                >
                                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                                    {formatDate(item.data)}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-foreground truncate">{item.palavra_referencia}</p>
                                  {item.tema && (
                                    <p className="mt-0.5 text-xs text-muted-foreground truncate">Tema: {item.tema}</p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CarouselItem>
                  </CarouselContent>
                </Carousel>

                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {Array.from({ length: oracaoSlideCount }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Ir para o slide ${idx + 1}`}
                      onClick={() => oracaoApi?.scrollTo(idx)}
                      className={`h-1.5 rounded-full transition-all ${idx === oracaoIndex ? "w-8 bg-primary" : "w-3 bg-muted"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="Últimas reuniões">
          <Card className="rounded-[2.25rem] border-border/50 bg-card shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Reuniões</p>
                  <h2 className="mt-1 text-sm font-semibold text-foreground">Últimas 5</h2>
                </div>
                <Button variant="outline" className="h-9 rounded-2xl" onClick={() => navigate("/reunioes")}>Ver todas</Button>
              </div>

              <div className="mt-3 space-y-2">
                {recentMeetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    className="w-full text-left rounded-2xl border border-border/50 bg-muted/10 px-3 py-2.5 hover:bg-muted/20 active:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/reunioes/visualizar/${meeting.id}`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{formatDate(meeting.data)}</p>
                        <p className="text-xs text-muted-foreground truncate">{meeting.tema || "Sem tema"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-primary tabular-nums">{meeting.totalParticipantes}</p>
                        <p className="text-[10px] text-muted-foreground">participantes</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

