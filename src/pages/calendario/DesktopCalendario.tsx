import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
  type ResizeEventArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, addDays, addWeeks, addMonths, isSameDay, isBefore, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import { toast } from "sonner";
import { CalendarDays, Filter, Plus, Trash2, Pencil, RefreshCw, Search, Phone, Copy } from "lucide-react";
import { VisitDetailsDialog, type VisitDetailsDialogData } from "@/components/calendario/VisitDetailsDialog";
import { EventDetailsDrawer, type EventDetailsDrawerData } from "@/components/calendario/EventDetailsDrawer";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import "../Calendario.css";

type EventoTipo = "ajuntamento" | "saida" | "visita";

type AgendaLayer = "eventos" | "aniversarios" | "reunioes" | "visitas";

type LayerState = Record<AgendaLayer, boolean>;

const DEFAULT_LAYERS: LayerState = {
  eventos: true,
  aniversarios: true,
  reunioes: true,
  visitas: true,
};


const CALENDAR_PREFS_KEY = "calendarLayersV1";

type Recorrencia =
  | null
  | {
      tipo: "semanal" | "mensal";
      intervalo?: number;
      dias_semana?: number[]; // 0-6 (dom-sab)
    };

type Lembrete = { tipo: "minutos" | "horas" | "dias"; valor: number };

type EventoRow = {
  id: string;
  user_id: string;
  tipo: EventoTipo;
  titulo: string;
  descricao: string | null;
  local: string | null;
  data_inicio: string;
  data_fim: string;
  dia_inteiro: boolean;
  recorrencia: any;
  lembretes: any;
  membro_visitado_id?: string | null;
  visita_id?: string | null;
  created_at: string;
  updated_at: string;
};

type MembroRow = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  data_aniversario: string | null;
  foto_url?: string | null;
  telefone?: string | null;
  status_telefone?: string | null;
  faixa_etaria?: string | null;
  cargos?: string[] | null;
};

type ReuniaoRow = {
  id: string;
  data: string; // YYYY-MM-DD
  tema: string | null;
  observacoes?: string | null;
  numero_visitas?: number | null;
  recitativos_individuais?: number | null;
  quem_atendeu?: string | null;
  palavra_referencia?: string | null;
};

type VisitaRow = {
  id: string;
  data_visita: string | null;
  motivo: string | null;
  observacoes: string | null;
  membro_visitado_id: string;
  is_past: boolean;
};

type CalendarItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: {
    kind: "evento" | "birthday" | "reuniao" | "visita_registrada";
    layer: AgendaLayer;
    baseId: string;
    tipo?: EventoTipo;
    userId?: string;
    descricao?: string | null;
    local?: string | null;
    recorrencia?: Recorrencia;
    lembretes?: Lembrete[];
    occurrenceStartISO?: string; // para diferenciar ocorrências
    membroVisitadoId?: string | null;
    visitaId?: string | null;
  };
};

function parseMMDD(mmdd: string) {
  const [mm, dd] = mmdd.split("-").map((n) => Number(n));
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  return { mm, dd };
}

function getBirthdayMonthDay(m: MembroRow): { mm: number; dd: number } | null {
  // Regra: nunca perder dados existentes. Se data_aniversario existir, ela manda.
  if (m.data_aniversario) {
    return parseMMDD(m.data_aniversario);
  }

  // Fallback: usa data_nascimento (YYYY-MM-DD) apenas para exibição no calendário.
  if (m.data_nascimento) {
    const parts = m.data_nascimento.split("-").map((n) => Number(n));
    if (parts.length !== 3) return null;
    const [, mm, dd] = parts;
    if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    return { mm, dd };
  }

  return null;
}

function calcAgeAtYear(dataNascimento: string | null, year: number): number | null {
  if (!dataNascimento) return null;
  const y = Number(String(dataNascimento).slice(0, 4));
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  const age = year - y;
  return age >= 0 && age <= 120 ? age : null;
}

function clampBooleanRecord(raw: any, fallback: LayerState): LayerState {
  if (!raw || typeof raw !== "object") return fallback;
  const next: LayerState = { ...fallback };
  (Object.keys(fallback) as AgendaLayer[]).forEach((k) => {
    if (typeof raw[k] === "boolean") next[k] = raw[k];
  });
  return next;
}

function layerLabel(layer: AgendaLayer) {
  if (layer === "eventos") return "Eventos";
  if (layer === "aniversarios") return "Aniversários";
  if (layer === "reunioes") return "Reuniões";
  return "Visitas";
}

const locales = { "pt-BR": ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop<CalendarItem, object>(BigCalendar);

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function safeInterval(n: unknown) {
  const val = typeof n === "number" ? n : Number(n);
  return Number.isFinite(val) && val > 0 ? val : 1;
}

function parseRecorrencia(raw: any): Recorrencia {
  if (!raw || typeof raw !== "object") return null;
  if (raw.tipo !== "semanal" && raw.tipo !== "mensal") return null;
  return {
    tipo: raw.tipo,
    intervalo: safeInterval(raw.intervalo),
    dias_semana: Array.isArray(raw.dias_semana)
      ? raw.dias_semana.map((d: any) => Number(d)).filter((d: any) => Number.isFinite(d) && d >= 0 && d <= 6)
      : undefined,
  };
}

function parseLembretes(raw: any): Lembrete[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({ tipo: r?.tipo, valor: Number(r?.valor) }))
    .filter(
      (r): r is Lembrete =>
        (r.tipo === "minutos" || r.tipo === "horas" || r.tipo === "dias") && Number.isFinite(r.valor) && r.valor > 0,
    );
}

function inRangeInclusive(d: Date, start: Date, end: Date) {
  return (isAfter(d, start) || d.getTime() === start.getTime()) && (isBefore(d, end) || d.getTime() === end.getTime());
}

function makeEventoResource(
  base: {
    id: string;
    tipo: EventoTipo;
    userId: string;
    layer: AgendaLayer;
    membroVisitadoId?: string | null;
    visitaId?: string | null;
    descricao?: string | null;
    local?: string | null;
    recorrencia: Recorrencia;
    lembretes: Lembrete[];
  },
  extra?: Pick<CalendarItem["resource"], "occurrenceStartISO">
): CalendarItem["resource"] {
  return {
    kind: "evento",
    layer: base.layer,
    baseId: base.id,
    tipo: base.tipo,
    userId: base.userId,
    membroVisitadoId: base.membroVisitadoId,
    visitaId: base.visitaId,
    descricao: base.descricao,
    local: base.local,
    recorrencia: base.recorrencia,
    lembretes: base.lembretes,
    ...(extra ?? {}),
  };
}

