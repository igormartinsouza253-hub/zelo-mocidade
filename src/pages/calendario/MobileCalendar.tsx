import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MobileEventUpsertDialog } from "@/pages/calendario/components/MobileEventUpsertDialog";
import { MobileEventDetailsDialog, type MobileEventDetails } from "@/pages/calendario/components/MobileEventDetailsDialog";

type EventoTipo = "ajuntamento" | "saida" | "visita";

type Recorrencia =
  | null
  | {
      tipo: "semanal" | "mensal";
      intervalo?: number;
      dias_semana?: number[]; // 0-6
    };

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
};

type ReuniaoRow = {
  id: string;
  data: string; // YYYY-MM-DD
  tema: string | null;
  numero_visitas?: number | null;
  recitativos_individuais?: number | null;
};

type VisitaRow = {
  id: string;
  data_visita: string | null;
  motivo: string | null;
  observacoes: string | null;
  membro_visitado_id: string;
  is_past: boolean;
};

type MembroRow = {
  id: string;
  nome: string;
  data_aniversario: string | null; // MM-DD
  data_nascimento: string | null; // YYYY-MM-DD
};

type MobileCalendarItem =
  | {
      kind: "evento";
      id: string; // id da ocorrência (se recorrente)
      baseId: string; // id do evento base (DB)
      title: string;
      start: Date;
      end: Date;
      allDay: boolean;
      tipo: EventoTipo;
      descricao?: string | null;
      local?: string | null;
    }
  | {
      kind: "reuniao";
      id: string;
      title: string;
      start: Date;
      end: Date;
      theme?: string | null;
      reuniao: ReuniaoRow;
    }
  | {
      kind: "visita_registrada";
      id: string;
      title: string;
      start: Date;
      end: Date;
      motivo?: string | null;
      observacoes?: string | null;
    }
  | {
      kind: "aniversario";
      id: string;
      title: string;
      start: Date;
      end: Date;
      idade?: number | null;
    };

function safeInterval(n: unknown) {
  const val = typeof n === "number" ? n : Number(n);
  return Number.isFinite(val) && val > 0 ? val : 1;
}

function parseLocalDateOnly(dateString: string, hour = 12) {
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour, 0, 0, 0);
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

