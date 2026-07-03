import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangle,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Clock,
  Handshake,
  History,
  ListFilter,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLongPress } from "@/hooks/useLongPress";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  membro_visitado_avatar: string | null;
}

type Filter = "futuras" | "passadas";
type PeriodFilter = "all" | "today" | "week" | "month" | "custom";

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getVisitDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDayRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function StatusPill({ isPast }: { isPast: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black",
        isPast
          ? "border-border/70 bg-muted/45 text-muted-foreground"
          : "border-primary/30 bg-primary/12 text-primary",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isPast ? "bg-muted-foreground" : "bg-primary",
        )}
        aria-hidden="true"
      />
      {isPast ? "Passada" : "Futura"}
    </span>
  );
}

function VisitaCard({
  visita,
  selectionMode,
  selected,
  onToggleSelection,
  onOpen,
  onEnterSelectionMode,
}: {
  visita: EnrichedVisita;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelection: () => void;
  onOpen: () => void;
  onEnterSelectionMode: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const longPress = useLongPress({
    onLongPress: () => {
      if (!prefersReducedMotion && typeof navigator !== "undefined" && "vibrate" in navigator) {
        // feedback sutil
        (navigator as any).vibrate?.(15);
      }
      onEnterSelectionMode();
    },
  });

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-3xl border-border/55 bg-card/92 shadow-[var(--shadow-soft)] transition-colors",
        !prefersReducedMotion && "transition-transform",
        !prefersReducedMotion && pressed && "scale-[0.99]",
        selectionMode && selected && "border-primary/70 ring-2 ring-primary/35",
      )}
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={() => {
        if (selectionMode) onToggleSelection();
        else onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectionMode) onToggleSelection();
          else onOpen();
        }
      }}
      onPointerDown={() => {
        setPressed(true);
        longPress.onPointerDown();
      }}
      onPointerUp={() => {
        setPressed(false);
        longPress.onPointerUp();
      }}
      onPointerCancel={() => {
        setPressed(false);
        longPress.onPointerCancel();
      }}
      onPointerLeave={() => {
        setPressed(false);
        longPress.onPointerLeave();
      }}
    >
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0 rounded-2xl border border-border/60">
              <AvatarImage src={visita.membro_visitado_avatar || undefined} alt={visita.membro_visitado_nome} />
              <AvatarFallback className="rounded-2xl bg-primary/12 text-sm font-black text-primary">
                {visita.membro_visitado_nome
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black leading-tight text-foreground">{visita.membro_visitado_nome}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{visita.motivo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill isPast={visita.is_past} />
                {selectionMode && (
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-lg border",
                      selected ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-background",
                    )}
                    aria-hidden="true"
                  >
                    {selected && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDateTime(visita.data_visita)}</span>
              </span>
              {visita.membros_presentes.length > 0 && (
                <span className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background/70 px-2.5">
                  {visita.membros_presentes.length} presente{visita.membros_presentes.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function MobileVisitas() {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();
  const { activeGroupId } = useActiveGroup();
  const { user } = useAuth();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [visitasRaw, setVisitasRaw] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>("futuras");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [suggestions, setSuggestions] = useState<Membro[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // seleção por long-press
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Quando em modo seleção, esconde a dock inferior do app (deixa só a barra de ação).
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("mobileDockVisibility", {
        detail: { hidden: selectionMode },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("mobileDockVisibility", {
          detail: { hidden: false },
        }),
      );
    };
  }, [selectionMode]);

  // confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  useEffect(() => {
    setConfig({
      title: "Visitas",
      icon: Handshake,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Visitas" }],
      showBackButton: true,
      backTo: "/",
      mobilePrimaryAction: {
        label: "Nova visita",
        icon: Plus,
        onClick: () => navigate("/visitas/nova"),
      },
    });

    return () => setConfig(null);
  }, [navigate, setConfig]);

  useEffect(() => {
    if (!activeGroupId) {
      setMembros([]);
      setVisitasRaw([]);
      setSuggestions([]);
      setLoading(false);
      setLoadingSuggestions(false);
      return;
    }

    void loadAll();
  }, [activeGroupId]);

  useEffect(() => {
    if (membros.length > 0) void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, membros.length, visitasRaw.length]);

  useEffect(() => {
    if (!activeGroupId) return;

    const channel = supabase
      .channel(`visitas-changes-mobile:${activeGroupId}`)
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
      supabase.removeChannel(channel);
    };
  }, [activeGroupId]);

  async function loadAll() {
    if (!activeGroupId) return;

    try {
      setLoading(true);
      await Promise.all([loadMembros(), loadVisitas()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembros() {
    if (!activeGroupId) return;

    const { data, error } = await supabase
      .from("membros")
      .select("id, nome, faixa_etaria, foto_url")
      .eq("group_id", activeGroupId)
      .order("nome");

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar membros");
      return;
    }

    setMembros(data || []);
  }

  async function loadVisitas() {
    if (!activeGroupId) return;

    const { data, error } = await supabase
      .from("visitas")
      .select("*")
      .eq("group_id", activeGroupId)
      .order("data_visita", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar visitas");
      return;
    }

    const normalized: Visita[] = (data || []).map((v) => ({
      ...v,
      membros_presentes: (v.membros_presentes || []) as string[],
    }));

    setVisitasRaw(normalized);
  }

  async function loadSuggestions() {
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

        if (faltasSeguidas) sugestoes.push(membro);
      }

      setSuggestions(sugestoes);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const visitasEnriquecidas = useMemo<EnrichedVisita[]>(() => {
    const membrosMap = new Map(membros.map((m) => [m.id, m] as const));
    return visitasRaw.map((v) => {
      const membro = membrosMap.get(v.membro_visitado_id);
      return {
        ...v,
        membro_visitado_nome: membro?.nome ?? "Membro desconhecido",
        membro_visitado_avatar: membro?.foto_url ?? null,
      };
    });
  }, [membros, visitasRaw]);

  const futuras = useMemo(
    () => visitasEnriquecidas.filter((v) => !v.is_past),
    [visitasEnriquecidas],
  );
  const passadas = useMemo(
    () => visitasEnriquecidas.filter((v) => v.is_past),
    [visitasEnriquecidas],
  );

  const baseData = filter === "futuras" ? futuras : passadas;
  const periodData = useMemo(() => {
    if (periodFilter === "all") return baseData;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (periodFilter === "today") {
      const range = getDayRange(now);
      start = range.start;
      end = range.end;
    } else if (periodFilter === "week") {
      start = getDayRange(now).start;
      end = getDayRange(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)).end;
    } else if (periodFilter === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodFilter === "custom") {
      start = customStart ? getDayRange(new Date(`${customStart}T00:00:00`)).start : null;
      end = customEnd ? getDayRange(new Date(`${customEnd}T00:00:00`)).end : null;
    }

    return baseData.filter((visita) => {
      const visitDate = getVisitDate(visita.data_visita);
      if (!visitDate) return false;
      if (start && visitDate < start) return false;
      if (end && visitDate > end) return false;
      return true;
    });
  }, [baseData, customEnd, customStart, periodFilter]);

  const filteredData = useMemo(() => {
    const term = normalizeSearchText(searchQuery.trim());
    if (!term) return periodData;

    return periodData.filter((visita) => {
      const searchable = normalizeSearchText(
        [
          visita.membro_visitado_nome,
          visita.motivo,
          visita.observacoes ?? "",
          visita.is_past ? "passada historico realizada" : "futura agendada pendente",
          formatDateTime(visita.data_visita),
        ].join(" "),
      );

      return searchable.includes(term);
    });
  }, [periodData, searchQuery]);

  const activeFilterLabel = filter === "futuras" ? "Futuras" : "Passadas";
  const periodFilterLabel =
    periodFilter === "today"
      ? "Hoje"
      : periodFilter === "week"
        ? "Semana"
        : periodFilter === "month"
          ? "Mes"
          : periodFilter === "custom"
            ? "Personalizado"
            : "Todo periodo";
  const totalAtivas = periodData.length;
  const totalVisitas = futuras.length + passadas.length;

  useEffect(() => {
    setConfig({
      title: "Visitas",
      icon: Handshake,
      breadcrumbs: [{ label: "Inicio", href: "/" }, { label: "Visitas" }],
      showBackButton: true,
      backTo: "/",
      mobileSearch: {
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: "Buscar visitas",
        menu: (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Abrir filtros de visitas">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={12} className="w-72 rounded-2xl border-border/60 bg-popover p-2">
              <DropdownMenuLabel className="px-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Exibir visitas
              </DropdownMenuLabel>
              <DropdownMenuItem className="rounded-xl" onClick={() => setFilter("futuras")}>
                <Clock className="mr-2 h-4 w-4" />
                Futuras
                <span className="ml-auto text-xs text-muted-foreground">{futuras.length}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl" onClick={() => setFilter("passadas")}>
                <History className="mr-2 h-4 w-4" />
                Passadas
                <span className="ml-auto text-xs text-muted-foreground">{passadas.length}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Periodo
              </DropdownMenuLabel>
              <DropdownMenuItem className="rounded-xl" onClick={() => setPeriodFilter("all")}>
                <CalendarRange className="mr-2 h-4 w-4" />
                Todo periodo
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl" onClick={() => setPeriodFilter("today")}>
                <Calendar className="mr-2 h-4 w-4" />
                Hoje
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl" onClick={() => setPeriodFilter("week")}>
                <CalendarRange className="mr-2 h-4 w-4" />
                Semana
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-xl" onClick={() => setPeriodFilter("month")}>
                <CalendarRange className="mr-2 h-4 w-4" />
                Mes
              </DropdownMenuItem>

              <div className="mt-1 rounded-2xl border border-border/55 bg-background/70 p-2" onClick={(event) => event.stopPropagation()}>
                <div className="mb-2 flex items-center gap-2 text-xs font-black text-foreground">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  Personalizado
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(event) => {
                      setCustomStart(event.target.value);
                      setPeriodFilter("custom");
                    }}
                    className="h-9 min-w-0 rounded-xl border border-border/60 bg-card px-2 text-xs text-foreground outline-none focus:border-primary/70"
                    aria-label="Data inicial"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(event) => {
                      setCustomEnd(event.target.value);
                      setPeriodFilter("custom");
                    }}
                    className="h-9 min-w-0 rounded-xl border border-border/60 bg-card px-2 text-xs text-foreground outline-none focus:border-primary/70"
                    aria-label="Data final"
                  />
                </div>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl" onClick={() => setSuggestionsOpen(true)}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Sugestoes
                <span className="ml-auto text-xs text-muted-foreground">
                  {loadingSuggestions ? "..." : suggestions.length}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
      mobilePrimaryAction: {
        label: "Nova visita",
        icon: Plus,
        onClick: () => navigate("/visitas/nova"),
      },
    });

    return () => setConfig(null);
  }, [
    customEnd,
    customStart,
    futuras.length,
    loadingSuggestions,
    navigate,
    passadas.length,
    searchQuery,
    setConfig,
    suggestions.length,
  ]);

  useEffect(() => {
    if (!activeGroupId || !user?.id || futuras.length === 0) return;

    const now = Date.now();
    const next24h = now + 24 * 60 * 60 * 1000;
    const upcoming = futuras.filter((visita) => {
      const visitDate = getVisitDate(visita.data_visita);
      if (!visitDate) return false;
      const time = visitDate.getTime();
      return time >= now && time <= next24h;
    });

    if (upcoming.length === 0) return;

    upcoming.forEach((visita) => {
      void supabase.rpc("create_user_notification", {
        _recipient_user_id: user.id,
        _group_id: activeGroupId,
        _type: "visit_upcoming",
        _title: "Visita próxima",
        _message: `${visita.membro_visitado_nome} - ${formatDateTime(visita.data_visita)}`,
        _entity_type: "visita",
        _entity_id: visita.id,
        _metadata: {
          data_visita: visita.data_visita,
          membro_visitado_id: visita.membro_visitado_id,
        },
        _dedupe_key: `visit-upcoming:${activeGroupId}:${visita.id}:${visita.data_visita ?? "sem-data"}`,
      });
    });
  }, [activeGroupId, futuras, user?.id]);

  async function handleMarkAsDone(visita: EnrichedVisita) {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitas")
        .update({ is_past: true, data_visita: now })
        .eq("id", visita.id)
        .eq("group_id", activeGroupId);

      if (error) throw error;
      toast.success("Visita marcada como concluída");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao concluir visita");
    }
  }

  async function handleDeleteMany(ids: string[]) {
    try {
      const { error } = await supabase.from("visitas").delete().in("id", ids).eq("group_id", activeGroupId);
      if (error) throw error;
      toast.success(ids.length === 1 ? "Visita excluída" : "Visitas excluídas");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir visita");
    }
  }

  function handleEdit(visita: EnrichedVisita) {
    navigate(`/visitas/nova?id=${visita.id}`);
  }

  const selectedVisitas = useMemo(() => {
    if (!selectionMode || selectedIds.size === 0) return [] as EnrichedVisita[];
    const set = selectedIds;
    return visitasEnriquecidas.filter((v) => set.has(v.id));
  }, [selectionMode, selectedIds, visitasEnriquecidas]);

  const canConcludeSelected = useMemo(
    () => selectedVisitas.some((v) => !v.is_past),
    [selectedVisitas],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className={cn("h-full w-full bg-background", selectionMode && "relative")}> 
      {selectionMode && (
        <div
          className="md:hidden fixed inset-0 bg-primary/40 mix-blend-multiply pointer-events-none"
          aria-hidden="true"
        />
      )}
      <section className="relative mx-auto w-full max-w-4xl px-3 pb-48 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 font-black text-primary">
              <ListFilter className="h-3.5 w-3.5" />
              {activeFilterLabel}
            </span>
            <span className="truncate">{periodFilterLabel}</span>
          </div>
          <span className="shrink-0 tabular-nums">
            {searchQuery.trim() ? `${filteredData.length}/${totalAtivas}` : `${totalAtivas}/${totalVisitas}`}
          </span>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-3xl" />
            ))}
          </div>
        ) : filteredData.length === 0 ? (
          <Card className="mt-3 rounded-3xl border-border/55 bg-card/92 shadow-[var(--shadow-soft)]">
            <div className="p-6 text-center text-muted-foreground space-y-2">
              <div className="mx-auto h-11 w-11 rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
                {filter === "futuras" ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <p className="text-sm font-black text-foreground">
                {filter === "futuras" ? "Nenhuma visita futura" : "Nenhuma visita registrada"}
              </p>
              <p className="text-xs">
                {filter === "futuras"
                  ? "Agende uma nova visita para começar."
                  : "As visitas concluídas aparecerão aqui."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="mt-3 space-y-2.5">
            {filteredData.map((visita) => {
              const selected = selectedIds.has(visita.id);
              return (
                <VisitaCard
                  key={visita.id}
                  visita={visita}
                  selectionMode={selectionMode}
                  selected={selected}
                  onToggleSelection={() => toggleSelection(visita.id)}
                  onOpen={() => navigate(`/visitas/${visita.id}`)}
                  onEnterSelectionMode={() => {
                    setSelectionMode(true);
                    setSelectedIds(new Set([visita.id]));
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

       {/* Action bar do modo seleção */}
       {selectionMode && (
         <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
           <div className="mx-auto w-full max-w-4xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
             <div className="flex items-center justify-between gap-2">
               <div className="flex items-center gap-2 min-w-0">
                 <Button
                   type="button"
                   variant="outline"
                   size="icon"
                   className="h-10 w-10"
                   onClick={() => {
                     setSelectionMode(false);
                     setSelectedIds(new Set());
                   }}
                   aria-label="Sair do modo seleção"
                 >
                   <X className="h-4 w-4" />
                 </Button>
                 <p className="text-sm font-medium text-foreground truncate">
                   {selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}
                 </p>
               </div>

               <div className="flex items-center gap-2">
                 <Button
                   type="button"
                   variant="outline"
                   className="h-10"
                   disabled={selectedIds.size !== 1}
                   onClick={() => {
                     const id = Array.from(selectedIds)[0];
                     navigate(`/visitas/nova?id=${id}`);
                   }}
                 >
                   <Pencil className="h-4 w-4 mr-2" />
                   Editar
                 </Button>

                 <Button
                   type="button"
                   variant="outline"
                   className="h-10"
                   disabled={!canConcludeSelected}
                   onClick={() => {
                     // conclui apenas as futuras selecionadas
                     selectedVisitas.filter((v) => !v.is_past).forEach((v) => void handleMarkAsDone(v));

                     setSelectionMode(false);
                     setSelectedIds(new Set());
                   }}
                 >
                   <CheckCircle2 className="h-4 w-4 mr-2" />
                   Concluir
                 </Button>

                 <Button
                   type="button"
                   variant="outline"
                   className="h-10 text-destructive border-destructive/70"
                   disabled={selectedIds.size === 0}
                   onClick={() => {
                     setIdsToDelete(Array.from(selectedIds));
                     setDeleteDialogOpen(true);
                   }}
                 >
                   <Trash2 className="h-4 w-4 mr-2" />
                   Excluir
                 </Button>
               </div>
             </div>
           </div>
         </div>
       )}

       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Excluir visita{idsToDelete.length === 1 ? "" : "s"}?</AlertDialogTitle>
             <AlertDialogDescription>
               {idsToDelete.length === 1
                 ? "Esta ação não pode ser desfeita."
                 : `Esta ação não pode ser desfeita. Você vai excluir ${idsToDelete.length} visitas.`}
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const ids = idsToDelete;
                  void handleDeleteMany(ids);
                  setDeleteDialogOpen(false);
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                  setIdsToDelete([]);
                }}
              >
               Excluir
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>

       <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <AlertTriangle className="h-4 w-4 text-warning" />
               Sugestões de visita
             </DialogTitle>
           </DialogHeader>

           <div className="space-y-3 max-h-[420px] overflow-y-auto">
             <p className="text-xs text-muted-foreground">
               Com base nas últimas reuniões de jovens, estes membros estão há algumas semanas sem aparecer e ainda não
               receberam uma visita registrada.
             </p>

             {loadingSuggestions ? (
               <div className="space-y-2">
                 {[1, 2, 3].map((i) => (
                   <Skeleton key={i} className="h-12 w-full rounded-lg" />
                 ))}
               </div>
             ) : suggestions.length === 0 ? (
               <p className="text-xs text-muted-foreground">
                 Nenhum jovem em situação crítica de faltas nas últimas reuniões.
               </p>
             ) : (
               <div className="space-y-2">
                 {suggestions.map((m) => (
                   <div
                     key={m.id}
                     className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2"
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
                         <p className="text-xs font-medium text-foreground truncate">{m.nome}</p>
                         <p className="text-[11px] text-muted-foreground truncate">
                           {m.faixa_etaria} • Faltou às últimas reuniões
                         </p>
                       </div>
                     </div>
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       className="h-7 text-[11px] flex-shrink-0"
                       onClick={() => {
                         setSuggestionsOpen(false);
                         navigate(`/visitas/nova?membroId=${m.id}`);
                       }}
                     >
                       Agendar
                     </Button>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </DialogContent>
       </Dialog>
     </main>
   );
 }