function expandRecurrence(base: {
  id: string;
  start: Date;
  end: Date;
  tipo: EventoTipo;
  titulo: string;
  userId: string;
  allDay: boolean;
  layer: AgendaLayer;
  membroVisitadoId?: string | null;
  visitaId?: string | null;
  descricao?: string | null;
  local?: string | null;
  recorrencia: Recorrencia;
  lembretes: Lembrete[];
}, rangeStart: Date, rangeEnd: Date): CalendarItem[] {
  if (!base.recorrencia) {
    const inRange = inRangeInclusive(base.start, rangeStart, rangeEnd) || inRangeInclusive(base.end, rangeStart, rangeEnd);
    return inRange
      ? [
          {
            id: base.id,
            title: base.titulo,
            start: base.start,
            end: base.end,
            allDay: base.allDay,
            resource: makeEventoResource(base),
          },
        ]
      : [];
  }

  const occurrences: CalendarItem[] = [];
  const interval = safeInterval(base.recorrencia.intervalo);
  const durationMs = base.end.getTime() - base.start.getTime();

  // Começamos um pouco antes para garantir ocorrências próximas ao início da janela.
  const scanStart = addDays(rangeStart, -7);
  const scanEnd = addDays(rangeEnd, 7);

  if (base.recorrencia.tipo === "semanal") {
    const dias = (base.recorrencia.dias_semana?.length ? base.recorrencia.dias_semana : [getDay(base.start)])
      .slice()
      .sort();

    // ancora na semana do evento base
    let cursor = startOfWeek(base.start, { locale: ptBR });
    while (isBefore(cursor, scanEnd)) {
      // respeita intervalo de semanas
      const weeksFromBase = Math.floor((cursor.getTime() - startOfWeek(base.start, { locale: ptBR }).getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksFromBase % interval === 0) {
        for (const dayIndex of dias) {
          const occStart = addDays(cursor, dayIndex);
          // mantém horário do evento base
          occStart.setHours(base.start.getHours(), base.start.getMinutes(), 0, 0);
          const occEnd = new Date(occStart.getTime() + durationMs);
          if (inRangeInclusive(occStart, scanStart, scanEnd)) {
            occurrences.push({
              id: `${base.id}__${occStart.toISOString()}`,
              title: base.titulo,
              start: occStart,
              end: occEnd,
              allDay: base.allDay,
              resource: makeEventoResource(base, { occurrenceStartISO: occStart.toISOString() }),
            });
          }
        }
      }
      cursor = addWeeks(cursor, 1);
    }
  }

  if (base.recorrencia.tipo === "mensal") {
    let cursor = new Date(base.start);
    cursor = addMonths(cursor, 0);

    // pula para perto da janela
    while (isBefore(cursor, scanStart)) cursor = addMonths(cursor, interval);

    while (isBefore(cursor, scanEnd)) {
      const occStart = new Date(cursor);
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (inRangeInclusive(occStart, scanStart, scanEnd)) {
        occurrences.push({
          id: `${base.id}__${occStart.toISOString()}`,
          title: base.titulo,
          start: occStart,
          end: occEnd,
          allDay: base.allDay,
          resource: makeEventoResource(base, { occurrenceStartISO: occStart.toISOString() }),
        });
      }
      cursor = addMonths(cursor, interval);
    }
  }

  // filtra para o range real
  return occurrences.filter((o) => inRangeInclusive(o.start, rangeStart, rangeEnd) || inRangeInclusive(o.end, rangeStart, rangeEnd));
}

const tipoLabel: Record<EventoTipo, string> = {
  ajuntamento: "Ajuntamento",
  saida: "Saída",
  visita: "Visita",
};

function tipoColorStyle(tipo: EventoTipo) {
  // Sem cores hardcoded: usamos tokens do tema.
  // Aqui a diferenciação é visual e imediata para cada tipo.
  if (tipo === "ajuntamento") {
    return {
      backgroundColor: `hsl(var(--primary) / 0.9)`,
      color: `hsl(var(--primary-foreground))`,
      border: `1px solid hsl(var(--primary) / 0.35)`,
    };
  }
  if (tipo === "saida") {
    return {
      backgroundColor: `hsl(var(--faixa-meninos) / 0.92)`,
      color: `hsl(var(--foreground))`,
      border: `1px solid hsl(var(--faixa-meninos) / 0.45)`,
    };
  }
  // visita (agenda)
  return {
    backgroundColor: `hsl(var(--faixa-visitas) / 0.92)`,
    color: `hsl(var(--foreground))`,
    border: `1px solid hsl(var(--faixa-visitas) / 0.45)`,
  };
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <>
      {before}
      <mark className="rounded-sm bg-accent px-0.5 text-accent-foreground">{match}</mark>
      {after}
    </>
  );
}

