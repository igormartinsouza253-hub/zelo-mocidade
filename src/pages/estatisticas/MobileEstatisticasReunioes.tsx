import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endOfMonth, format } from "date-fns";
import { Maximize2, Sparkles, SlidersHorizontal } from "lucide-react";
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
import { useActiveGroup } from "@/hooks/useActiveGroup";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { resolveHslFromCssVar } from "@/lib/resolve-color";
import { cn } from "@/lib/utils";

type Stats = {
  mediaPorFaixa: { faixa: string; media: number; total: number; percentual: number }[];
  mediaTotal: number;
  mediaPorMes: { mes: string; media: number }[];
  totalReunioes: number;
  percentualGeral: number;
};

type MainChartData = {
  data: string;
  fullDate: string;
  [key: string]: number | string;
};


type RankedPrayerMember = { id: string; nome: string; total: number; foto_url?: string | null };

type TopFrequentMember = {
  id: string;
  nome: string;
  presencas: number;
  faixa_etaria: string;
  foto_url?: string | null;
};

type MonthlyInsight = {
  label: string;
  title: string;
  description: string;
  value: string;
};

function FullscreenChartDialog({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-full bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50",
            className,
          )}
          aria-label={`Abrir ${title} em tela cheia`}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] sm:max-w-2xl p-4">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export default function MobileEstatisticasReunioes() {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();

  const FAIXA_COLORS: Record<string, string> = {
    "Crianças": resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    "Meninos": resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    "Moços": resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    "Meninas": resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    "Moças": resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    "Visitas": resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
    "Recitativos Individuais": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };

  const [stats, setStats] = useState<Stats>({
    mediaPorFaixa: [],
    mediaTotal: 0,
    mediaPorMes: [],
    totalReunioes: 0,
    percentualGeral: 0,
  });
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);
  const [mainChartData, setMainChartData] = useState<MainChartData[]>([]);
  const [allFaixas, setAllFaixas] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);

  // Orações
  const [topPrayerMembers, setTopPrayerMembers] = useState<RankedPrayerMember[]>([]);

  // Seção "Membros" (mais frequentes + filtro por faixa)
  const [membersPeriod, setMembersPeriod] = useState<"1m" | "3m" | "1y">("3m");
  const [membersFaixa, setMembersFaixa] = useState<string>("all");
  const [topFrequentMembers, setTopFrequentMembers] = useState<TopFrequentMember[]>([]);

  // Filtros (mantidos, mas apresentados de forma compacta)
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({});
  const [startPeriod, setStartPeriod] = useState<string>("");
  const [endPeriod, setEndPeriod] = useState<string>("");
  const [avgStartPeriod, setAvgStartPeriod] = useState<string>("");
  const [avgEndPeriod, setAvgEndPeriod] = useState<string>("");

  // Carrossel
  const [participacaoApi, setParticipacaoApi] = useState<CarouselApi | null>(null);
  const [participacaoIndex, setParticipacaoIndex] = useState(0);

  const participacaoSlideCount = useMemo(
    () => participacaoApi?.scrollSnapList().length ?? 3,
    [participacaoApi],
  );

  useEffect(() => {
    setConfig({
      title: "Estatísticas",
      showBackButton: true,
      backTo: "/",
    });

    if (!activeGroupId) return;

    void Promise.all([
      loadStats(),
      loadRecentMeetings(),
      loadMainChartData(),
      loadTopPrayerMembers(),
      loadTopFrequentMembers(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  useEffect(() => {
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    if (activeGroupId && avgStartPeriod && avgEndPeriod) {
      void loadStats(avgStartPeriod, avgEndPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, avgStartPeriod, avgEndPeriod]);

  useEffect(() => {
    if (!activeGroupId) return;
    void loadTopFrequentMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, membersPeriod, membersFaixa]);

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
    if (!activeGroupId) return;

    const { data: reunioes } = await supabase
      .from("reunioes")
      .select("id, data, tema, numero_visitas")
      .eq("group_id", activeGroupId)
      .order("data", { ascending: false })
      .limit(5);

    const meetingsData = await Promise.all(
      (reunioes || []).map(async (meeting) => {
        const { data: presencas } = await supabase
          .from("presencas")
          .select("id")
          .eq("group_id", activeGroupId)
          .eq("reuniao_id", meeting.id);

        return {
          ...meeting,
          totalParticipantes: (presencas?.length || 0) + (meeting.numero_visitas || 0),
        };
      }),
    );

    setRecentMeetings(meetingsData);
  };

  const loadTopPrayerMembers = async () => {
    if (!activeGroupId) return;

    try {
      const { data: presencasOracao } = await supabase
        .from("presencas")
        .select("membro_id, membro_nome")
        .eq("group_id", activeGroupId)
        .eq("orou", true)
        .limit(5000);

      if (!presencasOracao || presencasOracao.length === 0) {
        setTopPrayerMembers([]);
        return;
      }

      const prayerCountMap: Record<string, { nome: string; total: number }> = {};
      presencasOracao.forEach((presenca) => {
        const key = presenca.membro_id || `nome:${(presenca.membro_nome || "não identificado").toLowerCase()}`;
        if (!prayerCountMap[key]) {
          prayerCountMap[key] = {
            nome: presenca.membro_nome || "Membro",
            total: 0,
          };
        }
        prayerCountMap[key].total += 1;
      });

      const topRaw = Object.entries(prayerCountMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([id, info]) => ({ id, nome: info.nome, total: info.total }));

      const uuidCandidates = topRaw
        .map((t) => t.id)
        .filter((id) => typeof id === "string" && id.length >= 32 && id.includes("-"));

      const { data: prayerMemberPhotos } = uuidCandidates.length
        ? await supabase.from("membros").select("id, nome, foto_url").eq("group_id", activeGroupId).in("id", uuidCandidates)
        : { data: [] as { id: string; nome: string; foto_url: string | null }[] };

      const photoMap = new Map((prayerMemberPhotos || []).map((m) => [m.id, m.foto_url] as const));
      const nameMap = new Map((prayerMemberPhotos || []).map((m) => [m.id, m.nome] as const));
      const top: RankedPrayerMember[] = topRaw.map((t) => ({
        ...t,
        nome: nameMap.get(t.id) || t.nome,
        foto_url: photoMap.get(t.id) ?? null,
      }));

      setTopPrayerMembers(top);
    } catch (error) {
      console.error("Erro ao carregar ranking de orações (mobile):", error);
      setTopPrayerMembers([]);
    }
  };


  const loadTopFrequentMembers = async () => {
    if (!activeGroupId) return;

    try {
      const now = new Date();
      let cutoffIso: string | null = null;

      if (membersPeriod === "1m") {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        cutoffIso = cutoff.toISOString().slice(0, 10);
      } else if (membersPeriod === "3m") {
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        cutoffIso = cutoff.toISOString().slice(0, 10);
      }

      let meetingIdSet: Set<string> | null = null;
      if (cutoffIso) {
        const { data: reunioesPeriodo } = await supabase
          .from("reunioes")
          .select("id")
          .eq("group_id", activeGroupId)
          .gte("data", cutoffIso);
        meetingIdSet = new Set((reunioesPeriodo || []).map((r) => r.id));
      }

      const { data: membros } = await supabase
        .from("membros")
        .select("id, nome, faixa_etaria, foto_url")
        .eq("group_id", activeGroupId);
      const { data: presencas } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id")
        .eq("group_id", activeGroupId);

      const membersFiltered = (membros || []).filter((m) => (membersFaixa === "all" ? true : m.faixa_etaria === membersFaixa));
      const memberIdSet = new Set(membersFiltered.map((m) => m.id));

      const counts: Record<string, number> = {};
      (presencas || []).forEach((p) => {
        if (!memberIdSet.has(p.membro_id)) return;
        if (meetingIdSet && !meetingIdSet.has(p.reuniao_id)) return;
        counts[p.membro_id] = (counts[p.membro_id] || 0) + 1;
      });

      const ranked: TopFrequentMember[] = membersFiltered
        .map((m) => ({
          id: m.id,
          nome: m.nome,
          faixa_etaria: m.faixa_etaria,
          foto_url: m.foto_url,
          presencas: counts[m.id] || 0,
        }))
        .filter((m) => m.presencas > 0)
        .sort((a, b) => b.presencas - a.presencas)
        .slice(0, 8);

      setTopFrequentMembers(ranked);
    } catch (error) {
      console.error("Erro ao carregar membros mais frequentes (mobile):", error);
      setTopFrequentMembers([]);
    }
  };

  const loadStats = async (filterStart?: string, filterEnd?: string) => {
    if (!activeGroupId) return;

    try {
      let query = supabase.from("reunioes").select("id, data, numero_visitas, recitativos_individuais").order("data", {
        ascending: false,
      });
      query = query.eq("group_id", activeGroupId);

      if (filterStart && filterEnd) {
        const startDate = `${filterStart}-01`;
        const [year, month] = filterEnd.split("-");
        const endDate = format(endOfMonth(new Date(parseInt(year), parseInt(month) - 1)), "yyyy-MM-dd");
        query = query.gte("data", startDate).lte("data", endDate);
      }

      const { data: reunioes } = await query;

      if (!reunioes || reunioes.length === 0) {
        setStats({
          mediaPorFaixa: [],
          mediaTotal: 0,
          mediaPorMes: [],
          totalReunioes: 0,
          percentualGeral: 0,
        });
        return;
      }

      const { data: todasPresencas } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id")
        .eq("group_id", activeGroupId);
      const { data: membros } = await supabase.from("membros").select("id, faixa_etaria").eq("group_id", activeGroupId);

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

      const totalMembros = membros?.length || 0;
      const mediaMembros = totalPresencas / reunioes.length;
      const percentualGeral = totalMembros ? Math.round((mediaMembros / totalMembros) * 100) : 0;
      const percentualGeralClamped = Math.max(0, Math.min(100, percentualGeral));

      setStats({
        mediaPorFaixa,
        mediaTotal,
        mediaPorMes,
        totalReunioes: reunioes.length,
        percentualGeral: percentualGeralClamped,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const loadMainChartData = async () => {
    if (!activeGroupId) return;

    try {
      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, numero_visitas, recitativos_individuais")
        .eq("group_id", activeGroupId)
        .order("data", { ascending: true });

      if (!reunioes || reunioes.length === 0) return;

      const { data: todasPresencas } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id")
        .eq("group_id", activeGroupId);
      const { data: membros } = await supabase.from("membros").select("id, faixa_etaria").eq("group_id", activeGroupId);

      const faixasSet = new Set<string>();
      membros?.forEach((m) => faixasSet.add(m.faixa_etaria));
      const faixas = Array.from(faixasSet);
      setAllFaixas(faixas);

      const initialVisible: Record<string, boolean> = {};
      faixas.forEach((f) => (initialVisible[f] = true));
      initialVisible["Visitas"] = false;
      initialVisible["Recitativos Individuais"] = false;
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

  const filteredChartData = getFilteredChartData();
  const visibleChartCategories = getVisibleCategories();
  const mainChartTickInterval = Math.max(0, Math.ceil(filteredChartData.length / 5) - 1);
  const totalNoPeriodo = filteredChartData.reduce((sum, item) => {
    return (
      sum +
      visibleChartCategories.reduce((categorySum, category) => {
        const value = item[category];
        return categorySum + (typeof value === "number" ? value : 0);
      }, 0)
    );
  }, 0);
  const mediaVisivelNoPeriodo = filteredChartData.length ? Math.round(totalNoPeriodo / filteredChartData.length) : 0;
  const monthlyInsights = useMemo<MonthlyInsight[]>(() => {
    if (mainChartData.length === 0) {
      return [
        {
          label: "Aguardando dados",
          title: "Sem reuniões registradas",
          description: "Os insights aparecem automaticamente quando houver reuniões no grupo atual.",
          value: "0",
        },
      ];
    }

    const attendanceCategories = [...allFaixas, "Visitas"];
    const monthKeys = Array.from(new Set(mainChartData.map((item) => String(item.fullDate).slice(0, 7)))).sort();
    const currentMonth = monthKeys[monthKeys.length - 1];
    const previousMonth = monthKeys[monthKeys.length - 2] ?? null;
    const monthRows = mainChartData.filter((item) => String(item.fullDate).startsWith(currentMonth));
    const previousRows = previousMonth ? mainChartData.filter((item) => String(item.fullDate).startsWith(previousMonth)) : [];

    const totalForRow = (row: MainChartData) =>
      attendanceCategories.reduce((sum, category) => {
        const value = row[category];
        return sum + (typeof value === "number" ? value : 0);
      }, 0);

    const currentTotal = monthRows.reduce((sum, row) => sum + totalForRow(row), 0);
    const previousTotal = previousRows.reduce((sum, row) => sum + totalForRow(row), 0);
    const currentAverage = monthRows.length ? Math.round(currentTotal / monthRows.length) : 0;
    const previousAverage = previousRows.length ? Math.round(previousTotal / previousRows.length) : 0;
    const difference = currentAverage - previousAverage;
    const differenceLabel = previousRows.length ? `${difference >= 0 ? "+" : ""}${difference}` : "novo";

    const categoryTotals = attendanceCategories
      .map((category) => ({
        category,
        total: monthRows.reduce((sum, row) => {
          const value = row[category];
          return sum + (typeof value === "number" ? value : 0);
        }, 0),
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);

    const previousCategoryTotals = new Map(
      attendanceCategories.map((category) => [
        category,
        previousRows.reduce((sum, row) => {
          const value = row[category];
          return sum + (typeof value === "number" ? value : 0);
        }, 0),
      ]),
    );

    const biggestDrop = categoryTotals
      .map((item) => ({
        category: item.category,
        drop: (previousCategoryTotals.get(item.category) ?? 0) - item.total,
      }))
      .filter((item) => item.drop > 0)
      .sort((a, b) => b.drop - a.drop)[0];

    const insights: MonthlyInsight[] = [
      {
        label: previousRows.length ? "Comparativo mensal" : "Mês atual",
        title: difference > 0 ? "Participação em alta" : difference < 0 ? "Participação abaixo do mês anterior" : "Participação estável",
        description: previousRows.length
          ? `Média de ${currentAverage} participantes por reunião no mês atual.`
          : `Média de ${currentAverage} participantes nas reuniões deste mês.`,
        value: differenceLabel,
      },
    ];

    if (categoryTotals[0]) {
      insights.push({
        label: "Faixa em destaque",
        title: categoryTotals[0].category,
        description: "Maior volume de presenças no mês atual.",
        value: String(categoryTotals[0].total),
      });
    }

    if (biggestDrop) {
      insights.push({
        label: "Ponto de atenção",
        title: biggestDrop.category,
        description: "Teve queda em relação ao mês anterior.",
        value: `-${biggestDrop.drop}`,
      });
    } else {
      insights.push({
        label: "Leitura geral",
        title: stats.percentualGeral >= 50 ? "Frequência saudável" : "Acompanhar frequência",
        description: "Baseado na média geral de presença do grupo.",
        value: `${stats.percentualGeral}%`,
      });
    }

    return insights.slice(0, 3);
  }, [allFaixas, mainChartData, stats.percentualGeral]);
  const slideHeightClass = "min-h-[450px]";

  return (
    <div className="h-full w-full bg-background overflow-x-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24 space-y-3 scrollbar-none">
        <header className="px-0.5">
          <p className="text-xs text-muted-foreground">Visão geral de participação, faixas e membros.</p>
        </header>

        <section aria-label="Visão rápida">
          <div className="grid grid-cols-3 gap-2">
            <Card className="rounded-2xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Média</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{stats.mediaTotal}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">por reunião</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Reuniões</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{filteredChartData.length}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">no período</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card shadow-[var(--shadow-card)]">
              <CardContent className="p-3">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Frequência</p>
                <p className="mt-1 text-xl font-bold text-foreground tabular-nums">{stats.percentualGeral}%</p>
                <div className="mt-1">
                  <Progress value={stats.percentualGeral} className="h-1.5 rounded-full bg-muted overflow-hidden" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-label="Insights automáticos">
          <Card className="overflow-hidden rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <div className="flex items-start gap-3 px-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Insights automáticos</p>
                  <h2 className="mt-1 text-sm font-semibold text-foreground">Atualiza todo mês</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Leitura gerada com base nas reuniões mais recentes do grupo atual.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {monthlyInsights.map((insight) => (
                  <div key={`${insight.label}-${insight.title}`} className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{insight.label}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">{insight.title}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{insight.description}</p>
                      </div>
                      <span className="inline-flex min-w-[42px] shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary tabular-nums">
                        {insight.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Participação">
          <Card className="bg-card text-card-foreground border-border/50 shadow-[var(--shadow-card)] rounded-3xl overflow-hidden">
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
                  <CarouselContent className="-ml-2">
                    <CarouselItem className="pl-2">
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

                        <div className="mt-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
                                Faixas visíveis
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {visibleChartCategories.length} categorias ativas
                              </p>
                            </div>

                            <Sheet>
                              <SheetTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-9 rounded-2xl">
                                  <SlidersHorizontal className="h-4 w-4" />
                                  <span className="ml-2 text-xs">Selecionar</span>
                                </Button>
                              </SheetTrigger>
                              <SheetContent side="bottom" className="rounded-t-3xl p-4">
                                <SheetHeader className="text-left">
                                  <SheetTitle className="text-base">Faixas visíveis</SheetTitle>
                                </SheetHeader>

                                <div className="mt-3 max-h-[56vh] overflow-auto pr-1 space-y-2 scrollbar-none">
                                  {allFaixas.map((faixa) => (
                                    <label key={faixa} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
                                      <Checkbox checked={!!visibleCategories[faixa]} onCheckedChange={() => toggleCategory(faixa)} />
                                      <span className="text-sm font-medium text-foreground truncate">{faixa}</span>
                                    </label>
                                  ))}

                                  <label className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
                                    <Checkbox
                                      checked={!!visibleCategories["Visitas"]}
                                      onCheckedChange={() => toggleCategory("Visitas")}
                                    />
                                    <span className="text-sm font-medium text-foreground">Visitas</span>
                                  </label>

                                  <label className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
                                    <Checkbox
                                      checked={!!visibleCategories["Recitativos Individuais"]}
                                      onCheckedChange={() => toggleCategory("Recitativos Individuais")}
                                    />
                                    <span className="text-sm font-medium text-foreground">Recitativos Individuais</span>
                                  </label>
                                </div>
                              </SheetContent>
                            </Sheet>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Média visível</p>
                            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{mediaVisivelNoPeriodo}</p>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-muted/10 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Reuniões</p>
                            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{filteredChartData.length}</p>
                          </div>
                        </div>

                        <div className="relative mt-3 h-[230px] rounded-2xl border border-border/50 bg-muted/10 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredChartData} margin={{ top: 8, right: 6, left: -18, bottom: 8 }} barCategoryGap="24%">
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.22} />
                              <XAxis
                                dataKey="data"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "10px" }}
                                interval={mainChartTickInterval}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={8}
                                height={26}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "10px" }}
                                axisLine={false}
                                tickLine={false}
                                width={34}
                              />
                              <Tooltip
                                cursor={{ fill: "hsl(var(--muted) / 0.14)" }}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              {visibleChartCategories.map((category, index, array) => {
                                const isLast = index === array.length - 1;
                                return (
                                  <Bar
                                    key={category}
                                    dataKey={category}
                                    stackId="a"
                                    fill={FAIXA_COLORS[category] || resolveHslFromCssVar("--muted", "220 13% 95%")}
                                    name={category}
                                    radius={isLast ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                                    maxBarSize={24}
                                  />
                                );
                              })}
                            </BarChart>
                          </ResponsiveContainer>

                          <FullscreenChartDialog title="Distribuição por reunião" className="absolute bottom-2 right-2">
                            <div className="rounded-2xl border border-border/50 bg-muted/10 p-3">
                              <ResponsiveContainer width="100%" height={420}>
                                <BarChart data={filteredChartData} margin={{ top: 8, right: 12, left: -8, bottom: 32 }} barCategoryGap="18%">
                                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.22} />
                                  <XAxis
                                    dataKey="data"
                                    stroke="hsl(var(--muted-foreground))"
                                    style={{ fontSize: "12px" }}
                                    angle={-35}
                                    textAnchor="end"
                                    height={72}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} axisLine={false} tickLine={false} />
                                  <Tooltip
                                    cursor={{ fill: "hsl(var(--muted) / 0.14)" }}
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "var(--radius)",
                                    }}
                                  />
                                  <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
                                  {visibleChartCategories.map((category, index, array) => {
                                    const isLast = index === array.length - 1;
                                    return (
                                      <Bar
                                        key={category}
                                        dataKey={category}
                                        stackId="a"
                                        fill={FAIXA_COLORS[category] || resolveHslFromCssVar("--muted", "220 13% 95%")}
                                        name={category}
                                        radius={isLast ? [10, 10, 0, 0] : [0, 0, 0, 0]}
                                        maxBarSize={30}
                                      />
                                    );
                                  })}
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </FullscreenChartDialog>
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem className="pl-2">
                      <div className={slideHeightClass + " w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Faixas</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Média vs total de membros</h3>
                        </div>

                        <div className="mt-3 rounded-2xl border border-border/50 bg-muted/20 p-3">
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

                        <div className="relative mt-3 h-[270px] rounded-2xl border border-border/50 bg-muted/10 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.mediaPorFaixa} margin={{ top: 8, right: 6, left: -18, bottom: 34 }} barCategoryGap="18%">
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.22} />
                              <XAxis
                                dataKey="faixa"
                                stroke="hsl(var(--muted-foreground))"
                                style={{ fontSize: "10px" }}
                                interval={0}
                                angle={-28}
                                textAnchor="end"
                                height={60}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "10px" }} axisLine={false} tickLine={false} width={34} />
                              <Tooltip
                                cursor={{ fill: "hsl(var(--muted) / 0.14)" }}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              <Bar dataKey="total" fill="hsl(var(--primary))" fillOpacity={0.32} radius={[10, 10, 0, 0]} maxBarSize={28}>
                                {stats.mediaPorFaixa.map((entry) => (
                                  <Cell
                                    key={`cell-total-${entry.faixa}`}
                                    fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                                    fillOpacity={0.45}
                                  />
                                ))}
                              </Bar>
                              <Bar dataKey="media" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} maxBarSize={28}>
                                {stats.mediaPorFaixa.map((entry) => (
                                  <Cell
                                    key={`cell-media-${entry.faixa}`}
                                    fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>

                          <FullscreenChartDialog title="Média vs total de membros" className="absolute bottom-2 right-2">
                            <div className="rounded-2xl border border-border/50 bg-muted/10 p-3">
                              <ResponsiveContainer width="100%" height={420}>
                                <BarChart data={stats.mediaPorFaixa} margin={{ top: 6, right: 10, left: 0, bottom: 24 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
                                  <XAxis
                                    dataKey="faixa"
                                    stroke="hsl(var(--muted-foreground))"
                                    style={{ fontSize: "12px" }}
                                    interval={0}
                                    angle={-15}
                                    textAnchor="end"
                                    height={64}
                                  />
                                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "var(--radius)",
                                    }}
                                  />
                                  <Bar dataKey="total" fill="hsl(var(--primary))" fillOpacity={0.45} radius={[10, 10, 0, 0]}>
                                    {stats.mediaPorFaixa.map((entry) => (
                                      <Cell
                                        key={`cell-total-${entry.faixa}`}
                                        fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                                        fillOpacity={0.45}
                                      />
                                    ))}
                                  </Bar>
                                  <Bar dataKey="media" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]}>
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
                          </FullscreenChartDialog>
                        </div>
                      </div>
                    </CarouselItem>

                    <CarouselItem className="pl-2">
                      <div className={slideHeightClass + " w-full min-w-0"}>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Tendência</p>
                          <h3 className="mt-1 text-sm font-semibold text-foreground">Média mensal (12 meses)</h3>
                        </div>

                        <div className="relative mt-3 h-[330px] rounded-2xl border border-border/50 bg-muted/10 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.mediaPorMes} margin={{ top: 8, right: 6, left: -18, bottom: 10 }} barCategoryGap="20%">
                              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.22} />
                              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "10px" }} axisLine={false} tickLine={false} />
                              <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "10px" }} axisLine={false} tickLine={false} width={34} />
                              <Tooltip
                                cursor={{ fill: "hsl(var(--muted) / 0.14)" }}
                                contentStyle={{
                                  backgroundColor: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "var(--radius)",
                                }}
                              />
                              <Bar dataKey="media" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} name="Média" />
                            </BarChart>
                          </ResponsiveContainer>

                          <FullscreenChartDialog title="Tendência (média mensal)" className="absolute bottom-2 right-2">
                            <div className="rounded-2xl border border-border/50 bg-muted/10 p-3">
                              <ResponsiveContainer width="100%" height={420}>
                                <BarChart data={stats.mediaPorMes} margin={{ top: 6, right: 10, left: 0, bottom: 18 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
                                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "var(--radius)",
                                    }}
                                  />
                                  <Bar dataKey="media" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} name="Média" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </FullscreenChartDialog>
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

        <section aria-label="Orações">
          <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <CardContent className="p-3">
              <div className="px-1">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Orações</p>
                <h2 className="mt-1 text-sm font-semibold text-foreground">Quem mais ora</h2>
              </div>

              <div className="mt-3 rounded-2xl border border-border/50 bg-muted/10 p-2">
                {topPrayerMembers.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Nenhuma oração vinculada a membros ainda.</p>
                ) : (
                  <div className="max-h-[260px] overflow-auto pr-1 space-y-1.5 scrollbar-none">
                    {topPrayerMembers.map((membro, index) => {
                      const canNavigate = typeof membro.id === "string" && membro.id.length >= 32 && membro.id.includes("-");
                      const Wrapper: any = canNavigate ? "button" : "div";
                      return (
                        <Wrapper
                          key={membro.id}
                          type={canNavigate ? "button" : undefined}
                          onClick={canNavigate ? () => navigate(`/membros/visualizar/${membro.id}`) : undefined}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-2 rounded-full transition-colors",
                            canNavigate ? "hover:bg-accent/60 active:bg-accent/70" : "bg-transparent",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={membro.foto_url || undefined} alt={membro.nome} />
                                <AvatarFallback>{membro.nome.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                                {index + 1}
                              </div>
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">{membro.nome}</span>
                          </div>
                          <span className="inline-flex items-center justify-center min-w-[28px] px-2 rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                            {membro.total}
                          </span>
                        </Wrapper>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Membros">
          <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Membros</p>
                  <h2 className="mt-1 text-sm font-semibold text-foreground">Mais frequentes</h2>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Select value={membersPeriod} onValueChange={(v) => setMembersPeriod(v as any)}>
                  <SelectTrigger className="h-10 rounded-2xl">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">Último mês</SelectItem>
                    <SelectItem value="3m">Últimos 3 meses</SelectItem>
                    <SelectItem value="1y">Todo período</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={membersFaixa} onValueChange={setMembersFaixa}>
                  <SelectTrigger className="h-10 rounded-2xl">
                    <SelectValue placeholder="Faixa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as faixas</SelectItem>
                    {allFaixas.map((faixa) => (
                      <SelectItem key={faixa} value={faixa}>
                        {faixa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-3 rounded-2xl border border-border/50 bg-muted/10 p-2">
                {topFrequentMembers.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Sem dados para este filtro.</p>
                ) : (
                  <div className="space-y-1.5">
                    {topFrequentMembers.map((membro, index) => (
                      <button
                        key={membro.id}
                        type="button"
                        onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-full hover:bg-accent/60 active:bg-accent/70 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={membro.foto_url || undefined} alt={membro.nome} />
                              <AvatarFallback>{membro.nome.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                              {index + 1}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{membro.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{membro.faixa_etaria}</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
                          {membro.presencas}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Últimas reuniões">
          <Card className="rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)]">
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