function inRangeInclusive(d: Date, start: Date, end: Date) {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function expandRecurrence(base: {
  id: string;
  start: Date;
  end: Date;
  tipo: EventoTipo;
  titulo: string;
  allDay: boolean;
  descricao?: string | null;
  local?: string | null;
  recorrencia: Recorrencia;
}, rangeStart: Date, rangeEnd: Date): MobileCalendarItem[] {
  if (!base.recorrencia) {
    const inRange = inRangeInclusive(base.start, rangeStart, rangeEnd) || inRangeInclusive(base.end, rangeStart, rangeEnd);
    return inRange
      ? [
          {
            kind: "evento",
            id: base.id,
            baseId: base.id,
            title: base.titulo,
            start: base.start,
            end: base.end,
            allDay: base.allDay,
            tipo: base.tipo,
            descricao: base.descricao,
            local: base.local,
          },
        ]
      : [];
  }

  const occurrences: MobileCalendarItem[] = [];
  const interval = safeInterval(base.recorrencia.intervalo);
  const durationMs = base.end.getTime() - base.start.getTime();

  const scanStart = addDays(rangeStart, -7);
  const scanEnd = addDays(rangeEnd, 7);

  if (base.recorrencia.tipo === "semanal") {
    const dias = (base.recorrencia.dias_semana?.length ? base.recorrencia.dias_semana : [base.start.getDay()])
      .slice()
      .sort();

    let cursor = startOfWeek(base.start, { locale: ptBR });
    const baseWeek = startOfWeek(base.start, { locale: ptBR }).getTime();

    while (cursor.getTime() < scanEnd.getTime()) {
      const weeksFromBase = Math.floor((cursor.getTime() - baseWeek) / (7 * 24 * 60 * 60 * 1000));
      if (weeksFromBase % interval === 0) {
        for (const dayIndex of dias) {
          const occStart = addDays(cursor, dayIndex);
          occStart.setHours(base.start.getHours(), base.start.getMinutes(), 0, 0);
          const occEnd = new Date(occStart.getTime() + durationMs);
          if (inRangeInclusive(occStart, scanStart, scanEnd)) {
            occurrences.push({
              kind: "evento",
              id: `${base.id}__${occStart.toISOString()}`,
              baseId: base.id,
              title: base.titulo,
              start: occStart,
              end: occEnd,
              allDay: base.allDay,
              tipo: base.tipo,
              descricao: base.descricao,
              local: base.local,
            });
          }
        }
      }
      cursor = addDays(cursor, 7);
    }
  }

  if (base.recorrencia.tipo === "mensal") {
    let cursor = new Date(base.start);
    while (cursor.getTime() < scanStart.getTime()) cursor = addMonths(cursor, interval);

    while (cursor.getTime() < scanEnd.getTime()) {
      const occStart = new Date(cursor);
      const occEnd = new Date(occStart.getTime() + durationMs);
      if (inRangeInclusive(occStart, scanStart, scanEnd)) {
        occurrences.push({
          kind: "evento",
          id: `${base.id}__${occStart.toISOString()}`,
          baseId: base.id,
          title: base.titulo,
          start: occStart,
          end: occEnd,
          allDay: base.allDay,
          tipo: base.tipo,
          descricao: base.descricao,
          local: base.local,
        });
      }
      cursor = addMonths(cursor, interval);
    }
  }

  return occurrences.filter((o) => inRangeInclusive(o.start, rangeStart, rangeEnd) || inRangeInclusive(o.end, rangeStart, rangeEnd));
}

function eventAccentStyle(tipo: EventoTipo): CSSProperties {
  if (tipo === "ajuntamento") return { backgroundColor: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" };
  if (tipo === "saida") return { backgroundColor: "hsl(var(--faixa-meninos) / 0.18)", color: "hsl(var(--foreground))" };
  return { backgroundColor: "hsl(var(--faixa-visitas) / 0.18)", color: "hsl(var(--foreground))" };
}

function dotStyle(kind: MobileCalendarItem["kind"], tipo?: EventoTipo): CSSProperties {
  if (kind === "aniversario") return { backgroundColor: "hsl(var(--primary))" };
  if (kind === "reuniao") return { backgroundColor: "hsl(var(--faixa-mocos))" };
  if (kind === "visita_registrada") return { backgroundColor: "hsl(var(--faixa-visitas))" };
  if (tipo === "ajuntamento") return { backgroundColor: "hsl(var(--primary))" };
  if (tipo === "saida") return { backgroundColor: "hsl(var(--faixa-meninos))" };
  return { backgroundColor: "hsl(var(--faixa-visitas))" };
}

function dayTintStyle(items: MobileCalendarItem[]): CSSProperties | undefined {
  if (!items.length) return undefined;

  const pick =
    items.find((i) => i.kind === "evento") ??
    items.find((i) => i.kind === "reuniao") ??
    items.find((i) => i.kind === "visita_registrada") ??
    items.find((i) => i.kind === "aniversario") ??
    null;

  if (!pick) return undefined;

  if (pick.kind === "evento") {
    if (pick.tipo === "ajuntamento") return { backgroundColor: "hsl(var(--primary) / 0.08)" };
    if (pick.tipo === "saida") return { backgroundColor: "hsl(var(--faixa-meninos) / 0.08)" };
    return { backgroundColor: "hsl(var(--faixa-visitas) / 0.08)" };
  }

  if (pick.kind === "reuniao") return { backgroundColor: "hsl(var(--faixa-mocos) / 0.08)" };
  if (pick.kind === "visita_registrada") return { backgroundColor: "hsl(var(--faixa-visitas) / 0.08)" };

  return { backgroundColor: "hsl(var(--primary) / 0.08)" };
}

type PresenceCountState = { loading: boolean; count: number };

export default function MobileCalendar() {
  const { setConfig } = usePageHeader();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeGroupId } = useActiveGroup();

  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const raw = localStorage.getItem("mobileCalendarMonthV1");
    if (!raw) return new Date();
    const parsed = parseISO(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  });

  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const [loading, setLoading] = useState(true);
  const [rawEventos, setRawEventos] = useState<EventoRow[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoRow[]>([]);
  const [visitasRegistradas, setVisitasRegistradas] = useState<VisitaRow[]>([]);
  const [membros, setMembros] = useState<MembroRow[]>([]);
  const [creatorNameByUserId, setCreatorNameByUserId] = useState<Record<string, string>>({});

  const [presenceByMeetingId, setPresenceByMeetingId] = useState<Record<string, PresenceCountState>>({});

  const [upsertOpen, setUpsertOpen] = useState(false);
  const [upsertDefaultISO, setUpsertDefaultISO] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<MobileEventDetails | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<MobileEventDetails | null>(null);

  const [isGroupAdmin, setIsGroupAdmin] = useState(false);

  const [showEventos, setShowEventos] = useState(true);
  const [showReunioes, setShowReunioes] = useState(true);
  const [showVisitasRegistradas, setShowVisitasRegistradas] = useState(true);
  const [showAniversarios, setShowAniversarios] = useState(true);

  const [showTipoAjuntamento, setShowTipoAjuntamento] = useState(true);
  const [showTipoSaida, setShowTipoSaida] = useState(true);
  const [showTipoVisitaAgenda, setShowTipoVisitaAgenda] = useState(true);

  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    setConfig({
      title: "Agenda",
      icon: CalendarDays,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Agenda" }],
      showBackButton: true,
      backTo: "/",
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    localStorage.setItem("mobileCalendarMonthV1", monthCursor.toISOString());
  }, [monthCursor]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id || !activeGroupId) {
        setIsGroupAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", activeGroupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setIsGroupAdmin(false);
        return;
      }

      setIsGroupAdmin(data?.role === "admin");
    };

    void checkAdmin();
  }, [activeGroupId, user?.id]);

  // Deep-link: /calendario?new=1 abre o modal de criação
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") !== "1") return;

    setEditingEvent(null);
    setUpsertDefaultISO(new Date().toISOString());
    setUpsertOpen(true);

    // remove o parâmetro para não reabrir ao voltar
    params.delete("new");
    const next = params.toString();
    navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const monthRange = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthCursor), { locale: ptBR });
    const end = endOfWeek(endOfMonth(monthCursor), { locale: ptBR });
    return { start, end };
  }, [monthCursor]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Mantém a mesma fonte de dados do desktop: eventos, reuniões, visitas e membros (aniversários).
        const [eventosRes, reunioesRes, visitasRes, membrosRes] = await Promise.all([
          supabase
            .from("eventos")
            .select(
              "id, user_id, tipo, titulo, descricao, local, data_inicio, data_fim, dia_inteiro, recorrencia, lembretes, membro_visitado_id, visita_id",
            )
            .gte("data_inicio", monthRange.start.toISOString())
            .lte("data_inicio", monthRange.end.toISOString())
            .order("data_inicio", { ascending: true }),
          supabase
            .from("reunioes")
            .select("id, data, tema, numero_visitas, recitativos_individuais")
            .gte("data", format(monthRange.start, "yyyy-MM-dd"))
            .lte("data", format(monthRange.end, "yyyy-MM-dd"))
            .order("data", { ascending: true }),
          supabase
            .from("visitas")
            .select("id, data_visita, motivo, observacoes, membro_visitado_id, is_past")
            .gte("data_visita", monthRange.start.toISOString())
            .lte("data_visita", monthRange.end.toISOString())
            .order("data_visita", { ascending: true }),
          activeGroupId
            ? supabase
                .from("membros")
                .select("id, nome, data_aniversario, data_nascimento")
                .eq("group_id", activeGroupId)
                .order("nome")
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        setRawEventos((eventosRes.data || []) as any);
        setReunioes((reunioesRes.data || []) as any);
        setVisitasRegistradas(((visitasRes.data || []) as any).filter((v: any) => !!v.data_visita));
        setMembros((membrosRes.data || []) as any);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeGroupId, monthRange.end, monthRange.start]);

  useEffect(() => {
    const loadEventCreators = async () => {
      const userIds = Array.from(new Set(rawEventos.map((e) => e.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        setCreatorNameByUserId({});
        return;
      }

      const { data } = await supabase.from("profiles").select("id, username").in("id", userIds).limit(200);
      const next: Record<string, string> = {};
      (data ?? []).forEach((profile: any) => {
        if (profile?.id && profile?.username) next[profile.id] = profile.username;
      });
      setCreatorNameByUserId(next);
    };

    void loadEventCreators();
  }, [rawEventos]);

  function parseMMDD(mmdd: string) {
    const [mm, dd] = mmdd.split("-").map((n) => Number(n));
    if (!Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    if (mm < 1 || mm > 12) return null;
    if (dd < 1 || dd > 31) return null;
    return { mm, dd };
  }

  function getBirthdayMonthDay(m: MembroRow): { mm: number; dd: number } | null {
    if (m.data_aniversario) return parseMMDD(m.data_aniversario);
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

  const allItems = useMemo(() => {
    const items: MobileCalendarItem[] = [];

    // eventos (com recorrência)
    const baseEventos = rawEventos.map((e) => {
      const start = new Date(e.data_inicio);
      const end = new Date(e.data_fim);
      return {
        id: e.id,
        start,
        end,
        tipo: e.tipo,
        titulo: e.titulo,
        allDay: !!e.dia_inteiro,
        descricao: e.descricao,
        local: e.local,
        recorrencia: parseRecorrencia(e.recorrencia),
      };
    });

    baseEventos.forEach((b) => {
      items.push(...expandRecurrence(b, monthRange.start, monthRange.end));
    });

    // reuniões
    reunioes.forEach((r) => {
      const start = parseLocalDateOnly(r.data, 19);
      if (!start) return;

      items.push({
        kind: "reuniao",
        id: r.id,
        title: r.tema ? `Reunião · ${r.tema}` : "Reunião",
        start,
        end: new Date(start.getTime() + 60 * 60 * 1000),
        theme: r.tema,
        reuniao: r,
      });
    });

    // visitas registradas
    visitasRegistradas.forEach((v) => {
      if (!v.data_visita) return;
      const start = new Date(v.data_visita);
      items.push({
        kind: "visita_registrada",
        id: v.id,
        title: "Visita registrada",
        start,
        end: new Date(start.getTime() + 45 * 60 * 1000),
        motivo: v.motivo,
        observacoes: v.observacoes,
      });
    });

    // aniversariantes (membros)
    const cursorYear = monthCursor.getFullYear();
    membros.forEach((m) => {
      const md = getBirthdayMonthDay(m);
      if (!md) return;

      let cursor = monthRange.start;
      while (cursor.getTime() <= monthRange.end.getTime()) {
        const mm = cursor.getMonth() + 1;
        const dd = cursor.getDate();
        if (mm === md.mm && dd === md.dd) {
          const start = new Date(cursor);
          start.setHours(0, 0, 0, 0);
          items.push({
            kind: "aniversario",
            id: m.id,
            title: m.nome,
            start,
            end: new Date(start.getTime() + 30 * 60 * 1000),
            idade: calcAgeAtYear(m.data_nascimento, cursorYear),
          });
        }
        cursor = addDays(cursor, 1);
      }
    });

    items.sort((a, b) => a.start.getTime() - b.start.getTime());
    return items;
  }, [membros, monthCursor, monthRange.end, monthRange.start, rawEventos, reunioes, visitasRegistradas]);

  const days = useMemo(() => {
    const arr: Date[] = [];
    let cursor = monthRange.start;
    while (cursor.getTime() <= monthRange.end.getTime()) {
      arr.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return arr;
  }, [monthRange.end, monthRange.start]);

  const isItemVisible = (it: MobileCalendarItem) => {
    if (it.kind === "evento") {
      if (!showEventos) return false;
      if (it.tipo === "ajuntamento") return showTipoAjuntamento;
      if (it.tipo === "saida") return showTipoSaida;
      return showTipoVisitaAgenda;
    }
    if (it.kind === "reuniao") return showReunioes;
    if (it.kind === "visita_registrada") return showVisitasRegistradas;
    return showAniversarios;
  };

  const filteredAllItems = useMemo(() => allItems.filter(isItemVisible), [
    allItems,
    showAniversarios,
    showEventos,
    showReunioes,
    showTipoAjuntamento,
    showTipoSaida,
    showTipoVisitaAgenda,
    showVisitasRegistradas,
  ]);

  const itemsByDayKey = useMemo(() => {
    const map = new Map<string, MobileCalendarItem[]>();
    filteredAllItems.forEach((it) => {
      const key = format(it.start, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return map;
  }, [filteredAllItems]);

  const selectedKey = useMemo(() => format(selectedDay, "yyyy-MM-dd"), [selectedDay]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const eventId = params.get("eventId");
    if (!eventId) return;

    const target = filteredAllItems.find((it): it is Extract<MobileCalendarItem, { kind: "evento" }> => it.kind === "evento" && it.baseId === eventId);
    if (!target) return;

    setSelectedDay(target.start);
    setDetailsEvent({
      baseId: target.baseId,
      title: target.title,
      start: target.start,
      end: target.end,
      allDay: target.allDay,
      tipo: target.tipo,
      descricao: target.descricao ?? null,
      local: target.local ?? null,
    });
    setDetailsOpen(true);

    params.delete("eventId");
    const next = params.toString();
    navigate({ pathname: location.pathname, search: next ? `?${next}` : "" }, { replace: true });
  }, [filteredAllItems, location.pathname, location.search, navigate]);

  const upcomingStart = useMemo(() => startOfDay(selectedDay), [selectedDay]);
  const upcomingEnd = useMemo(() => addDays(upcomingStart, 60), [upcomingStart]);

  const upcomingItems = useMemo(() => {
    return filteredAllItems
      .filter((it) => it.start.getTime() >= upcomingStart.getTime() && it.start.getTime() <= upcomingEnd.getTime())
      .slice(0, 120);
  }, [filteredAllItems, upcomingEnd, upcomingStart]);

  const upcomingGrouped = useMemo(() => {
    const map = new Map<string, MobileCalendarItem[]>();
    for (const it of upcomingItems) {
      const key = format(it.start, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [upcomingItems]);

  const getRawEventoById = (baseId: string) => rawEventos.find((e) => e.id === baseId) ?? null;

  const loadPresenceCount = async (reuniaoId: string) => {
    setPresenceByMeetingId((prev) => ({
      ...prev,
      [reuniaoId]: prev[reuniaoId] ?? { loading: true, count: 0 },
    }));

    setPresenceByMeetingId((prev) => ({
      ...prev,
      [reuniaoId]: { ...(prev[reuniaoId] ?? { count: 0 }), loading: true },
    }));

    const { data, error } = await supabase
      .from("presencas")
      .select("membro_id")
      .eq("reuniao_id", reuniaoId);

    if (error) {
      setPresenceByMeetingId((prev) => ({
        ...prev,
        [reuniaoId]: { loading: false, count: 0 },
      }));
      return;
    }

    setPresenceByMeetingId((prev) => ({
      ...prev,
      [reuniaoId]: { loading: false, count: (data || []).length },
    }));
  };

  useEffect(() => {
    // pré-carrega contagem para as próximas reuniões visíveis (mantém custo baixo).
    const nextMeetings = upcomingItems.filter((it) => it.kind === "reuniao").slice(0, 8) as Extract<MobileCalendarItem, { kind: "reuniao" }>[];

    nextMeetings.forEach((it) => {
      const cached = presenceByMeetingId[it.id];
      if (cached && (cached.loading || cached.count > 0)) return;
      void loadPresenceCount(it.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, upcomingItems]);

  const onPrevMonth = () => setMonthCursor((d) => subMonths(d, 1));
  const onNextMonth = () => setMonthCursor((d) => addMonths(d, 1));

  const startLongPress = (date: Date) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setEditingEvent(null);
      setUpsertDefaultISO(date.toISOString());
      setUpsertOpen(true);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // swipe horizontal intencional
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      if (dx < 0) onNextMonth();
      else onPrevMonth();
    }
  };

  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <MobileEventUpsertDialog
        open={upsertOpen}
        onOpenChange={(o) => setUpsertOpen(o)}
        defaultStartISO={upsertDefaultISO}
        userId={user?.id ?? null}
        groupId={activeGroupId}
        editingEventId={editingEvent?.baseId ?? null}
        initial={
          editingEvent
            ? {
                tipo: editingEvent.tipo,
                titulo: editingEvent.title,
                descricao: editingEvent.descricao ?? null,
                local: editingEvent.local ?? null,
                diaInteiro: editingEvent.allDay,
                inicioISO: editingEvent.start.toISOString(),
                fimISO: editingEvent.end.toISOString(),
              }
            : null
        }
        onSaved={() => {
          setMonthCursor((d) => new Date(d));
        }}
      />

      <MobileEventDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        event={detailsEvent}
        canEdit={!!detailsEvent && !!user?.id && getRawEventoById(detailsEvent.baseId)?.user_id === user.id}
        canDelete={isGroupAdmin}
        onEdit={(ev) => {
          setDetailsOpen(false);
          setEditingEvent(ev);
          setUpsertDefaultISO(ev.start.toISOString());
          setUpsertOpen(true);
        }}
        onDeleted={() => setMonthCursor((d) => new Date(d))}
      />

      <div className="h-full w-full pb-24 overflow-y-auto scrollbar-none">
        {/* Header fixo */}
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="px-3 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground">Calendário</div>
              <div className="text-base font-semibold text-foreground capitalize truncate">{monthLabel}</div>
            </div>

            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={onPrevMonth} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={onNextMonth} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Grid mensal */}
        <div className="px-3 pt-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="grid grid-cols-7 gap-2 pb-2">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div key={idx} className="text-center text-[10px] font-medium text-muted-foreground">
                {format(addDays(startOfWeek(new Date(), { locale: ptBR }), idx), "EEEEE", { locale: ptBR })}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDayKey.get(key) ?? [];
              const selected = isSameDay(day, selectedDay);
              const inMonth = isSameMonth(day, monthCursor);
              const tint = !selected ? dayTintStyle(dayItems) : undefined;

              return (
                <button
                  key={key}
                  type="button"
                  style={tint}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-between rounded-xl border px-1 py-1 transition",
                    "active:scale-[0.98]",
                    selected
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/60 bg-card hover:bg-accent/30",
                    !inMonth && "opacity-55",
                  )}
                  onClick={() => setSelectedDay(day)}
                  onPointerDown={() => startLongPress(day)}
                  onPointerUp={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  aria-pressed={selected}
                >
                  <span className={cn("text-xs font-semibold", selected ? "text-foreground" : "text-foreground")}>{format(day, "d")}</span>

                    <div className="flex items-center gap-1">
                      {dayItems.slice(0, 3).map((it, i) => (
                        <span
                          key={`${it.kind}-${it.id}-${i}`}
                          className="h-1.5 w-1.5 rounded-full"
                          style={dotStyle(it.kind, it.kind === "evento" ? it.tipo : undefined)}
                          aria-hidden="true"
                        />

                      ))}
                    {dayItems.length > 3 ? (
                      <span className="text-[10px] font-medium text-muted-foreground">+{dayItems.length - 3}</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Dica: deslize para os lados para trocar de mês. Toque longo em um dia para criar evento.
          </div>
        </div>

        {/* Próximos itens */}
        <div className="px-3 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Próximos</div>
              <div className="text-sm font-semibold text-foreground truncate">
                A partir de {format(selectedDay, "dd/MM", { locale: ptBR })}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" aria-label="Filtros">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Exibir</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem checked={showEventos} onCheckedChange={(v) => setShowEventos(!!v)}>
                    Eventos
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showReunioes} onCheckedChange={(v) => setShowReunioes(!!v)}>
                    Reuniões
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showVisitasRegistradas}
                    onCheckedChange={(v) => setShowVisitasRegistradas(!!v)}
                  >
                    Visitas
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={showAniversarios} onCheckedChange={(v) => setShowAniversarios(!!v)}>
                    Aniversários
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Tipos de evento</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={showTipoAjuntamento}
                    onCheckedChange={(v) => setShowTipoAjuntamento(!!v)}
                    disabled={!showEventos}
                  >
                    Ajuntamento
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showTipoSaida}
                    onCheckedChange={(v) => setShowTipoSaida(!!v)}
                    disabled={!showEventos}
                  >
                    Saída
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showTipoVisitaAgenda}
                    onCheckedChange={(v) => setShowTipoVisitaAgenda(!!v)}
                    disabled={!showEventos}
                  >
                    Visita (agenda)
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  setSelectedDay(new Date());
                  setMonthCursor(new Date());
                }}
              >
                Hoje
              </Button>
            </div>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando…</CardContent>
            </Card>
          ) : upcomingGrouped.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum item futuro encontrado.</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcomingGrouped.map(([dayKey, dayItems]) => (
                <section key={dayKey} className="space-y-2">
                  <div className="px-1">
                    <h2 className="text-sm font-semibold text-foreground">
                      {format(new Date(`${dayKey}T00:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </h2>
                  </div>

                  <div className="space-y-2">
                    {dayItems.map((it) => {
                      if (it.kind === "aniversario") {
                        return (
                          <Card key={`aniv-${dayKey}-${it.id}`} className="border-border/60 shadow-[var(--shadow-card)]">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">🎂 {it.title}</div>
                                <div className="text-xs text-muted-foreground truncate">{it.idade ? `${it.idade} anos` : "Aniversário"}</div>
                                <div className="mt-1">
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                    style={{ backgroundColor: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))" }}
                                  >
                                    aniversário
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      }

                      if (it.kind === "reuniao") {
                        const pres = presenceByMeetingId[it.id];
                        const presCount = pres?.count ?? 0;
                        const visitasCount = Number(it.reuniao.numero_visitas ?? 0) || 0;
                        const total = pres ? presCount + visitasCount : null;

                        return (
                          <Card key={`reuniao-${dayKey}-${it.id}`} className="border-border/60 shadow-[var(--shadow-card)]">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">Reunião</div>
                                <div className="text-xs text-muted-foreground truncate">{it.theme || "Sem tema"}</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">
                                    reunião
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {pres?.loading ? "Presenças…" : total === null ? "" : `${total} participantes`}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => navigate(`/reunioes/visualizar/${it.id}`)}
                              >
                                Abrir
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      }

                      if (it.kind === "visita_registrada") {
                        return (
                          <Card key={`visita-${dayKey}-${it.id}`} className="border-border/60 shadow-[var(--shadow-card)]">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-foreground truncate">Visita registrada</div>
                                {it.motivo ? <div className="text-xs text-muted-foreground truncate">{it.motivo}</div> : null}
                                <div className="mt-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    visita
                                  </Badge>
                                </div>
                              </div>
                              <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => navigate("/visitas")}>
                                Ver
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      }

                      // evento
                      const timeLabel = it.allDay
                        ? "Dia inteiro"
                        : `${format(it.start, "HH:mm", { locale: ptBR })} — ${format(it.end, "HH:mm", { locale: ptBR })}`;

                      const canEdit = !!user?.id && rawEventos.some((e) => e.id === it.baseId && e.user_id === user.id);

                      return (
                        <Card
                          key={`evento-${dayKey}-${it.id}`}
                          className="border-border/60 shadow-[var(--shadow-card)]"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setDetailsEvent({
                              baseId: it.baseId,
                              title: it.title,
                              start: it.start,
                              end: it.end,
                              allDay: it.allDay,
                              tipo: it.tipo,
                              descricao: it.descricao ?? null,
                              local: it.local ?? null,
                            });
                            setDetailsOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            setDetailsEvent({
                              baseId: it.baseId,
                              title: it.title,
                              start: it.start,
                              end: it.end,
                              allDay: it.allDay,
                              tipo: it.tipo,
                              descricao: it.descricao ?? null,
                              local: it.local ?? null,
                            });
                            setDetailsOpen(true);
                          }}
                          aria-label={`Ver detalhes do evento ${it.title}`}
                        >
                          <CardContent className="p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground truncate">{it.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{timeLabel}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]" style={eventAccentStyle(it.tipo)}>
                                  {it.tipo}
                                </Badge>

                                {it.local ? <span className="text-[10px] text-muted-foreground truncate">{it.local}</span> : null}
                                {canEdit ? <span className="text-[10px] text-muted-foreground">• editável</span> : null}
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsEvent({
                                  baseId: it.baseId,
                                  title: it.title,
                                  start: it.start,
                                  end: it.end,
                                  allDay: it.allDay,
                                  tipo: it.tipo,
                                  descricao: it.descricao ?? null,
                                  local: it.local ?? null,
                                });
                                setDetailsOpen(true);
                              }}
                            >
                              Detalhes
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