export default function Calendario() {
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();
  const { setConfig } = usePageHeader();
  const location = useLocation();
  const navigate = useNavigate();

  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [rawEventos, setRawEventos] = useState<EventoRow[]>([]);
  const [membros, setMembros] = useState<MembroRow[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoRow[]>([]);
  const [visitasRegistradas, setVisitasRegistradas] = useState<VisitaRow[]>([]);

  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const saveLayersTimer = useRef<number | null>(null);

  const [searchText, setSearchText] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<CalendarItem | null>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");

  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [visitDialogData, setVisitDialogData] = useState<VisitDetailsDialogData | null>(null);

  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [eventDrawerData, setEventDrawerData] = useState<EventDetailsDrawerData | null>(null);

  type MeetingStats = {
    loading: boolean;
    error?: string;
    presencasCount: number;
    faixas: Record<string, number>;
  };

  const [meetingStatsById, setMeetingStatsById] = useState<Record<string, MeetingStats>>({});

  const [confirmMoveOpen, setConfirmMoveOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<
    | null
    | {
        baseId: string;
        title: string;
        fromStart: Date;
        fromEnd: Date;
        toStart: Date;
        toEnd: Date;
        allDay: boolean;
      }
  >(null);

  const [form, setForm] = useState({
    tipo: "visita" as EventoTipo,
    titulo: "",
    descricao: "",
    local: "",
    membroVisitadoId: "",
    diaInteiro: false,
    inicio: toDatetimeLocalValue(new Date()),
    fim: toDatetimeLocalValue(addDays(new Date(), 0)),
    recorrenciaTipo: "nenhuma" as "nenhuma" | "semanal" | "mensal",
    recorrenciaIntervalo: 1,
    diasSemana: [] as number[],
    lembreteAtivo: false,
    lembreteValor: 30,
    lembreteTipo: "minutos" as Lembrete["tipo"],
  });

  useEffect(() => {
    const LayersDropdown = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            Camadas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 w-56 bg-popover">
          <DropdownMenuLabel>Exibir no calendário</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(DEFAULT_LAYERS) as AgendaLayer[]).map((layer) => (
            <DropdownMenuCheckboxItem
              key={layer}
              checked={layers[layer]}
              onCheckedChange={(checked) => setLayers((prev) => ({ ...prev, [layer]: Boolean(checked) }))}
            >
              {layerLabel(layer)}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Suas preferências ficam salvas.
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    const SearchBox = (
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar no calendário"
          className="h-9 w-[180px] pl-9 md:w-[240px]"
        />
      </div>
    );

    setConfig({
      title: "Agenda",
      icon: CalendarDays,
      primaryActions: (
        <Button
          size="icon"
          onClick={() => openCreateDialog(new Date())}
          aria-label="Novo evento"
          title="Novo evento"
        >
          <Plus className="h-4 w-4" />
        </Button>
      ),
      secondaryActions: (
        <div className="flex items-center gap-2">
          {SearchBox}
          {LayersDropdown}
          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadEventos()}
            aria-label="Atualizar"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      ),
    });
    return () => setConfig(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, searchText]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // carrega preferências quando o usuário estiver disponível
    if (!user) return;
    void loadCalendarPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    // Persistir preferências (debounce)
    if (!user) return;
    if (saveLayersTimer.current) window.clearTimeout(saveLayersTimer.current);
    saveLayersTimer.current = window.setTimeout(() => {
      void saveCalendarPrefs(layers);
    }, 350);
    return () => {
      if (saveLayersTimer.current) window.clearTimeout(saveLayersTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, user?.id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadEventos(), loadMembros(), loadReunioes(), loadVisitasRegistradas()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarPrefs = async () => {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("id, dashboard_layout")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      const raw = (data as any)?.dashboard_layout?.[CALENDAR_PREFS_KEY];
      setLayers(clampBooleanRecord(raw, DEFAULT_LAYERS));
    } catch (err) {
      console.warn("Não foi possível carregar preferências da Agenda:", err);
    }
  };

  const saveCalendarPrefs = async (nextLayers: LayerState) => {
    try {
      const { data: existing, error: existingError } = await supabase
        .from("user_preferences")
        .select("id, dashboard_layout")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (existingError) throw existingError;

      const currentLayout = ((existing as any)?.dashboard_layout ?? {}) as Record<string, any>;
      const updatedLayout = {
        ...currentLayout,
        [CALENDAR_PREFS_KEY]: nextLayers,
      };

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("user_preferences")
          .update({ dashboard_layout: updatedLayout, updated_at: new Date().toISOString() })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_preferences")
          .insert([{ user_id: user!.id, dashboard_layout: updatedLayout }]);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("Não foi possível salvar preferências da Agenda:", err);
    }
  };

  const loadEventos = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select(
          "id, user_id, tipo, titulo, descricao, local, data_inicio, data_fim, dia_inteiro, recorrencia, lembretes, membro_visitado_id, visita_id, created_at, updated_at",
        )
        .order("data_inicio", { ascending: true });

      if (error) throw error;
      setRawEventos((data || []) as any);
    } catch (err) {
      console.error("Erro ao carregar eventos:", err);
      toast.error("Erro ao carregar eventos");
    }
  };

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, data_nascimento, data_aniversario, foto_url, telefone, status_telefone, faixa_etaria, cargos")
        .order("nome");
      if (error) throw error;
      setMembros((data || []) as any);
    } catch (err) {
      // em alguns perfis, o SELECT de membros pode ser restrito; não quebra o calendário.
      console.warn("Aniversários indisponíveis (sem permissão para ler membros):", err);
      setMembros([]);
    }
  };

  const loadReunioes = async () => {
    try {
      const { data, error } = await supabase
        .from("reunioes")
        .select("id, data, tema, observacoes, numero_visitas, recitativos_individuais, quem_atendeu, palavra_referencia")
        .order("data", { ascending: false });
      if (error) throw error;
      setReunioes((data || []) as any);
    } catch (err) {
      console.warn("Erro ao carregar reuniões:", err);
      setReunioes([]);
    }
  };

  const loadVisitasRegistradas = async () => {
    try {
      const { data, error } = await supabase
        .from("visitas")
        .select("id, data_visita, motivo, observacoes, membro_visitado_id, is_past")
        .order("data_visita", { ascending: false });
      if (error) throw error;
      setVisitasRegistradas(((data || []) as any).filter((v: any) => !!v.data_visita));
    } catch (err) {
      console.warn("Erro ao carregar visitas:", err);
      setVisitasRegistradas([]);
    }
  };

  const loadMeetingStats = async (reuniaoId: string) => {
    setMeetingStatsById((prev) => ({
      ...prev,
      [reuniaoId]: prev[reuniaoId] ?? { loading: true, presencasCount: 0, faixas: {} },
    }));

    setMeetingStatsById((prev) => ({
      ...prev,
      [reuniaoId]: { ...(prev[reuniaoId] ?? { presencasCount: 0, faixas: {} }), loading: true, error: undefined },
    }));

    try {
      const { data: presencas, error: presencasError } = await supabase
        .from("presencas")
        .select("membro_id")
        .eq("reuniao_id", reuniaoId);

      if (presencasError) throw presencasError;

      const membroIds = (presencas || []).map((p: any) => p.membro_id).filter(Boolean);

      const faixas: Record<string, number> = {};
      if (membroIds.length) {
        const { data: membrosData, error: membrosError } = await supabase
          .from("membros")
          .select("id, faixa_etaria")
          .in("id", membroIds);

        // Se não tiver permissão de ler membros, ainda mostramos contagem total de presenças.
        if (!membrosError && membrosData) {
          (membrosData as any[]).forEach((m) => {
            const faixa = String(m.faixa_etaria || "(sem faixa)");
            faixas[faixa] = (faixas[faixa] || 0) + 1;
          });
        }
      }

      setMeetingStatsById((prev) => ({
        ...prev,
        [reuniaoId]: {
          loading: false,
          presencasCount: membroIds.length,
          faixas,
        },
      }));
    } catch (e: any) {
      setMeetingStatsById((prev) => ({
        ...prev,
        [reuniaoId]: {
          loading: false,
          presencasCount: 0,
          faixas: {},
          error: "Não foi possível carregar presenças",
        },
      }));
    }
  };

  const MeetingStatsBlock = ({ reuniaoId, reuniao }: { reuniaoId: string; reuniao?: ReuniaoRow }) => {
    useEffect(() => {
      const current = meetingStatsById[reuniaoId];
      if (current && (current.loading || (!current.loading && !current.error && (current.presencasCount || Object.keys(current.faixas).length)))) {
        return;
      }
      void loadMeetingStats(reuniaoId);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reuniaoId]);

    const stats = meetingStatsById[reuniaoId];
    const presencasCount = stats?.presencasCount ?? 0;
    const visitasCount = Number(reuniao?.numero_visitas ?? 0) || 0;
    const participantesTotal = presencasCount + visitasCount;
    const recitativosInd = Number(reuniao?.recitativos_individuais ?? 0) || 0;
    const totalRecitativos = recitativosInd === 0 ? participantesTotal : participantesTotal + recitativosInd;

    // No primeiro clique, ainda não existe entrada em meetingStatsById.
    // Mostramos carregamento para evitar o fallback "(sem permissão... ou sem dados)".
    if (!stats || stats.loading) {
      return <div className="text-sm text-muted-foreground">Carregando detalhes…</div>;
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-card p-2">
            <div className="text-xs font-medium text-muted-foreground">Participantes</div>
            <div className="text-sm font-semibold text-foreground">{participantesTotal}</div>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <div className="text-xs font-medium text-muted-foreground">Total recitativos</div>
            <div className="text-sm font-semibold text-foreground">{totalRecitativos}</div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-2">
          <div className="text-xs font-medium text-muted-foreground">Presentes por faixa</div>
          {stats?.error ? (
            <div className="mt-1 text-sm text-muted-foreground">{stats.error}</div>
          ) : Object.keys(stats?.faixas ?? {}).length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(stats.faixas)
                .sort((a, b) => b[1] - a[1])
                .map(([faixa, count]) => (
                  <Badge key={faixa} variant="secondary" className="text-xs">
                    {faixa}: {count}
                  </Badge>
                ))}
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted-foreground">(sem permissão para ler faixas ou sem dados)</div>
          )}
        </div>
      </div>
    );
  };

  const rangeForView = useMemo(() => {
    // O react-big-calendar calcula internamente, mas precisamos de um range razoável para expandir recorrência.
    // Janela ampla (± 45 dias) cobre mês/semana/dia/lista sem reprocessamento excessivo.
    const start = addDays(new Date(date), -45);
    const end = addDays(new Date(date), 45);
    return { start, end };
  }, [date]);

  const events: CalendarItem[] = useMemo(() => {
    const mappedEventos = rawEventos.map((e) => {
      const start = new Date(e.data_inicio);
      const end = new Date(e.data_fim);

      const layer: AgendaLayer = e.tipo === "visita" ? "visitas" : "eventos";
      return {
        id: e.id,
        start,
        end,
        tipo: e.tipo,
        titulo: e.titulo,
        userId: e.user_id,
        allDay: !!e.dia_inteiro,
        layer,
        membroVisitadoId: e.membro_visitado_id ?? null,
        visitaId: e.visita_id ?? null,
        descricao: e.descricao,
        local: e.local,
        recorrencia: parseRecorrencia(e.recorrencia),
        lembretes: parseLembretes(e.lembretes),
      };
    });

    const expandedEventos = mappedEventos.flatMap((b) =>
      expandRecurrence(b, rangeForView.start, rangeForView.end),
    );

    const birthdayItems: CalendarItem[] = [];
    if (layers.aniversarios) {
      const now = new Date();
      const year = now.getFullYear();
      membros.forEach((m) => {
        const md = getBirthdayMonthDay(m);
        if (!md) return;
        // cria evento no ano atual e no próximo pra cobrir a janela
        [year, year + 1].forEach((y) => {
          const d = new Date(y, md.mm - 1, md.dd, 9, 0, 0, 0);
          if (!inRangeInclusive(d, rangeForView.start, rangeForView.end)) return;
          birthdayItems.push({
            id: `birthday__${m.id}__${y}`,
            title: m.nome,
            start: d,
            end: new Date(d.getTime() + 30 * 60 * 1000),
            allDay: true,
            resource: {
              kind: "birthday",
              layer: "aniversarios",
              baseId: m.id,
            },
          });
        });
      });
    }

    const reunioesItems: CalendarItem[] = [];
    if (layers.reunioes) {
      reunioes.forEach((r) => {
        // data é YYYY-MM-DD (local)
        const [yy, mm, dd] = r.data.split("-").map((n) => Number(n));
        if (!yy || !mm || !dd) return;
        const d = new Date(yy, mm - 1, dd, 19, 0, 0, 0);
        if (!inRangeInclusive(d, rangeForView.start, rangeForView.end)) return;
        reunioesItems.push({
          id: `reuniao__${r.id}`,
          title: r.tema?.trim() ? r.tema : "Reunião",
          start: d,
          end: new Date(d.getTime() + 60 * 60 * 1000),
          allDay: true,
          resource: {
            kind: "reuniao",
            layer: "reunioes",
            baseId: r.id,
          },
        });
      });
    }

    const visitasItems: CalendarItem[] = [];
    if (layers.visitas) {
      visitasRegistradas.forEach((v) => {
        if (!v.data_visita) return;
        const d = new Date(v.data_visita);
        if (!inRangeInclusive(d, rangeForView.start, rangeForView.end)) return;
        visitasItems.push({
          id: `visita_reg__${v.id}`,
          title: "Visita (registrada)",
          start: d,
          end: new Date(d.getTime() + 30 * 60 * 1000),
          allDay: true,
          resource: {
            kind: "visita_registrada",
            layer: "visitas",
            baseId: v.id,
            membroVisitadoId: v.membro_visitado_id,
          },
        });
      });
    }

    const all = [...expandedEventos, ...birthdayItems, ...reunioesItems, ...visitasItems];

    // filtro final (camadas)
    const withLayers = all.filter((ev) => {
      const layer = ev.resource.layer ?? "eventos";
      return layers[layer];
    });

    const q = searchText.trim().toLowerCase();
    if (!q) return withLayers;

    const getMembroNome = (id?: string | null) => {
      if (!id) return "";
      return membros.find((m) => m.id === id)?.nome ?? "";
    };

    return withLayers.filter((ev) => {
      // Base (sempre)
      const parts: string[] = [ev.title];

      // Manual: local/descricao e possível membro
      if (ev.resource.kind === "evento") {
        const base = rawEventos.find((r) => r.id === ev.resource.baseId);
        parts.push(base?.local ?? ev.resource.local ?? "");
        parts.push(base?.descricao ?? ev.resource.descricao ?? "");
        if (ev.resource.tipo === "visita") {
          parts.push(getMembroNome(ev.resource.membroVisitadoId));
        }
      }

      // Visita registrada: membro
      if (ev.resource.kind === "visita_registrada") {
        parts.push(getMembroNome(ev.resource.membroVisitadoId));
      }

      // Aniversário: título já é o nome, mas mantemos por clareza
      // Reunião: título já é tema/"Reunião"

      const haystack = parts
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [layers, membros, rawEventos, rangeForView.end, rangeForView.start, reunioes, searchText, visitasRegistradas]);

  const openCreateDialog = (baseDate: Date) => {
    const start = new Date(baseDate);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    setSelectedOccurrence(null);
    setMode("create");
    setForm((f) => ({
      ...f,
      tipo: "visita",
      titulo: "",
      descricao: "",
      local: "",
      membroVisitadoId: "",
      diaInteiro: false,
      inicio: toDatetimeLocalValue(start),
      fim: toDatetimeLocalValue(end),
      recorrenciaTipo: "nenhuma",
      recorrenciaIntervalo: 1,
      diasSemana: [],
      lembreteAtivo: false,
      lembreteValor: 30,
      lembreteTipo: "minutos",
    }));
    setDialogOpen(true);
  };

  const openFromEvent = (ev: CalendarItem) => {
    setSelectedOccurrence(ev);
    const base = rawEventos.find((r) => r.id === ev.resource.baseId);
    const canEdit = !!user && base?.user_id === user.id;
    setMode(canEdit ? "edit" : "view");

    const start = new Date(base?.data_inicio || ev.start);
    const end = new Date(base?.data_fim || ev.end);
    const rec = parseRecorrencia(base?.recorrencia);
    const lemb = parseLembretes(base?.lembretes);

    setForm((f) => ({
      ...f,
      tipo: (base?.tipo as EventoTipo) || ev.resource.tipo,
      titulo: base?.titulo || ev.title,
      descricao: base?.descricao || "",
      local: base?.local || "",
      membroVisitadoId: base?.membro_visitado_id ?? ev.resource.membroVisitadoId ?? "",
      diaInteiro: !!base?.dia_inteiro,
      inicio: toDatetimeLocalValue(start),
      fim: toDatetimeLocalValue(end),
      recorrenciaTipo: rec?.tipo ?? "nenhuma",
      recorrenciaIntervalo: safeInterval(rec?.intervalo),
      diasSemana: rec?.dias_semana ?? [],
      lembreteAtivo: lemb.length > 0,
      lembreteValor: lemb[0]?.valor ?? 30,
      lembreteTipo: lemb[0]?.tipo ?? "minutos",
    }));

    setDialogOpen(true);
  };

  const openVisitDetails = (ev: CalendarItem) => {
    const isVisitAgenda = ev.resource.kind === "evento" && ev.resource.tipo === "visita";
    const isVisitRegistrada = ev.resource.kind === "visita_registrada";
    if (!isVisitAgenda && !isVisitRegistrada) return;

    const membroId = ev.resource.membroVisitadoId ?? null;
    const membroNome = membroId
      ? membros.find((m) => m.id === membroId)?.nome ?? "Membro (sem permissão para ler)"
      : "Membro não informado";

    const visitaId = isVisitRegistrada ? ev.resource.baseId : ev.resource.visitaId ?? null;
    const visitaRow = visitaId ? visitasRegistradas.find((v) => v.id === visitaId) : null;

    setSelectedOccurrence(ev);
    setVisitDialogData({
      title: isVisitAgenda ? "Visita (agendada)" : "Visita (registrada)",
      membroNome,
      quando: ev.start,
      source: isVisitAgenda ? "agenda" : "registrada",
      motivo: visitaRow?.motivo ?? null,
      observacoes: visitaRow?.observacoes ?? null,
      visitaId,
      canEditAgendamento: isVisitAgenda ? canEditEvent(ev) : false,
    });
    setVisitDialogOpen(true);
  };

  const openEventDetails = (ev: CalendarItem) => {
    const start = ev.start;
    const end = ev.end;

    if (ev.resource.kind === "birthday") {
      const membro = membros.find((m) => m.id === ev.resource.baseId) ?? null;
      const age = membro ? calcAgeAtYear(membro.data_nascimento, start.getFullYear()) : null;
      const phoneText = membro?.telefone?.trim() ? membro.telefone.trim() : null;
      const phoneStatus = membro?.status_telefone?.trim() ? membro.status_telefone.trim() : null;

      setEventDrawerData({
        title: ev.title,
        kindLabel: "Aniversário",
        quando: { start, end, allDay: true },
        sections: membro
          ? [
              {
                label: "Membro",
                value: (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {membro.nome?.trim()?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{membro.nome}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(membro.cargos ?? [])
                          .filter((c): c is string => !!c && !!String(c).trim())
                          .map((cargo) => (
                            <Badge key={cargo} variant="secondary">
                              {cargo}
                            </Badge>
                          ))}
                        {membro.faixa_etaria ? <Badge variant="outline">{membro.faixa_etaria}</Badge> : null}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                label: "Idade",
                value: age !== null ? `${age} anos` : "—",
              },
              {
                label: "Telefone",
                value: phoneText ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Phone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">{phoneText}</span>
                      </div>
                      {phoneStatus ? <div className="text-xs text-muted-foreground capitalize">{phoneStatus}</div> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Copiar telefone"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(phoneText);
                          toast.success("Telefone copiado");
                        } catch {
                          toast.error("Não foi possível copiar o telefone");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  "—"
                ),
              },
            ]
          : [{ label: "Membro", value: "Dados do membro indisponíveis." }],
        footer: membro ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEventDrawerOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setEventDrawerOpen(false);
                navigate(`/membros/visualizar/${membro.id}`);
              }}
            >
              Abrir perfil
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setEventDrawerOpen(false)}>
            Fechar
          </Button>
        ),
      });
      setEventDrawerOpen(true);
      return;
    }

    if (ev.resource.kind === "reuniao") {
      const reuniao = reunioes.find((r) => r.id === ev.resource.baseId);
      setEventDrawerData({
        title: ev.title,
        kindLabel: "Reunião",
        quando: { start, end, allDay: true },
        sections: [
          { label: "Data", value: format(start, "dd/MM/yyyy", { locale: ptBR }) },
          { label: "Tema", value: reuniao?.tema?.trim() ? reuniao.tema : "—" },
          { label: "Quem atendeu", value: reuniao?.quem_atendeu?.trim() ? reuniao.quem_atendeu : "—" },
          { label: "Palavra", value: reuniao?.palavra_referencia?.trim() ? reuniao.palavra_referencia : "—" },
          { label: "Número de visitas", value: Number.isFinite(Number(reuniao?.numero_visitas)) ? Number(reuniao?.numero_visitas) : "—" },
          {
            label: "Recitativos individuais",
            value: Number.isFinite(Number(reuniao?.recitativos_individuais)) ? Number(reuniao?.recitativos_individuais) : "—",
          },
          {
            label: "Resumo",
            value: <MeetingStatsBlock reuniaoId={ev.resource.baseId} reuniao={reuniao} />,
          },
          {
            label: "Observações",
            value: reuniao?.observacoes?.trim() ? (
              <div className="whitespace-pre-wrap">{reuniao.observacoes}</div>
            ) : (
              "—"
            ),
          },
        ],
        footer: (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setEventDrawerOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => navigate(`/reunioes/visualizar/${ev.resource.baseId}`)}>Abrir reunião</Button>
          </div>
        ),
      });
      setEventDrawerOpen(true);
      return;
    }

    // evento manual
    const base = rawEventos.find((r) => r.id === ev.resource.baseId);
    const canEditForm = !!user && !!base && base.user_id === user.id;
    setSelectedOccurrence(ev);
    setEventDrawerData({
      title: base?.titulo ?? ev.title,
      kindLabel: `Evento · ${tipoLabel[ev.resource.tipo ?? (base?.tipo as EventoTipo) ?? "ajuntamento"]}`,
      quando: { start, end, allDay: ev.allDay },
      local: base?.local ?? ev.resource.local ?? null,
      descricao: base?.descricao ?? ev.resource.descricao ?? null,
      canEdit: canEditForm,
    });
    setEventDrawerOpen(true);
  };

  const validateForm = () => {
    if (!form.titulo.trim()) return "Informe um título";
    if (form.tipo === "visita" && !form.membroVisitadoId) return "Selecione o membro visitado";
    const inicio = new Date(form.inicio);
    const fim = new Date(form.fim);
    if (!Number.isFinite(inicio.getTime())) return "Data/hora de início inválida";
    if (!Number.isFinite(fim.getTime())) return "Data/hora de fim inválida";
    if (fim <= inicio) return "A data/hora de fim deve ser depois do início";
    if (form.recorrenciaTipo !== "nenhuma" && form.recorrenciaIntervalo <= 0) return "Intervalo de recorrência inválido";
    if (form.recorrenciaTipo === "semanal" && form.diasSemana.length === 0) return "Selecione ao menos 1 dia da semana";
    if (form.lembreteAtivo && form.lembreteValor <= 0) return "Valor do lembrete inválido";
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      toast.error(err);
      return;
    }
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    const payload = {
      user_id: user.id,
      group_id: activeGroupId,
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() ? form.descricao.trim() : null,
      local: form.local.trim() ? form.local.trim() : null,
      membro_visitado_id: form.tipo === "visita" ? form.membroVisitadoId : null,
      dia_inteiro: form.diaInteiro,
      data_inicio: new Date(form.inicio).toISOString(),
      data_fim: new Date(form.fim).toISOString(),
      recorrencia:
        form.recorrenciaTipo === "nenhuma"
          ? null
          : {
              tipo: form.recorrenciaTipo,
              intervalo: safeInterval(form.recorrenciaIntervalo),
              ...(form.recorrenciaTipo === "semanal" ? { dias_semana: form.diasSemana.slice().sort() } : {}),
            },
      lembretes: form.lembreteAtivo
        ? [{ tipo: form.lembreteTipo, valor: Number(form.lembreteValor) }]
        : [],
    };

    try {
      setLoading(true);
      if (mode === "create") {
        const { error } = await supabase.from("eventos").insert([payload]);
        if (error) throw error;
        toast.success("Evento criado");
      } else if (mode === "edit" && selectedOccurrence?.resource.baseId) {
        const { error } = await supabase
          .from("eventos")
          .update({
            tipo: payload.tipo,
            titulo: payload.titulo,
            descricao: payload.descricao,
            local: payload.local,
            membro_visitado_id: payload.membro_visitado_id,
            dia_inteiro: payload.dia_inteiro,
            data_inicio: payload.data_inicio,
            data_fim: payload.data_fim,
            recorrencia: payload.recorrencia as any,
            lembretes: payload.lembretes as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedOccurrence.resource.baseId);
        if (error) throw error;
        toast.success("Evento atualizado");
      }
      setDialogOpen(false);
      await loadEventos();
    } catch (e) {
      console.error("Erro ao salvar evento:", e);
      toast.error("Erro ao salvar evento");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOccurrence?.resource.baseId) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("eventos").delete().eq("id", selectedOccurrence.resource.baseId);
      if (error) throw error;
      toast.success("Evento removido");
      setDialogOpen(false);
      await loadEventos();
    } catch (e) {
      console.error("Erro ao deletar evento:", e);
      toast.error("Erro ao deletar evento");
    } finally {
      setLoading(false);
    }
  };

  const eventPropGetter = (event: CalendarItem) => {
    if (event.resource.kind === "evento" && event.resource.tipo) {
      return { style: tipoColorStyle(event.resource.tipo) };
    }

    // camadas não-editáveis: usamos tokens do tema (sem cores hardcoded)
    if (event.resource.kind === "birthday") {
      return {
        style: {
          backgroundColor: `hsl(var(--faixa-criancas) / 0.92)`,
          color: `hsl(var(--foreground))`,
          border: `1px solid hsl(var(--faixa-criancas) / 0.45)`,
        },
      };
    }

    if (event.resource.kind === "reuniao") {
      return {
        style: {
          backgroundColor: `hsl(var(--faixa-mocos) / 0.9)`,
          color: `hsl(var(--primary-foreground))`,
          border: `1px solid hsl(var(--faixa-mocos) / 0.45)`,
        },
      };
    }

    // visita registrada
    return {
      style: {
        backgroundColor: `hsl(var(--secondary) / 0.92)`,
        color: `hsl(var(--secondary-foreground))`,
        border: `1px solid hsl(var(--secondary) / 0.35)`,
      },
    };
  };

  const dayPropGetter = (day: Date) => {
    const today = startOfDay(new Date());
    const d = startOfDay(day);

    // Mantém o destaque nativo do react-big-calendar em "hoje" (.rbc-today)
    if (isSameDay(d, today)) return {};

    // Dias já passados mais escuros; próximos ficam normais (sem override)
    if (isBefore(d, today)) {
      return {
        style: {
          backgroundColor: `hsl(var(--muted) / 0.55)`,
        },
      };
    }

    return {};
  };

  const canEditEvent = (ev: CalendarItem) => {
    if (!user) return false;
    if (ev.resource.kind !== "evento") return false;
    if (ev.resource.userId !== user.id) return false;
    // MVP: não permitimos drag/resize de recorrentes (precisa de UI de "esta ocorrência" vs "série").
    if (ev.resource.recorrencia) return false;
    // se for uma ocorrência gerada, também bloqueia
    if (ev.resource.occurrenceStartISO) return false;
    return true;
  };

  const requestMoveConfirm = (ev: CalendarItem, next: { start: Date; end: Date; allDay: boolean }) => {
    if (!canEditEvent(ev)) {
      if (ev.resource.recorrencia || ev.resource.occurrenceStartISO) {
        toast.error("Eventos recorrentes não podem ser movidos por arrastar nesta versão (edite no formulário)");
      } else {
        toast.error("Você não tem permissão para alterar este evento");
      }
      return;
    }

    setPendingMove({
      baseId: ev.resource.baseId,
      title: ev.title,
      fromStart: ev.start,
      fromEnd: ev.end,
      toStart: next.start,
      toEnd: next.end,
      allDay: next.allDay,
    });
    setConfirmMoveOpen(true);
  };

  const handleConfirmMove = async () => {
    if (!pendingMove) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("eventos")
        .update({
          data_inicio: pendingMove.toStart.toISOString(),
          data_fim: pendingMove.toEnd.toISOString(),
          dia_inteiro: pendingMove.allDay,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pendingMove.baseId);
      if (error) throw error;
      toast.success("Evento atualizado");
      await loadEventos();
    } catch (e) {
      console.error("Erro ao atualizar evento:", e);
      toast.error("Erro ao atualizar evento");
    } finally {
      setLoading(false);
      setConfirmMoveOpen(false);
      setPendingMove(null);
    }
  };

  const onSelectSlot = (slotInfo: any) => {
    const start = slotInfo?.start instanceof Date ? slotInfo.start : new Date();
    openCreateDialog(start);
  };

  const isReadOnly = mode === "view";
  const canDelete = mode === "edit";

  const canRegisterVisit =
    selectedOccurrence?.resource.kind === "evento" &&
    selectedOccurrence.resource.tipo === "visita" &&
    !selectedOccurrence.resource.visitaId;

  const handleRegisterVisit = () => {
    if (!selectedOccurrence?.resource.baseId) return;
    const membroId = form.membroVisitadoId || selectedOccurrence.resource.membroVisitadoId;
    const qs = new URLSearchParams({
      eventoId: selectedOccurrence.resource.baseId,
      ...(membroId ? { membroId } : {}),
    });
    navigate(`/visitas/nova?${qs.toString()}`);
  };

  return (
    <div className="h-full w-full">
      <Card className="h-full overflow-hidden">
        <CardContent className="flex h-full flex-col gap-3 p-3 md:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge style={tipoColorStyle("ajuntamento")}>Ajuntamento</Badge>
              <Badge style={tipoColorStyle("saida")}>Saída</Badge>
              <Badge style={tipoColorStyle("visita")}>Visita (agenda)</Badge>
                <Badge
                  style={{
                    backgroundColor: `hsl(var(--secondary) / 0.92)`,
                    color: `hsl(var(--secondary-foreground))`,
                    border: `1px solid hsl(var(--secondary) / 0.35)`,
                  }}
                >
                  Visita (registrada)
                </Badge>
                <Badge
                  style={{
                    backgroundColor: `hsl(var(--faixa-criancas) / 0.92)`,
                    color: `hsl(var(--foreground))`,
                    border: `1px solid hsl(var(--faixa-criancas) / 0.45)`,
                  }}
                >
                  Aniversário
                </Badge>
                <Badge
                  style={{
                    backgroundColor: `hsl(var(--faixa-mocos) / 0.9)`,
                    color: `hsl(var(--primary-foreground))`,
                    border: `1px solid hsl(var(--faixa-mocos) / 0.45)`,
                  }}
                >
                  Reunião
                </Badge>
            </div>
            {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}
          </div>

          <div className="flex-1 min-h-0">
            <DnDCalendar
              localizer={localizer}
              culture="pt-BR"
              events={events}
              startAccessor="start"
              endAccessor="end"
              titleAccessor="title"
              view={view}
              date={date}
              onView={(v) => setView(v)}
              onNavigate={(d) => setDate(d)}
              selectable
              onSelectSlot={onSelectSlot}
              onSelectEvent={(e) => {
                const ev = e as any as CalendarItem;
                if (ev.resource.kind === "visita_registrada" || (ev.resource.kind === "evento" && ev.resource.tipo === "visita")) {
                  openVisitDetails(ev);
                  return;
                }
                openEventDetails(ev);
              }}
              draggableAccessor={(e) => canEditEvent(e as any)}
              resizableAccessor={(e) => canEditEvent(e as any)}
              onEventDrop={(args: EventInteractionArgs<CalendarItem>) =>
                requestMoveConfirm(args.event, {
                  start: args.start,
                  end: args.end,
                  allDay: !!args.isAllDay,
                })
              }
              onEventResize={(args: ResizeEventArgs<CalendarItem>) =>
                requestMoveConfirm(args.event, {
                  start: args.start,
                  end: args.end,
                  allDay: !!args.isAllDay,
                })
              }
              popup
              views={{ month: true, week: true, day: true, agenda: true }}
              messages={{
                today: "Hoje",
                previous: "Anterior",
                next: "Próximo",
                month: "Mês",
                week: "Semana",
                day: "Dia",
                agenda: "Lista",
                date: "Data",
                time: "Hora",
                event: "Evento",
                noEventsInRange: "Nenhum evento neste período.",
                showMore: (total) => `+${total} mais`,
              }}
              eventPropGetter={eventPropGetter as any}
              dayPropGetter={dayPropGetter as any}
              components={{
                event: ({ event }) => (
                  <span className="rbc-event-content">
                    <HighlightedText text={(event as any as CalendarItem).title} query={searchText} />
                  </span>
                ),
                agenda: {
                  event: ({ event }) => (
                    <span>
                      <HighlightedText text={(event as any as CalendarItem).title} query={searchText} />
                    </span>
                  ),
                },
              }}
              style={{ height: "100%" }}
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmMoveOpen} onOpenChange={setConfirmMoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove ? (
                <span className="block space-y-1">
                  <span className="block">
                    Deseja atualizar <span className="font-medium">{pendingMove.title}</span>?
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    De {format(pendingMove.fromStart, "dd/MM/yyyy HH:mm", { locale: ptBR })} até{" "}
                    {format(pendingMove.fromEnd, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Para {format(pendingMove.toStart, "dd/MM/yyyy HH:mm", { locale: ptBR })} até{" "}
                    {format(pendingMove.toEnd, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingMove(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmMove()} disabled={loading}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" && "Novo evento"}
              {mode === "edit" && "Editar evento"}
              {mode === "view" && "Detalhes do evento"}
            </DialogTitle>
            <DialogDescription>
              {selectedOccurrence ? (
                <span>
                  {tipoLabel[selectedOccurrence.resource.tipo]} — {format(selectedOccurrence.start, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              ) : (
                "Cadastre eventos futuros e organize o calendário."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as EventoTipo }))}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ajuntamento">Ajuntamento</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                </SelectContent>
              </Select>
            </div>

              {form.tipo === "visita" && (
                <div className="grid gap-2">
                  <Label>Membro visitado</Label>
                  <Select
                    value={form.membroVisitadoId}
                    onValueChange={(v) => setForm((f) => ({ ...f, membroVisitadoId: v }))}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o membro" />
                    </SelectTrigger>
                    <SelectContent>
                      {membros.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mode !== "create" && selectedOccurrence?.resource.visitaId && (
                    <p className="text-xs text-muted-foreground">
                      Esta visita já foi vinculada a um registro.
                    </p>
                  )}
                </div>
              )}

            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Visita à igreja X"
                disabled={isReadOnly}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={form.inicio}
                  onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
                  disabled={isReadOnly}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={form.fim}
                  onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Dia inteiro</div>
                <div className="text-xs text-muted-foreground">Marca como evento sem horário específico.</div>
              </div>
              <Switch
                checked={form.diaInteiro}
                onCheckedChange={(v) => setForm((f) => ({ ...f, diaInteiro: v }))}
                disabled={isReadOnly}
              />
            </div>

            <div className="grid gap-2">
              <Label>Local</Label>
              <Input
                value={form.local}
                onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))}
                placeholder="Ex: Igreja Central"
                disabled={isReadOnly}
              />
            </div>

            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Detalhes do evento…"
                disabled={isReadOnly}
              />
            </div>

            <div className="grid gap-2">
              <Label>Recorrência</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  value={form.recorrenciaTipo}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      recorrenciaTipo: v as any,
                      diasSemana: v === "semanal" ? f.diasSemana : [],
                    }))
                  }
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Intervalo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.recorrenciaIntervalo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, recorrenciaIntervalo: Number(e.target.value || 1) }))
                    }
                    disabled={isReadOnly || form.recorrenciaTipo === "nenhuma"}
                  />
                </div>
              </div>

              {form.recorrenciaTipo === "semanal" && (
                <div className="flex flex-wrap gap-2">
                  {[
                    { d: 0, l: "Dom" },
                    { d: 1, l: "Seg" },
                    { d: 2, l: "Ter" },
                    { d: 3, l: "Qua" },
                    { d: 4, l: "Qui" },
                    { d: 5, l: "Sex" },
                    { d: 6, l: "Sáb" },
                  ].map((w) => {
                    const active = form.diasSemana.includes(w.d);
                    return (
                      <Button
                        key={w.d}
                        type="button"
                        variant={active ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            diasSemana: active
                              ? f.diasSemana.filter((x) => x !== w.d)
                              : [...f.diasSemana, w.d].sort(),
                          }))
                        }
                        disabled={isReadOnly}
                      >
                        {w.l}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Lembrete</div>
                <div className="text-xs text-muted-foreground">Salva no evento (notificações serão a próxima etapa).</div>
              </div>
              <Switch
                checked={form.lembreteAtivo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, lembreteAtivo: v }))}
                disabled={isReadOnly}
              />
            </div>

            {form.lembreteAtivo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Quando</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.lembreteValor}
                    onChange={(e) => setForm((f) => ({ ...f, lembreteValor: Number(e.target.value || 1) }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade</Label>
                  <Select
                    value={form.lembreteTipo}
                    onValueChange={(v) => setForm((f) => ({ ...f, lembreteTipo: v as any }))}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutos">Minutos antes</SelectItem>
                      <SelectItem value="horas">Horas antes</SelectItem>
                      <SelectItem value="dias">Dias antes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === "view" && (
              <div className="flex items-center gap-2">
                {canRegisterVisit && (
                  <Button
                    variant="outline"
                    onClick={handleRegisterVisit}
                    disabled={!form.membroVisitadoId}
                    title={!form.membroVisitadoId ? "Selecione o membro visitado" : undefined}
                  >
                    Registrar visita
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            )}

            {mode !== "view" && (
              <div className="flex items-center gap-2">
                {canDelete && (
                  <Button variant="destructive" onClick={() => void handleDelete()} disabled={loading}>
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                )}
                <Button onClick={() => void handleSave()} disabled={loading}>
                  {mode === "create" ? (
                    <>
                      <Plus className="h-4 w-4" />
                      Criar
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VisitDetailsDialog
        open={visitDialogOpen}
        onOpenChange={setVisitDialogOpen}
        data={visitDialogData}
        onOpenVisita={() => {
          if (!visitDialogData?.visitaId) return;
          navigate(`/visitas/nova?id=${visitDialogData.visitaId}`);
        }}
        onEditarAgendamento={() => {
          if (!selectedOccurrence) return;
          setVisitDialogOpen(false);
          openFromEvent(selectedOccurrence);
        }}
      />

      <EventDetailsDrawer
        open={eventDrawerOpen}
        onOpenChange={setEventDrawerOpen}
        data={eventDrawerData}
        onEditar={() => {
          if (!selectedOccurrence) return;
          setEventDrawerOpen(false);
          openFromEvent(selectedOccurrence);
        }}
      />
    </div>
  );
}
