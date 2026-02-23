import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { endOfMonth, format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { resolveHslFromCssVar } from "@/lib/resolve-color";

interface Stats {
  mediaPorFaixa: { faixa: string; media: number; total: number; percentual: number }[];
  mediaTotal: number;
  mediaPorMes: { mes: string; media: number }[];
}

interface MainChartData {
  data: string;
  [key: string]: number | string;
}

interface Oracao {
  nome: string;
  tipo: "membro" | "visita" | "nao_identificado";
  membro_id?: string;
}

interface PrayerStats {
  totalOracoes: number;
  mediaPorReuniao: number;
  reunioesComPalavra: number;
}

export default function EstatisticasReunioes({ __forceMobile, __forceDesktop }: { __forceMobile?: boolean; __forceDesktop?: boolean } = {}) {
  const FAIXA_COLORS: Record<string, string> = {
    "Crianças": resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    "Meninos": resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    "Moços": resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    "Meninas": resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    "Moças": resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    "Visitas": resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
    "Recitativos Individuais": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };

  const navigate = useNavigate();
  const isMobile = __forceMobile ? true : __forceDesktop ? false : useIsMobile();
  const { setConfig } = usePageHeader();
  const [stats, setStats] = useState<Stats>({
    mediaPorFaixa: [],
    mediaTotal: 0,
    mediaPorMes: [],
  });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [mainChartData, setMainChartData] = useState<MainChartData[]>([]);
  const [allFaixas, setAllFaixas] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);
  const [prayerStats, setPrayerStats] = useState<PrayerStats>({
    totalOracoes: 0,
    mediaPorReuniao: 0,
    reunioesComPalavra: 0,
  });
  const [recentWords, setRecentWords] = useState<{
    id: string;
    data: string;
    tema: string | null;
    palavra_referencia: string;
  }[]>([]);
  const [topPrayerMembers, setTopPrayerMembers] = useState<{
    id: string;
    nome: string;
    total: number;
  }[]>([]);
  
  // Filtros
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({});
  const [startPeriod, setStartPeriod] = useState<string>("");
  const [endPeriod, setEndPeriod] = useState<string>("");
  const [avgStartPeriod, setAvgStartPeriod] = useState<string>("");
  const [avgEndPeriod, setAvgEndPeriod] = useState<string>("");

  useEffect(() => {
    setConfig({
      title: "Estatísticas",
      icon: BarChart3,
      showBackButton: true,
      backTo: "/",
    });

    loadStats();
    loadRecentMeetings();
    loadMainChartData();
    loadPrayerAndWordStats();
  }, []);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    if (avgStartPeriod && avgEndPeriod) {
      loadStats(avgStartPeriod, avgEndPeriod);
    }
  }, [avgStartPeriod, avgEndPeriod]);

  useEffect(() => {
    applyFilters();
  }, [visibleCategories, startPeriod, endPeriod]);

  useEffect(() => {
    if (availableDates.length > 0 && !avgStartPeriod && !avgEndPeriod) {
      const dates = Array.from(new Set(availableDates.map(d => `${d.year}-${d.month}`)));
      setAvgStartPeriod(dates[0]);
      setAvgEndPeriod(dates[dates.length - 1]);
    }
  }, [availableDates]);

  const loadRecentMeetings = async () => {
    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("id, data, tema, numero_visitas")
      .order("data", { ascending: false })
      .limit(5);

    const meetingsData = await Promise.all(
      (reunioes || []).map(async (meeting) => {
        const { data: presencas } = await supabase
          .from("presencas")
          .select("id")
          .eq("reuniao_id", meeting.id);

        return {
          ...meeting,
          totalParticipantes: (presencas?.length || 0) + (meeting.numero_visitas || 0),
        };
      })
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
      const palavrasRecentes: {
        id: string;
        data: string;
        tema: string | null;
        palavra_referencia: string;
      }[] = [];
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
          if (!prayerCountMap[key]) {
            prayerCountMap[key] = { nome: oracao.nome, total: 0 };
          }
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
      // Get all meetings
      let query = supabase
        .from("reunioes")
        .select("id, data, numero_visitas, recitativos_individuais")
        .order("data", { ascending: false });

      // Apply filters if provided
      if (filterStart && filterEnd) {
        const startDate = `${filterStart}-01`;
        const [year, month] = filterEnd.split('-');
        const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), 'yyyy-MM-dd');
        query = query.gte("data", startDate).lte("data", endDate);
      }

      const { data: reunioes } = await query;

      if (!reunioes || reunioes.length === 0) {
        setStats({
          mediaPorFaixa: [],
          mediaTotal: 0,
          mediaPorMes: [],
        });
        return;
      }

      // Get all attendance records
      const { data: todasPresencas } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id");

      // Get all members
      const { data: membros } = await supabase
        .from("membros")
        .select("id, faixa_etaria");

      // Calculate total members by age group
      const totalMembrosPorFaixa: Record<string, number> = {};
      membros?.forEach(membro => {
        totalMembrosPorFaixa[membro.faixa_etaria] = (totalMembrosPorFaixa[membro.faixa_etaria] || 0) + 1;
      });

      // Calculate average attendance by age group
      const faixasCount: Record<string, { total: number; count: number }> = {};
      
      for (const reuniao of reunioes) {
        const presencasReuniao = todasPresencas?.filter(p => p.reuniao_id === reuniao.id) || [];
        const membrosIds = presencasReuniao.map(p => p.membro_id);
        const membrosPresentes = membros?.filter(m => membrosIds.includes(m.id)) || [];

        membrosPresentes.forEach(membro => {
          if (!faixasCount[membro.faixa_etaria]) {
            faixasCount[membro.faixa_etaria] = { total: 0, count: 0 };
          }
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

      // Calculate overall average
      const totalPresencas = todasPresencas?.length || 0;
      const totalVisitas = reunioes.reduce((sum, r) => sum + (r.numero_visitas || 0), 0);
      const mediaTotal = Math.round((totalPresencas + totalVisitas) / reunioes.length);

      // Calculate monthly averages
      const monthlyData: Record<string, { total: number; count: number }> = {};
      
      for (const reuniao of reunioes) {
        const monthKey = reuniao.data.substring(0, 7); // YYYY-MM
        const presencasReuniao = todasPresencas?.filter(p => p.reuniao_id === reuniao.id) || [];
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { total: 0, count: 0 };
        }
        
        monthlyData[monthKey].total += presencasReuniao.length + (reuniao.numero_visitas || 0);
        monthlyData[monthKey].count += 1;
      }

      const mediaPorMes = Object.entries(monthlyData)
        .map(([mes, data]) => ({
          mes: formatMonth(mes),
          media: Math.round(data.total / data.count),
        }))
        .reverse()
        .slice(0, 12); // Last 12 months

      setStats({
        mediaPorFaixa,
        mediaTotal,
        mediaPorMes,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split('-');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${monthNames[parseInt(month) - 1]}/${year.substring(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  const loadMainChartData = async () => {
    try {
      // Get all meetings
      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, numero_visitas, recitativos_individuais")
        .order("data", { ascending: true });

      if (!reunioes || reunioes.length === 0) return;

      // Get all attendance records
      const { data: todasPresencas } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id");

      // Get all members
      const { data: membros } = await supabase
        .from("membros")
        .select("id, faixa_etaria");

      // Get unique faixas
      const faixasSet = new Set<string>();
      membros?.forEach(m => faixasSet.add(m.faixa_etaria));
      const faixas = Array.from(faixasSet);
      setAllFaixas(faixas);

      // Initialize visible categories
      const initialVisible: Record<string, boolean> = {};
      faixas.forEach(f => initialVisible[f] = true);
      initialVisible["Visitas"] = true;
      initialVisible["Recitativos Individuais"] = true;
      setVisibleCategories(initialVisible);

      // Build chart data
      const chartData: MainChartData[] = reunioes.map(reuniao => {
        const presencasReuniao = todasPresencas?.filter(p => p.reuniao_id === reuniao.id) || [];
        const membrosIds = presencasReuniao.map(p => p.membro_id);
        const membrosPresentes = membros?.filter(m => membrosIds.includes(m.id)) || [];

        const dataPoint: MainChartData = {
          data: formatDate(reuniao.data),
          fullDate: reuniao.data,
        };

        // Count by faixa
        faixas.forEach(faixa => {
          dataPoint[faixa] = membrosPresentes.filter(m => m.faixa_etaria === faixa).length;
        });

        dataPoint["Visitas"] = reuniao.numero_visitas || 0;
        dataPoint["Recitativos Individuais"] = reuniao.recitativos_individuais || 0;

        return dataPoint;
      });

      setMainChartData(chartData);

      // Extract available dates
      const dates = reunioes.map(r => {
        const [year, month] = r.data.split('-');
        return { year, month };
      });
      setAvailableDates(dates);

      // Set default period to all
      if (reunioes.length > 0) {
        setStartPeriod(reunioes[0].data.substring(0, 7));
        setEndPeriod(reunioes[reunioes.length - 1].data.substring(0, 7));
      }
    } catch (error) {
      console.error("Erro ao carregar dados do gráfico principal:", error);
    }
  };

  const applyFilters = () => {
    // Filter will be applied in the rendering by checking visibleCategories
    // and filtering chartData by date range
  };

  const getFilteredChartData = () => {
    if (!mainChartData.length) return [];

    return mainChartData.filter(d => {
      const fullDate = d.fullDate as string;
      const dateKey = fullDate.substring(0, 7);
      return dateKey >= startPeriod && dateKey <= endPeriod;
    });
  };

  const toggleCategory = (category: string) => {
    setVisibleCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getVisibleCategories = () => {
    return [...allFaixas, "Visitas", "Recitativos Individuais"].filter(
      cat => visibleCategories[cat]
    );
  };

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full px-3 py-3 md:px-4 md:py-4 gap-4 md:gap-6 overflow-hidden">
        <p className="text-xs md:text-sm text-muted-foreground">
          Análise e métricas de participação, orações e palavras
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-4 md:space-y-6 pr-1 md:pr-2 pb-16 md:pb-4">
          {/* Gráfico Principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detalhamento de Participação por Reunião
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Distribuição de participantes por faixa etária em cada reunião
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="space-y-4 p-3 md:p-4 bg-muted/30 rounded-lg">
                <div>
                  <h4 className="text-xs md:text-sm font-semibold mb-3">Categorias Visíveis</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                    {allFaixas.map(faixa => (
                      <div key={faixa} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-${faixa}`}
                          checked={visibleCategories[faixa]}
                          onCheckedChange={() => toggleCategory(faixa)}
                        />
                        <label
                          htmlFor={`filter-${faixa}`}
                          className="text-xs md:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {faixa}
                        </label>
                      </div>
                    ))}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-visitas"
                        checked={visibleCategories["Visitas"]}
                        onCheckedChange={() => toggleCategory("Visitas")}
                      />
                      <label
                        htmlFor="filter-visitas"
                        className="text-xs md:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Visitas
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="filter-recitativos"
                        checked={visibleCategories["Recitativos Individuais"]}
                        onCheckedChange={() => toggleCategory("Recitativos Individuais")}
                      />
                      <label
                        htmlFor="filter-recitativos"
                        className="text-xs md:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Recitativos Individuais
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="text-xs md:text-sm font-semibold mb-2 block">Período Inicial</label>
                    <Select value={startPeriod} onValueChange={setStartPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o início" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(availableDates.map(d => `${d.year}-${d.month}`))).map(date => (
                          <SelectItem key={date} value={date}>
                            {formatMonth(date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs md:text-sm font-semibold mb-2 block">Período Final</label>
                    <Select value={endPeriod} onValueChange={setEndPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fim" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(availableDates.map(d => `${d.year}-${d.month}`))).map(date => (
                          <SelectItem key={date} value={date}>
                            {formatMonth(date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Gráfico */}
              <ResponsiveContainer width="100%" height={isMobile ? 260 : 420}>
                <BarChart data={getFilteredChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="data" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">{payload[0].payload.data}</p>
                            <p className="text-sm font-medium mb-1">Total: {total}</p>
                            <div className="space-y-1">
                              {payload.map((entry, index) => (
                                <div key={index} className="flex items-center justify-between gap-3 text-sm">
                                  <span className="flex items-center gap-2">
                                    <span 
                                      className="w-3 h-3 rounded-sm" 
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}
                                  </span>
                                  <span className="font-medium">
                                    {entry.value} ({total > 0 ? ((Number(entry.value) / total) * 100).toFixed(1) : 0}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                  />
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
            </CardContent>
          </Card>

          {/* Últimas Reuniões */}
          <Card>
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <BarChart3 className="h-5 w-5" />
                Últimas 5 Reuniões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {recentMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/reunioes/visualizar/${meeting.id}`)}
                  >
                    <div>
                      <p className="text-sm font-semibold">{formatDate(meeting.data)}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{meeting.tema || "Sem tema"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base md:text-lg font-medium text-primary">{meeting.totalParticipantes}</p>
                      <p className="text-[11px] md:text-xs text-muted-foreground">participantes</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Principais Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Média Total */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Média Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl md:text-4xl font-bold text-primary">{stats.mediaTotal}</div>
                <p className="text-[11px] md:text-xs text-muted-foreground mt-1">participantes por reunião</p>
              </CardContent>
            </Card>

            {/* Mais e menos frequentes */}
            {stats.mediaPorFaixa.length > 0 && (
              <>
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                  <CardHeader className="pb-2 md:pb-3">
                    <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                      Mais Frequentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-green-600">
                      {stats.mediaPorFaixa.reduce((max, curr) => (curr.percentual || 0) > (max.percentual || 0) ? curr : max).faixa}
                    </div>
                    <p className="text-[11px] md:text-xs text-muted-foreground mt-1">
                      {(stats.mediaPorFaixa.reduce((max, curr) => (curr.percentual || 0) > (max.percentual || 0) ? curr : max).percentual || 0).toFixed(1)}% média
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                  <CardHeader className="pb-2 md:pb-3">
                    <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                      Menos Frequentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl md:text-3xl font-bold text-amber-600">
                      {stats.mediaPorFaixa.reduce((min, curr) => (curr.percentual || 0) < (min.percentual || 0) ? curr : min).faixa}
                    </div>
                    <p className="text-[11px] md:text-xs text-muted-foreground mt-1">
                      {(stats.mediaPorFaixa.reduce((min, curr) => (curr.percentual || 0) < (min.percentual || 0) ? curr : min).percentual || 0).toFixed(1)}% média
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Orações e Palavras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <TrendingUp className="h-5 w-5" />
                Orações e Palavras
              </CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">
                Estatísticas de orações registradas e uso de palavras de referência
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Resumo numérico */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[11px] md:text-xs text-muted-foreground">Total de orações registradas</p>
                    <p className="text-xl md:text-2xl font-bold">{prayerStats.totalOracoes}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[11px] md:text-xs text-muted-foreground">Média de orações por reunião</p>
                    <p className="text-xl md:text-2xl font-bold">{prayerStats.mediaPorReuniao}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40">
                    <p className="text-[11px] md:text-xs text-muted-foreground">Reuniões com palavra registrada</p>
                    <p className="text-xl md:text-2xl font-bold">{prayerStats.reunioesComPalavra}</p>
                  </div>
                </div>

                {/* Últimas palavras */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Últimas 5 palavras</h4>
                  {recentWords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma palavra registrada ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentWords.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                          onClick={() => navigate(`/reunioes/visualizar/${item.id}`)}
                        >
                          <p className="text-xs text-muted-foreground mb-1">{formatDate(item.data)}</p>
                          <p className="text-sm font-medium truncate">{item.palavra_referencia}</p>
                          {item.tema && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">Tema: {item.tema}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top 5 que mais oram */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">5 membros que mais oram</h4>
                  {topPrayerMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma oração vinculada a membros ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-40 md:h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={topPrayerMembers}
                            margin={{ top: 0, right: 16, bottom: 0, left: 40 }}
                          >
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" hide />
                            <YAxis
                              type="category"
                              dataKey="nome"
                              stroke="hsl(var(--muted-foreground))"
                              width={80}
                              style={{ fontSize: '11px' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                            />
                            <Bar
                              dataKey="total"
                              fill="hsl(var(--primary))"
                              radius={[0, 8, 8, 0]}
                              name="Orações"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="space-y-1 text-sm">
                        {topPrayerMembers.map((membro, index) => (
                          <li key={membro.id} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                {index + 1}
                              </span>
                              <span className="truncate max-w-[140px]">{membro.nome}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {membro.total} oração{membro.total > 1 && "es"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Média por Faixa Etária */}
          <Card>
            <CardHeader>
              <CardTitle>Média de Participação por Faixa Etária</CardTitle>
              <p className="text-sm text-muted-foreground">
                Número médio de participantes vs total de membros por grupo
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtro de Período */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Período Inicial</label>
                    <Select value={avgStartPeriod} onValueChange={setAvgStartPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o início" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(availableDates.map(d => `${d.year}-${d.month}`))).map(date => (
                          <SelectItem key={date} value={date}>
                            {formatMonth(date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Período Final</label>
                    <Select value={avgEndPeriod} onValueChange={setAvgEndPeriod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fim" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(availableDates.map(d => `${d.year}-${d.month}`))).map(date => (
                          <SelectItem key={date} value={date}>
                            {formatMonth(date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.mediaPorFaixa}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="faixa" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-2">{data.faixa}</p>
                            <div className="space-y-1 text-sm">
                              <p>Total de membros: {data.total}</p>
                              <p>Média de presença: {data.media}</p>
                              <p>Taxa de presença: {data.percentual.toFixed(1)}%</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Background bar (total members) with 50% opacity */}
                  <Bar 
                    dataKey="total" 
                    radius={[8, 8, 0, 0]}
                    fill="hsl(var(--primary))"
                    name="Total de Membros"
                    fillOpacity={0.5}
                  >
                    {stats.mediaPorFaixa.map((entry) => (
                      <Cell 
                        key={`cell-total-${entry.faixa}`} 
                        fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")} 
                        fillOpacity={0.5}
                      />
                    ))}
                  </Bar>
                  {/* Foreground bar (average attendance) */}
                  <Bar 
                    dataKey="media" 
                    radius={[8, 8, 0, 0]}
                    fill="hsl(var(--primary))"
                    name="Média de Presença"
                  >
                    {stats.mediaPorFaixa.map((entry) => (
                      <Cell
                        key={`cell-media-${entry.faixa}`}
                        fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Média Mensal */}
          <Card>
            <CardHeader>
              <CardTitle>Média de Participação Mensal</CardTitle>
              <p className="text-sm text-muted-foreground">
                Evolução da média de participantes por mês (últimos 12 meses)
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.mediaPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="mes" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                    }} 
                  />
                  <Bar dataKey="media" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Média Mensal" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
