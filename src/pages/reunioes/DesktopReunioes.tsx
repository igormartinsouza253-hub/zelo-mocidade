import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  Eye,
  Edit,
  Filter,
  Search,
  MoreVertical,
  Handshake,
  Trash2,
  X,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDateLocal } from "@/lib/date-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { resolveHslFromCssVar } from "@/lib/resolve-color";
import { useLongPress } from "@/hooks/useLongPress";
import { useActiveGroup } from "@/hooks/useActiveGroup";

interface Reuniao {
  id: string;
  data: string;
  tema: string | null;
  observacoes: string | null;
  totalParticipantes?: number;
  totalRecitativos?: number;
  recitativos_individuais?: number;
}

interface ChartData {
  name: string;
  value: number;
  color: string;
}

type MobileMeetingCardProps = {
  reuniao: Reuniao;
  isSelected: boolean;
  selectionMode: boolean;
  onEnterSelection: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onOpen: (id: string) => void;
  formatDateMobile: (date: string) => string;
};

function MobileMeetingCard({
  reuniao,
  isSelected,
  selectionMode,
  onEnterSelection,
  onToggleSelected,
  onOpen,
  formatDateMobile,
}: MobileMeetingCardProps) {
  const longPress = useLongPress({
    onLongPress: () => onEnterSelection(reuniao.id),
  });

  return (
    <Card
      className={
        "w-full cursor-pointer rounded-3xl border border-border/55 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all hover:border-primary/35 active:bg-accent/25 " +
        (selectionMode && isSelected ? "border-primary bg-primary/10" : "")
      }
      onClick={() => (selectionMode ? onToggleSelected(reuniao.id) : onOpen(reuniao.id))}
      {...longPress}
    >
      <CardContent className="flex min-h-[76px] items-center gap-3 p-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Calendar className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{formatDateMobile(reuniao.data)}</h3>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">{reuniao.totalParticipantes} participantes</p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <span>Rec:</span>
            <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
              {reuniao.totalRecitativos}
            </span>
          </div>
        </div>

        {selectionMode ? (
          <div className="h-8 w-8 flex items-center justify-center" aria-hidden>
            {isSelected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const Reunioes = ({ __forceMobile, __forceDesktop }: { __forceMobile?: boolean; __forceDesktop?: boolean } = {}) => {
  const AGE_GROUP_COLORS: Record<string, string> = {
    "Crianças": resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    "Meninos": resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    "Meninas": resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    "Moços": resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    "Moças": resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    "Recitativos": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };
  const AGE_GROUP_LABELS = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

  const isMobile = __forceMobile ? true : __forceDesktop ? false : useIsMobile();
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [filteredReunioes, setFilteredReunioes] = useState<Reuniao[]>([]);
  const [selectedReuniao, setSelectedReuniao] = useState<Reuniao | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"recent" | "most" | "least">("recent");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [ageGroupCounts, setAgeGroupCounts] = useState<Record<string, number>>({});
  const [ageChartData, setAgeChartData] = useState<ChartData[]>([]);
  const [loadingDemographics, setLoadingDemographics] = useState(false);
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();
  const [quickFilter, setQuickFilter] = useState<"all" | "this-month" | "last-3-months">(
    "all",
  );

  // seleção por pressão (mobile)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const formatDateMobile = (date: string) => {
    const d = new Date(date + "T00:00:00");
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("pt-BR", { month: "long" });
    const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
    return `${day} de ${monthCap}`;
  };

  useEffect(() => {
    loadReunioes();
  }, [activeGroupId]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [reunioes, selectedMonth, selectedYear, sortOrder, searchTerm]);

  useEffect(() => {
    const loadDemographics = async () => {
      if (!activeGroupId || !selectedReuniao) {
        setAgeGroupCounts({});
        setAgeChartData([]);
        return;
      }

      setLoadingDemographics(true);
      try {
        const { data: presencas, error: presencasError } = await supabase
          .from("presencas")
          .select("membro_faixa_etaria")
          .eq("group_id", activeGroupId)
          .eq("reuniao_id", selectedReuniao.id);

        if (presencasError) throw presencasError;

        const counts: Record<string, number> = {
          Crianças: 0,
          Meninos: 0,
          Meninas: 0,
          Moços: 0,
          Moças: 0,
        };

        (presencas || []).forEach((presenca) => {
          const faixa = presenca.membro_faixa_etaria;
          if (faixa && counts[faixa] !== undefined) {
            counts[faixa] += 1;
          }
        });

        setAgeGroupCounts(counts);

        const chart = Object.entries(counts)
          .filter(([, value]) => value > 0)
          .map(([name, value]) => ({
            name,
            value,
            color: AGE_GROUP_COLORS[name] || "hsl(var(--primary))",
          }));

        setAgeChartData(chart);
      } catch (error) {
        console.error("Erro ao carregar distribuição por faixa etária:", error);
        setAgeGroupCounts({});
        setAgeChartData([]);
      } finally {
        setLoadingDemographics(false);
      }
    };

    loadDemographics();
  }, [activeGroupId, selectedReuniao?.id]);

  useEffect(() => {
    const now = new Date();
    const thisMonth = String(now.getMonth() + 1);
    const thisYear = String(now.getFullYear());

    const mobileFiltersMenu = (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl border border-border/70 bg-background/70 text-foreground hover:bg-accent/35"
            aria-label="Filtros e ordena\u00e7\u00e3o"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={18}
          className="w-[calc(100vw-2rem)] max-w-[22rem] translate-x-[max(1rem,calc((100vw-22rem)/2))] rounded-3xl border border-border/55 bg-background/98 p-3 text-foreground shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/94"
        >
          <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-semibold text-foreground">{"Filtros e ordena\u00e7\u00e3o"}</div>

            <div className="space-y-1.5">
              <Label className="text-xs">{"Per\u00edodo"}</Label>
              <Select
                value={quickFilter}
                onValueChange={(value: "all" | "this-month" | "last-3-months") => {
                  setQuickFilter(value);
                  if (value === "all") {
                    setSelectedMonth("all");
                    setSelectedYear("all");
                  } else if (value === "this-month") {
                    setSelectedMonth(thisMonth);
                    setSelectedYear(thisYear);
                  } else if (value === "last-3-months") {
                    setSelectedMonth("all");
                    setSelectedYear("all");
                  }
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="this-month">Este mês</SelectItem>
                  <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos os anos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {getAvailableYears().map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ordenar por</Label>
              <Select value={sortOrder} onValueChange={(v: "recent" | "most" | "least") => setSortOrder(v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recente</SelectItem>
                  <SelectItem value="most">Mais presentes</SelectItem>
                  <SelectItem value="least">Menos presentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const clearSelection = () => {
      setSelectionMode(false);
      setSelectedIds([]);
    };

    const handleEditSelected = () => {
      if (selectedIds.length !== 1) return;
      navigate(`/reunioes/${selectedIds[0]}`);
    };

    const handleDeleteSelected = async () => {
      if (selectedIds.length === 0) return;
      const ok = window.confirm(
        `Excluir ${selectedIds.length} reunião(ões)? Esta ação não pode ser desfeita.`,
      );
      if (!ok) return;

      try {
        const { error: presencasError } = await supabase
          .from("presencas")
          .delete()
          .in("reuniao_id", selectedIds);
        if (presencasError) throw presencasError;

        const { error: reunioesError } = await supabase
          .from("reunioes")
          .delete()
          .in("id", selectedIds);
        if (reunioesError) throw reunioesError;

        toast.success("Reuniões excluídas com sucesso.");
        setReunioes((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
        setFilteredReunioes((prev) => prev.filter((r) => !selectedIds.includes(r.id)));
        if (selectedReuniao && selectedIds.includes(selectedReuniao.id)) {
          setSelectedReuniao(null);
        }
        clearSelection();
      } catch (error) {
        console.error("Erro ao excluir reuniões:", error);
        toast.error("Erro ao excluir reuniões");
      }
    };

    const selectionActions = (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl border border-border/70 bg-background/70 text-foreground hover:bg-accent/35"
          onClick={clearSelection}
          aria-label="Cancelar seleção"
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl border border-border/70 bg-background/70 text-foreground hover:bg-accent/35"
          onClick={handleDeleteSelected}
          aria-label="Excluir selecionadas"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-xl border border-border/70 bg-background/70 text-foreground hover:bg-accent/35"
          onClick={handleEditSelected}
          disabled={selectedIds.length !== 1}
          aria-label="Editar selecionada"
          title={selectedIds.length !== 1 ? "Selecione exatamente 1 reunião" : "Editar"}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    );

    setConfig({
      title: selectionMode ? `${selectedIds.length} selecionada(s)` : "Reuniões",
      icon: Handshake,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Reuniões" }],
      showBackButton: true,
      backTo: "/",
      mobileSearch: isMobile
        ? {
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Buscar...",
            menu: selectionMode ? selectionActions : mobileFiltersMenu,
          }
        : undefined,
      mobilePrimaryAction: isMobile && !selectionMode
        ? {
            label: "Nova reuni\u00e3o",
            icon: Plus,
            onClick: () => navigate("/reunioes/nova"),
          }
        : undefined,
      primaryActions: !isMobile ? (
        <Button
          size="sm"
          className="gap-1.5 text-xs md:text-sm"
          onClick={() => navigate("/reunioes/nova")}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova reunião
        </Button>
      ) : null,
      secondaryActions: !isMobile ? (
        <Select
          value={quickFilter}
          onValueChange={(value: "all" | "this-month" | "last-3-months") => {
            setQuickFilter(value);
            if (value === "all") {
              setSelectedMonth("all");
              setSelectedYear("all");
            } else if (value === "this-month") {
              setSelectedMonth(thisMonth);
              setSelectedYear(thisYear);
            } else if (value === "last-3-months") {
              setSelectedMonth("all");
              setSelectedYear("all");
            }
          }}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="this-month">Este mês</SelectItem>
            <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>
      ) : null,
    });

    return () => setConfig(null);
  }, [
    navigate,
    setConfig,
    isMobile,
    quickFilter,
    selectedMonth,
    selectedYear,
    sortOrder,
    searchTerm,
    selectionMode,
    selectedIds,
    selectedReuniao,
  ]);

  const loadReunioes = async () => {
    if (!activeGroupId) {
      setReunioes([]);
      setFilteredReunioes([]);
      setSelectedReuniao(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("*")
        .eq("group_id", activeGroupId)
        .order("data", { ascending: false });

      if (error) throw error;

      const reunioesWithCount = await Promise.all(
        (data || []).map(async (reuniao) => {
          const { data: presencas } = await supabase
            .from("presencas")
            .select("id")
            .eq("group_id", activeGroupId)
            .eq("reuniao_id", reuniao.id);

          const totalMembros = presencas?.length || 0;
          const totalVisitas = reuniao.numero_visitas || 0;
          const totalRecitativos = reuniao.recitativos_individuais || 0;

          return {
            ...reuniao,
            totalParticipantes: totalMembros + totalVisitas,
            totalRecitativos: totalMembros + totalVisitas + totalRecitativos,
          } as Reuniao & { totalParticipantes: number; totalRecitativos: number };
        }),
      );

      setReunioes(reunioesWithCount);
    } catch (error) {
      console.error("Erro ao carregar reuniões:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...reunioes];

    if (selectedMonth && selectedMonth !== "all") {
      const monthNum = selectedMonth.padStart(2, "0");
      filtered = filtered.filter((r) => {
        const rMonth = r.data.substring(5, 7);
        return rMonth === monthNum;
      });
    }

    if (selectedYear && selectedYear !== "all") {
      filtered = filtered.filter((r) => {
        const rYear = r.data.substring(0, 4);
        return rYear === selectedYear;
      });
    }

    const normalizeSearch = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const term = normalizeSearch(searchTerm);
    if (term) {
      filtered = filtered.filter((r) => {
        const tema = normalizeSearch(r.tema || "");
        const dataBr = normalizeSearch(formatDateLocal(r.data));
        const dataIso = r.data.toLowerCase();
        const day = Number(r.data.substring(8, 10));
        const month = Number(r.data.substring(5, 7));
        const typedNumber = /^\d{1,2}$/.test(term) ? Number(term) : null;
        const monthName = normalizeSearch(monthNames[month - 1] || "");

        return (
          tema.includes(term) ||
          dataBr.includes(term) ||
          dataIso.includes(term) ||
          (typedNumber !== null && typedNumber >= 1 && typedNumber <= 31 && day === typedNumber) ||
          (!!monthName && monthName.includes(term))
        );
      });
    }

    if (sortOrder === "most") {
      filtered.sort((a, b) => (b.totalParticipantes || 0) - (a.totalParticipantes || 0));
    } else if (sortOrder === "least") {
      filtered.sort((a, b) => (a.totalParticipantes || 0) - (b.totalParticipantes || 0));
    } else {
      filtered.sort((a, b) => b.data.localeCompare(a.data));
    }

    setFilteredReunioes(filtered);

    if (!isMobile && filtered.length > 0) {
      setSelectedReuniao((current) => current ?? filtered[0]);
    }
  };

  const getAvailableYears = () => {
    const years = new Set<string>();
    reunioes.forEach((r) => {
      years.add(r.data.substring(0, 4));
    });
    return Array.from(years).sort().reverse();
  };

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const handleDeleteReuniao = async (id: string) => {
    const confirmDelete = window.confirm(
      "Tem certeza que deseja excluir esta reunião? Esta ação não pode ser desfeita.",
    );
    if (!confirmDelete) return;

    try {
      const { error: presencasError } = await supabase
        .from("presencas")
        .delete()
        .eq("reuniao_id", id);

      if (presencasError) throw presencasError;

      const { error: reunioesError } = await supabase.from("reunioes").delete().eq("id", id);

      if (reunioesError) throw reunioesError;

      toast.success("Reunião excluída com sucesso.");
      setReunioes((prev) => prev.filter((r) => r.id !== id));
      setFilteredReunioes((prev) => prev.filter((r) => r.id !== id));
      if (selectedReuniao?.id === id) {
        setSelectedReuniao(null);
      }
    } catch (error) {
      console.error("Erro ao excluir reunião:", error);
      toast.error("Erro ao excluir reunião");
    }
  };

  const isSplitView = !isMobile && !!selectedReuniao;

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full w-full px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        {!isMobile ? (
          <Card>
            <CardContent className="py-3 md:py-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Filter className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Filtros</h3>
                    {filteredReunioes.length > 0 && !loading && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {filteredReunioes.length} reunião
                        {filteredReunioes.length > 1 && "s"}
                      </span>
                    )}
                  </div>

                  <div className="w-full md:w-64">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por tema ou data..."
                        className="pl-8 h-8 text-xs md:h-9 md:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Mês</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-8 text-xs md:h-9 md:text-sm">
                        <SelectValue placeholder="Todos os meses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os meses</SelectItem>
                        {monthNames.map((month, index) => (
                          <SelectItem key={index + 1} value={String(index + 1)}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Ano</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="h-8 text-xs md:h-9 md:text-sm">
                        <SelectValue placeholder="Todos os anos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os anos</SelectItem>
                        {getAvailableYears().map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Ordenar por</Label>
                    <Select
                      value={sortOrder}
                      onValueChange={(v: "recent" | "most" | "least") => setSortOrder(v)}
                    >
                      <SelectTrigger className="h-8 text-xs md:h-9 md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recent">Mais recente</SelectItem>
                        <SelectItem value="most">Mais presentes</SelectItem>
                        <SelectItem value="least">Menos presentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex-1 min-h-0 mt-2 md:mt-3">
          {isSplitView ? (
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full min-h-[380px] md:min-h-[480px]"
            >
              <ResizablePanel defaultSize={40} minSize={28}>
                <div className="space-y-3 pr-1 md:pr-2 h-full overflow-y-auto pb-16 md:pb-4 scrollbar-thin">
                  {loading && (
                    <>
                      {[1, 2, 3].map((i) => (
                        <Card
                          key={i}
                          className="shadow-[var(--shadow-soft)] border-border/50"
                        >
                          <CardContent
                            className={
                              isMobile
                                ? "flex items-center gap-3 p-3"
                                : "flex items-center gap-4 p-4"
                            }
                          >
                            <div
                              className={
                                isMobile
                                  ? "h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                                  : "h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                              }
                            >
                              <Skeleton
                                className={
                                  isMobile ? "h-5 w-5 rounded-full" : "h-6 w-6 rounded-full"
                                }
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <Skeleton className="h-4 w-1/3" />
                              <Skeleton className="h-3 w-2/3" />
                              {!isMobile && <Skeleton className="h-3 w-1/2" />}
                            </div>
                            <div className="flex gap-2">
                              <Skeleton
                                className={
                                  isMobile
                                    ? "h-8 w-8 rounded-md"
                                    : "h-9 w-9 rounded-md"
                                }
                              />
                              <Skeleton
                                className={
                                  isMobile
                                    ? "h-8 w-8 rounded-md"
                                    : "h-9 w-9 rounded-md"
                                }
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}

                  {!loading &&
                    filteredReunioes.map((reuniao) => (
                      <Card
                        key={reuniao.id}
                        className={`shadow-[var(--shadow-soft)] border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer ${
                          selectedReuniao?.id === reuniao.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                        onClick={() => setSelectedReuniao(reuniao)}
                      >
                        <CardContent
                          className={
                            isMobile
                              ? "flex items-center gap-3 p-3"
                              : "flex items-center gap-4 p-4"
                          }
                        >
                          <div
                            className={
                              isMobile
                                ? "h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                                : "h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0"
                            }
                          >
                            <Calendar
                              className={
                                isMobile ? "h-5 w-5 text-primary" : "h-6 w-6 text-primary"
                              }
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3
                              className={
                                isMobile
                                  ? "text-sm font-semibold text-foreground"
                                  : "font-semibold text-foreground"
                              }
                            >
                              {isMobile
                                ? formatDateMobile(reuniao.data)
                                : formatDateLocal(reuniao.data)}
                            </h3>
                            {!isMobile && (
                              <>
                                <p className="text-sm text-muted-foreground truncate">
                                  {reuniao.tema || "Sem tema definido"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {reuniao.totalParticipantes} participantes
                                  <span className="ml-2 text-green-600 font-semibold">
                                    | Total Rec: {reuniao.totalRecitativos}
                                  </span>
                                </p>
                              </>
                            )}
                            {isMobile && (
                              <>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {reuniao.totalParticipantes} participantes
                                </p>
                                <p className="text-[10px] text-green-600 font-semibold">
                                  Rec: {reuniao.totalRecitativos}
                                </p>
                              </>
                            )}
                          </div>
                          <div
                            className="flex items-start justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={isMobile ? "h-8 w-8" : "h-9 w-9"}
                                >
                                  <MoreVertical className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(`/reunioes/visualizar/${reuniao.id}`)
                                  }
                                >
                                  Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/reunioes/${reuniao.id}`)}
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    handleDeleteReuniao(reuniao.id)
                                  }
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                  {!loading && filteredReunioes.length === 0 && (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {"Nenhuma reuni\u00e3o encontrada com os filtros selecionados"}
                      </p>
                    </div>
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="mx-2" />

              <ResizablePanel defaultSize={60} minSize={40}>
                <div className="h-full overflow-y-auto pt-2 md:pt-3 pb-16 md:pb-4 scrollbar-thin pr-1 md:pr-2">
                  {selectedReuniao ? (
                    <Card className="shadow-[var(--shadow-soft)] border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm text-muted-foreground">Detalhes da reunião</p>
                            <h2 className="text-xl font-bold text-foreground">
                              {formatDateLocal(selectedReuniao.data)}
                            </h2>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/reunioes/visualizar/${selectedReuniao.id}`)}
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              Ver detalhes completos
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => navigate(`/reunioes/${selectedReuniao.id}`)}
                              className="gap-1"
                            >
                              <Edit className="h-4 w-4" />
                              Editar
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Tema</p>
                          <p className="font-medium">
                            {selectedReuniao.tema || "Sem tema definido"}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="rounded-lg bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground">Participantes</p>
                            <p className="text-lg font-bold text-foreground">
                              {selectedReuniao.totalParticipantes}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground">Total recitativos</p>
                            <p className="text-lg font-bold text-foreground">
                              {selectedReuniao.totalRecitativos}
                            </p>
                          </div>
                          {typeof selectedReuniao.recitativos_individuais === "number" && (
                            <div className="rounded-lg bg-muted/40 p-3">
                              <p className="text-xs text-muted-foreground">Recitativos individuais</p>
                              <p className="text-lg font-bold text-foreground">
                                {selectedReuniao.recitativos_individuais}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-muted-foreground">
                              Distribuição por faixa etária
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                              {AGE_GROUP_LABELS.map((label) => (
                                <div
                                  key={label}
                                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 gap-3"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: AGE_GROUP_COLORS[label] }}
                                    />
                                    <span className="text-muted-foreground">{label}</span>
                                  </div>
                                  <span className="font-semibold text-foreground">
                                    {ageGroupCounts[label] ?? 0}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-40 sm:h-48">
                            {loadingDemographics ? (
                              <div className="w-full h-full rounded-lg bg-muted/40 animate-pulse" />
                            ) : ageChartData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={ageChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {ageChartData.map((entry, index) => (
                                      <Cell key={index} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(value: number, name: string) => [
                                      `${value} presentes`,
                                      name,
                                    ]}
                                    contentStyle={{
                                      backgroundColor: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "var(--radius)",
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center px-4">
                                Nenhum dado de faixa etária para esta reunião.
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedReuniao.observacoes && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-1">Observações</p>
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                              {selectedReuniao.observacoes}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                      {"Selecione uma reuni\u00e3o na lista ao lado para ver os detalhes"}
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="mx-auto h-full w-full max-w-[22rem] space-y-3 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+11rem)] pr-0 scrollbar-none md:max-w-none md:pb-4 md:pr-2">
              {loading && (
                <>
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="shadow-[var(--shadow-soft)] border-border/50">
                      <CardContent
                        className={
                          isMobile
                            ? "flex items-center gap-3 p-3"
                            : "flex items-center gap-4 p-4"
                        }
                      >
                        <div
                          className={
                            isMobile
                              ? "h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                              : "h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
                          }
                        >
                          <Skeleton className={isMobile ? "h-5 w-5 rounded-full" : "h-6 w-6 rounded-full"} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                          {!isMobile && <Skeleton className="h-3 w-1/2" />}
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className={isMobile ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-md"} />
                          <Skeleton className={isMobile ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-md"} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}

              {!loading &&
                filteredReunioes.map((reuniao) => (
                  <MobileMeetingCard
                    key={reuniao.id}
                    reuniao={reuniao}
                    isSelected={selectedIds.includes(reuniao.id)}
                    selectionMode={selectionMode}
                    formatDateMobile={formatDateMobile}
                    onEnterSelection={(id) => {
                      if (!isMobile) return;
                      setSelectionMode(true);
                      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                    }}
                    onToggleSelected={(id) => {
                      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
                    }}
                    onOpen={(id) => {
                      if (!isMobile) {
                        const found = filteredReunioes.find((r) => r.id === id);
                        if (found) setSelectedReuniao(found);
                        return;
                      }
                      navigate(`/reunioes/visualizar/${id}`);
                    }}
                  />
                ))}

              {!loading && filteredReunioes.length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">{"Nenhuma reuni\u00e3o encontrada com os filtros selecionados"}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reunioes;

