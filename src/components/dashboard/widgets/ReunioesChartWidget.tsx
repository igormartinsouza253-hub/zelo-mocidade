import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { WidgetSize } from "../types";
import { useNavigate } from "react-router-dom";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";
import { format, isValid, parseISO } from "date-fns";
import { resolveHslFromCssVar } from "@/lib/resolve-color";

interface ReunioesChartWidgetProps {
  size: WidgetSize;
  compactMobile?: boolean;
  dashboardSummary?: {
    totalMembros: number;
    totalReunioes: number;
    mediaPresenca: number;
    ultimaReuniao: string;
    percentualGeral: number;
  };
  reunioesRecentes: {
    data: string;
    total: number;
    visitas: number;
    recitativos_individuais: number;
    Crianças?: number;
    Meninos?: number;
    Meninas?: number;
    Moços?: number;
    Moças?: number;
  }[];
}

export const ReunioesChartWidget = ({
  size,
  compactMobile = false,
  dashboardSummary,
  reunioesRecentes,
}: ReunioesChartWidgetProps) => {
  const SERIES_COLORS: Record<string, string> = {
    Crianças: resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    Meninos: resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    Meninas: resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    Moços: resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    Moças: resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
  };

  const VISITAS_COLOR = resolveHslFromCssVar("--faixa-visitas", "33 100% 45%");
  const colorToGradient = (color: string) => color;

  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);

  const isSmall = size === "sm";
  const isLarge = size === "lg";
  const isDashboardPanel = !!dashboardSummary && !compactMobile;

  const headerPadding = WIDGET_HEADER_PADDING[size];
  const titleTextSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

  const meetingsLimit = isDashboardPanel ? 6 : compactMobile ? 5 : isLarge ? 7 : isSmall ? 4 : 5;
  const meetings = useMemo(
    () => reunioesRecentes.slice(-meetingsLimit),
    [meetingsLimit, reunioesRecentes],
  );

  const [selectedIndex, setSelectedIndex] = useState(
    meetings.length > 0 ? meetings.length - 1 : 0,
  );
  const [compactExpandedIndex, setCompactExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(meetings.length > 0 ? meetings.length - 1 : 0);
    setCompactExpandedIndex(null);

    return () => {
      if (navigateTimerRef.current) {
        window.clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = null;
      }
    };
  }, [meetings]);

  const activeIndex = compactMobile ? compactExpandedIndex : selectedIndex;
  const selectedReuniao =
    activeIndex !== null && activeIndex >= 0 && meetings.length > 0
      ? meetings[Math.min(activeIndex, meetings.length - 1)]
      : null;
  const visibleMeetings = useMemo(
    () =>
      compactMobile && compactExpandedIndex !== null
        ? [{ ...meetings[compactExpandedIndex], __meetingIndex: compactExpandedIndex }]
        : meetings.map((meeting, index) => ({ ...meeting, __meetingIndex: index })),
    [compactExpandedIndex, compactMobile, meetings],
  );

  const resumoItems = selectedReuniao
    ? [
        {
          key: "visitas" as const,
          label: "Visitas",
          color: VISITAS_COLOR,
          value: selectedReuniao.visitas ?? 0,
        },
        {
          key: "Crianças" as const,
          label: "Crianças",
          color: SERIES_COLORS["Crianças"],
          value: selectedReuniao.Crianças ?? 0,
        },
        {
          key: "Meninas" as const,
          label: "Meninas",
          color: SERIES_COLORS["Meninas"],
          value: selectedReuniao.Meninas ?? 0,
        },
        {
          key: "Meninos" as const,
          label: "Meninos",
          color: SERIES_COLORS["Meninos"],
          value: selectedReuniao.Meninos ?? 0,
        },
        {
          key: "Moças" as const,
          label: "Moças",
          color: SERIES_COLORS["Moças"],
          value: selectedReuniao.Moças ?? 0,
        },
        {
          key: "Moços" as const,
          label: "Moços",
          color: SERIES_COLORS["Moços"],
          value: selectedReuniao.Moços ?? 0,
        },
      ]
    : [];

  const totalSelecionado = selectedReuniao?.total ?? 0;
  const clampedFrequency = Math.max(0, Math.min(100, dashboardSummary?.percentualGeral || 0));

  const scheduleNavigate = () => {
    if (!isLarge) return;

    if (navigateTimerRef.current) {
      window.clearTimeout(navigateTimerRef.current);
    }

    navigateTimerRef.current = window.setTimeout(() => {
      navigate("/reunioes/estatisticas");
      navigateTimerRef.current = null;
    }, 240);
  };

  const cancelScheduledNavigate = () => {
    if (navigateTimerRef.current) {
      window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }
  };

  const formatMeetingLabel = (raw: string) => {
    try {
      if (!raw) return "";
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = parseISO(raw);
        return isValid(d) ? format(d, "dd-MM") : raw;
      }
      if (/^\d{2}[/-]\d{2}/.test(raw)) return raw.replace("/", "-").slice(0, 5);
      return raw;
    } catch {
      return raw;
    }
  };

  const maxTotal = Math.max(1, ...meetings.map((r) => (typeof r.total === "number" ? r.total : 0)));
  const chartMaxTotal = compactMobile && selectedReuniao ? Math.max(1, selectedReuniao.total) : maxTotal;

  const barSize = compactMobile ? 22 : isLarge ? (meetings.length > 5 ? 30 : 36) : size === "md" ? 28 : 22;
  // PT-BR: no desktop, o gráfico principal ganha altura para ocupar o espaço inferior vazio.
  const chartHeight: number | string = compactMobile ? "100%" : isLarge ? "100%" : size === "md" ? 260 : 220;

  const TopLabel = (props: any) => {
    const { x, y, width, payload } = props;
    if (!payload) return null;

    const ri = payload.recitativos_individuais ?? 0;
    const total = payload.total ?? 0;
    const tr = ri + total;

    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 6;

    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        className="select-none"
        fill="hsl(var(--muted-foreground))"
        fontSize={10}
        fontWeight={600}
      >
        <tspan x={cx} dy={0}>
          RI {ri}
        </tspan>
        <tspan x={cx} dy={12}>
          TR {tr}
        </tspan>
      </text>
    );
  };

  const DateTick = ({ x, y, payload }: any) => {
    if (!payload?.value) return null;

    const tickIndex = meetings.findIndex((meeting) => meeting.data === payload.value);
    if (tickIndex === -1) return null;

    const isSelected = compactMobile ? compactExpandedIndex === tickIndex : tickIndex === selectedIndex;
    const tickWidth = compactMobile ? (compactExpandedIndex !== null ? 50 : meetings.length >= 5 ? 46 : 52) : isLarge && meetings.length > 5 ? 58 : isSmall ? 52 : 68;
    const tickX = -(tickWidth / 2);

    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={tickX} y={2} width={tickWidth} height={40}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (compactMobile) {
                setCompactExpandedIndex((current) => (current === tickIndex ? null : tickIndex));
              }
              setSelectedIndex(tickIndex);
            }}
            className={`mx-auto block rounded-md border font-semibold leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${compactMobile ? "h-10 text-[8px]" : "h-10 text-[10px]"}`}
            style={{ width: tickWidth }}
            aria-pressed={isSelected}
            aria-label={`Selecionar reunião ${formatMeetingLabel(payload.value)}`}
          >
            {formatMeetingLabel(payload.value)}
          </button>
        </foreignObject>
      </g>
    );
  };

  const handleSelectMeeting = (index: number) => {
    if (compactMobile) {
      setCompactExpandedIndex((current) => (current === index ? null : index));
    }
    setSelectedIndex(index);
  };

  const padStat = (value: number) => (value < 100 ? String(value).padStart(2, "0") : String(value));

  const parseMeetingDate = (raw: string) => {
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const parsed = parseISO(raw);
      return isValid(parsed) ? parsed : null;
    }

    const shortMatch = raw.match(/^(\d{2})[/-](\d{2})/);
    if (shortMatch) {
      const [, day, month] = shortMatch;
      return new Date(new Date().getFullYear(), Number(month) - 1, Number(day));
    }

    return null;
  };

  const formatDashboardDate = (raw: string) => {
    const parsed = parseMeetingDate(raw);

    if (!parsed) {
      return { day: "--", month: "SEM DATA", compact: "--" };
    }

    const day = String(parsed.getDate()).padStart(2, "0");
    const month = parsed.toLocaleString("pt-BR", { month: "long" }).toUpperCase();

    return {
      day,
      month,
      compact: `${day} DE ${month}`,
    };
  };

  const dashboardSlots = useMemo(() => {
    const missing = Math.max(0, 6 - meetings.length);
    return [
      ...Array.from({ length: missing }, (_, index) => ({
        key: `empty-${index}`,
        meeting: null,
        meetingIndex: -1,
      })),
      ...meetings.map((meeting, index) => ({
        key: `${meeting.data}-${index}`,
        meeting,
        meetingIndex: index,
      })),
    ].slice(-6);
  }, [meetings]);

  const dashboardSegments = [
    { key: "visitas", label: "Visitas", color: VISITAS_COLOR },
    { key: "Moços", label: "Moços", color: SERIES_COLORS["Moços"] },
    { key: "Moças", label: "Moças", color: SERIES_COLORS["Moças"] },
    { key: "Meninos", label: "Meninos", color: SERIES_COLORS["Meninos"] },
    { key: "Meninas", label: "Meninas", color: SERIES_COLORS["Meninas"] },
    { key: "Crianças", label: "Crianças", color: SERIES_COLORS["Crianças"] },
  ] as const;

  const dashboardResumoItems = selectedReuniao
    ? [
        { key: "Crianças" as const, label: "Crianças", color: SERIES_COLORS["Crianças"], value: selectedReuniao.Crianças ?? 0 },
        { key: "Meninas" as const, label: "Meninas", color: SERIES_COLORS["Meninas"], value: selectedReuniao.Meninas ?? 0 },
        { key: "Meninos" as const, label: "Meninos", color: SERIES_COLORS["Meninos"], value: selectedReuniao.Meninos ?? 0 },
        { key: "Moças" as const, label: "Moças", color: SERIES_COLORS["Moças"], value: selectedReuniao.Moças ?? 0 },
        { key: "Moços" as const, label: "Moços", color: SERIES_COLORS["Moços"], value: selectedReuniao.Moços ?? 0 },
        { key: "visitas" as const, label: "Visitas", color: VISITAS_COLOR, value: selectedReuniao.visitas ?? 0 },
      ]
    : [];

  const maxDashboardStack = Math.max(
    1,
    ...dashboardSlots.map((slot) => {
      if (!slot.meeting) return 0;
      return dashboardSegments.reduce((sum, segment) => sum + Number(slot.meeting?.[segment.key] ?? 0), 0);
    }),
  );

  const ultimaDashboard = dashboardSummary ? formatDashboardDate(dashboardSummary.ultimaReuniao) : null;
  const selectedDashboardDate = selectedReuniao ? formatDashboardDate(selectedReuniao.data) : null;
  const recitativosMedios = Math.round(
    meetings.reduce((sum, meeting) => sum + Number(meeting.recitativos_individuais ?? 0), 0) / Math.max(1, meetings.length),
  );
  const frequencyTone =
    clampedFrequency < 30
      ? { label: "Frequência ruim", accent: "hsl(var(--destructive))", soft: "hsl(var(--destructive) / 0.14)" }
      : clampedFrequency < 70
        ? { label: "Frequência regular", accent: "hsl(38 92% 48%)", soft: "hsl(38 92% 48% / 0.15)" }
        : { label: "Boa frequência", accent: "hsl(145 55% 40%)", soft: "hsl(145 55% 40% / 0.14)" };

  if (isDashboardPanel && dashboardSummary) {
    const summaryCards = [
      { value: padStat(dashboardSummary.totalMembros), label: "Membros", helper: "Ativos" },
      { value: padStat(dashboardSummary.totalReunioes), label: "Reuniões", helper: "Registradas" },
      { value: padStat(recitativosMedios), label: "Recitativos", helper: "Média por reunião" },
      { value: ultimaDashboard?.day ?? "--", label: ultimaDashboard?.month ?? "Última", helper: "Última reunião" },
      { value: padStat(clampedFrequency), label: frequencyTone.label, helper: "Percentual de frequência", tone: frequencyTone },
    ];

    return (
      <Card
        className="flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-[18px] border border-primary/55 bg-card p-1.5 text-card-foreground shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
        onClick={scheduleNavigate}
        onDoubleClick={cancelScheduledNavigate}
      >
        <div className="grid shrink-0 grid-cols-5 gap-1 2xl:grid-cols-[minmax(205px,1.05fr)_repeat(4,minmax(115px,1fr))_minmax(170px,1.2fr)]">
          <div className="col-span-5 flex min-h-10 min-w-0 items-center justify-between gap-3 rounded-[12px] bg-primary px-3 py-2 text-primary-foreground 2xl:col-span-1 2xl:flex-col 2xl:items-stretch 2xl:justify-center 2xl:gap-0">
            <h3 className="truncate text-[15px] font-bold leading-[1.2]">Gráfico de presença</h3>
            <p className="shrink-0 truncate text-[10px] font-bold leading-none opacity-95 2xl:mt-1">
              Últimas {meetings.length} reuniões registradas
            </p>
          </div>

          {summaryCards.map((item) => {
            const tone = item.tone;
            return (
              <div
                key={`${item.label}-${item.helper}`}
                className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-[12px] border border-primary/55 bg-muted/20 px-1.5 py-1.5 shadow-[var(--shadow-soft)] 2xl:gap-2 2xl:px-2"
                style={tone ? { borderColor: tone.accent, background: tone.soft } : undefined}
              >
                <span
                  className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary px-1.5 text-xl font-extrabold leading-none text-primary-foreground tabular-nums"
                  style={tone ? { background: tone.accent } : undefined}
                >
                  {item.value}
                </span>
                <span className="flex min-w-0 flex-col justify-center">
                  <span className="block truncate text-[clamp(9px,0.7vw,11px)] font-extrabold uppercase leading-[1.2] text-foreground" title={item.label}>{item.label}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[clamp(8px,0.62vw,10px)] font-bold leading-[1.2] text-muted-foreground" title={item.helper}>{item.helper}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-1.5 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(230px,0.38fr)] gap-2">
          <div className="flex min-h-0 flex-col rounded-[13px] bg-muted/35 px-3 pb-2 pt-3">
            <div className="grid min-h-0 flex-1 grid-cols-6 items-end gap-3 px-2">
              {dashboardSlots.map((slot) => {
                const meeting = slot.meeting;
                const isSelected = meeting && slot.meetingIndex === selectedIndex;
                const stackTotal = meeting
                  ? dashboardSegments.reduce((sum, segment) => sum + Number(meeting[segment.key] ?? 0), 0)
                  : 0;
                const barHeight = meeting ? Math.max(26, Math.round((stackTotal / maxDashboardStack) * 78)) : 44;

                return (
                  <button
                    key={slot.key}
                    type="button"
                    disabled={!meeting}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (meeting) handleSelectMeeting(slot.meetingIndex);
                    }}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-2 disabled:cursor-default"
                    aria-label={meeting ? `Selecionar reunião ${formatDashboardDate(meeting.data).compact}` : "Reunião não registrada"}
                  >
                    <div
                      className={`flex w-[clamp(2.35rem,4.8vw,3.05rem)] flex-col-reverse overflow-hidden rounded-[10px] shadow-sm transition-opacity ${
                        meeting ? (isSelected ? "opacity-100" : "opacity-80") : "opacity-20"
                      }`}
                      style={{ height: `${barHeight}%` }}
                    >
                      {meeting ? (
                        dashboardSegments.map((segment, segmentIndex) => {
                          const value = Number(meeting[segment.key] ?? 0);
                          const segmentHeight = stackTotal > 0 ? Math.max(value > 0 ? 7 : 0, (value / stackTotal) * 100) : 0;
                          return (
                            <span
                              key={segment.key}
                              className={
                                segmentIndex === 0
                                  ? "rounded-b-[10px]"
                                  : segmentIndex === dashboardSegments.length - 1
                                    ? "rounded-t-[10px]"
                                    : ""
                              }
                              style={{
                                height: `${segmentHeight}%`,
                                backgroundColor: colorToGradient(segment.color),
                              }}
                            />
                          );
                        })
                      ) : (
                        <span className="h-full rounded-[10px] border border-dashed border-primary/45 bg-primary/25" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-6 gap-3 px-2">
              {dashboardSlots.map((slot) => {
                const date = slot.meeting ? formatDashboardDate(slot.meeting.data) : null;
                const isSelected = slot.meeting && slot.meetingIndex === selectedIndex;

                return (
                  <button
                    key={`${slot.key}-date`}
                    type="button"
                    disabled={!slot.meeting}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (slot.meeting) handleSelectMeeting(slot.meetingIndex);
                    }}
                    className={`flex h-10 min-w-0 flex-col items-center justify-center rounded-[11px] border px-1 text-center font-extrabold uppercase leading-none transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : slot.meeting
                          ? "border-primary/70 bg-card text-primary hover:bg-primary/10"
                          : "border-primary/25 bg-card/40 text-primary/35"
                    }`}
                  >
                    <span className="text-[11px]">{date?.day ?? "--"} DE</span>
                    <span className="mt-0.5 max-w-full truncate text-[clamp(8px,0.72vw,11px)]">{date?.month ?? "SEM DATA"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[13px] border border-primary/55 bg-muted/30 p-2">
            <div className="flex h-10 shrink-0 items-stretch justify-between gap-2 rounded-[10px] border border-primary/45 bg-card py-1 pl-3 pr-1">
              <h4 className="flex min-w-0 items-center truncate text-[clamp(11px,0.9vw,14px)] font-extrabold uppercase text-primary">Resumo da reunião</h4>
              <span className="inline-flex min-w-[3.6rem] shrink-0 items-center justify-center rounded-[9px] bg-primary px-2 text-center text-[10px] font-extrabold uppercase leading-none text-primary-foreground">
                {selectedDashboardDate ? (
                  <>
                    {selectedDashboardDate.day} DE
                    <br />
                    {selectedDashboardDate.month}
                  </>
                ) : (
                  "SEM DATA"
                )}
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3 scrollbar-none">
              {dashboardResumoItems.length > 0 ? (
                dashboardResumoItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-5 w-2.5 shrink-0 rounded-full shadow-[0_4px_10px_hsl(var(--foreground)/0.14)]"
                        style={{ backgroundColor: colorToGradient(item.color) }}
                      />
                      <span className="truncate text-sm font-bold text-foreground">{item.label}</span>
                    </div>
                    <span className="text-base font-extrabold tabular-nums text-foreground">{padStat(item.value)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">Nenhuma reunião selecionada.</p>
              )}
            </div>

            <div className="flex h-10 shrink-0 items-center justify-between rounded-[10px] bg-primary px-3 text-primary-foreground">
              <span className="text-sm font-extrabold uppercase">Total geral</span>
              <span className="text-2xl font-extrabold leading-none tabular-nums">{totalSelecionado}</span>
            </div>
          </aside>
        </div>
      </Card>
    );
  };

  return (
    <Card
      className={`flex h-full flex-col overflow-hidden bg-card text-card-foreground ${
        compactMobile
          ? "rounded-[14px] border border-primary/45 shadow-none"
          : "rounded-3xl border-border/55 shadow-[var(--shadow-card)]"
      } ${
        isLarge ? "cursor-pointer transition-shadow hover:shadow-[var(--shadow-elevated)]" : ""
      }`}
      onClick={scheduleNavigate}
      onDoubleClick={cancelScheduledNavigate}
    >
      <CardHeader
        className={
          compactMobile
            ? "mx-1.5 mt-1.5 rounded-[11px] bg-primary px-3 py-2 text-primary-foreground"
            : `${headerPadding} md:px-4`
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className={compactMobile ? "text-[13px] font-semibold leading-none" : widgetTitleClass(titleTextSize)}>Gráfico de presença</CardTitle>
          </div>
          <span className={compactMobile ? "text-[10px] font-medium text-primary-foreground/80" : "text-[11px] font-medium text-muted-foreground"}>
            Últimas {meetings.length} reuniões
          </span>
        </div>
      </CardHeader>

      <CardContent className={compactMobile ? "min-h-0 flex-1 px-2 pb-2 pt-1" : isSmall ? "min-h-0 flex-1 px-2 pb-2 pt-1" : "min-h-0 flex-1 px-3 pb-3 pt-2"}>
        {meetings.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 text-center text-sm text-muted-foreground">
            Sem reuniões recentes para exibir.
          </div>
        ) : (
          <div
            className={`grid h-full min-h-0 gap-2 ${
              compactMobile
                ? compactExpandedIndex !== null
                  ? "grid-cols-[minmax(88px,0.42fr)_minmax(0,1fr)]"
                  : "grid-cols-1"
                : isLarge
                  ? "grid-cols-[minmax(0,1.9fr)_minmax(240px,1fr)]"
                  : "grid-cols-1"
            }`}
          >
            <div className={compactMobile ? "min-h-0 rounded-[12px] border border-primary/30 bg-muted/20 p-2" : "min-h-0 rounded-2xl border border-border/50 bg-muted/15 p-2 md:p-2.5"}>
              <div className="h-full min-h-0">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    data={visibleMeetings}
                    margin={compactMobile ? { top: 8, right: 0, left: 0, bottom: 28 } : { top: 22, right: 0, left: 0, bottom: 38 }}
                    barCategoryGap={visibleMeetings.length > 5 ? "14%" : "22%"}
                    barGap={0}
                    onClick={(state: any) => {
                      const index = state?.activePayload?.[0]?.payload?.__meetingIndex;
                      if (typeof index === "number") handleSelectMeeting(index);
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 6"
                      stroke="hsl(var(--border) / 0.35)"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="data"
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={0}
                      height={compactMobile ? 42 : 44}
                      padding={{ left: 0, right: 0 }}
                      tick={<DateTick />}
                    />

                    <YAxis
                      width={0}
                      tickLine={false}
                      axisLine={false}
                      tick={false}
                      domain={[0, chartMaxTotal]}
                    />

                    {!compactMobile && (
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.28)" }}
                        labelFormatter={(label) => formatMeetingLabel(String(label))}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          boxShadow: "var(--shadow-soft)",
                        }}
                      />
                    )}

                    <Bar dataKey="Crianças" stackId="a" fill={SERIES_COLORS["Crianças"]} barSize={barSize} radius={[0, 0, 10, 10]}>
                      {visibleMeetings.map((meeting: any, index) => (
                        <Cell
                          key={`criancas-${index}`}
                          fillOpacity={compactMobile ? 1 : index === selectedIndex ? 1 : 0.46}
                          stroke={(meeting.__meetingIndex ?? index) === activeIndex ? "hsl(var(--ring))" : "transparent"}
                          strokeWidth={(meeting.__meetingIndex ?? index) === activeIndex ? 1.5 : 0}
                        />
                      ))}
                    </Bar>

                    {(["Meninas", "Meninos", "Moças", "Moços"] as const).map((faixa) => (
                      <Bar key={faixa} dataKey={faixa} stackId="a" fill={SERIES_COLORS[faixa]} barSize={barSize} radius={[0, 0, 0, 0]}>
                        {visibleMeetings.map((meeting: any, index) => (
                          <Cell key={`${faixa}-${index}`} fillOpacity={compactMobile ? 1 : (meeting.__meetingIndex ?? index) === selectedIndex ? 1 : 0.46} />
                        ))}
                      </Bar>
                    ))}

                    <Bar dataKey="visitas" stackId="a" fill={VISITAS_COLOR} barSize={barSize} radius={[10, 10, 0, 0]}>
                      {visibleMeetings.map((meeting: any, index) => (
                        <Cell key={`visitas-${index}`} fillOpacity={compactMobile ? 1 : (meeting.__meetingIndex ?? index) === selectedIndex ? 1 : 0.46} />
                      ))}
                      <LabelList content={TopLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {(!compactMobile || compactExpandedIndex !== null) && (
            <aside className={`min-h-0 overflow-hidden border bg-card text-card-foreground md:px-4 ${compactMobile ? "rounded-[12px] border-primary/40 px-2 py-2 shadow-none" : "rounded-2xl border-border/50 px-3 py-3 shadow-[var(--shadow-soft)]"}`}>
              {selectedReuniao && (
                <div className="flex h-full min-h-0 flex-col">
                  <div className={compactMobile ? "flex shrink-0 items-start justify-between gap-2" : "shrink-0 space-y-1"}>
                    <p className={compactMobile ? "text-[10px] font-semibold uppercase tracking-[0.1em] text-primary" : "text-xs font-semibold uppercase tracking-[0.12em] opacity-75"}>Resumo da reunião</p>
                    <h4 className={compactMobile ? "inline-flex max-w-[54px] shrink-0 items-center justify-center whitespace-nowrap rounded-[7px] bg-primary px-1.5 py-1 text-[clamp(9px,2.7vw,12px)] font-semibold leading-none text-primary-foreground" : "inline-flex items-center rounded-md bg-primary-foreground/15 px-2.5 py-1 text-sm font-semibold"}>
                      {formatMeetingLabel(selectedReuniao.data)}
                    </h4>
                  </div>

                  <div className={compactMobile ? "mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-none" : "mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-none"}>
                    {resumoItems.map((item) => (
                      <div key={item.key} className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={compactMobile ? "h-2 w-2 shrink-0 rounded-full shadow-[0_3px_8px_hsl(var(--foreground)/0.14)]" : "h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_3px_8px_hsl(var(--foreground)/0.14)]"}
                            style={{ backgroundColor: colorToGradient(item.color) }}
                          />
                          <span className={compactMobile ? "truncate text-[11px] font-medium opacity-90" : "truncate text-sm font-medium opacity-90"}>{item.label}</span>
                        </div>
                        <span className={compactMobile ? "shrink-0 text-xs font-bold tabular-nums" : "text-sm font-semibold tabular-nums"}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className={compactMobile ? "shrink-0 pt-1.5" : "shrink-0 pt-3"}>
                    <div className={compactMobile ? "flex items-center justify-between rounded-[8px] bg-primary px-2 py-1.5 text-primary-foreground" : "flex items-center justify-between border-t border-primary-foreground/20 pt-2"}>
                      <span className={compactMobile ? "text-[9px] font-semibold uppercase tracking-[0.1em]" : "text-xs font-semibold uppercase tracking-[0.12em] opacity-80"}>Total geral</span>
                      <span className={compactMobile ? "text-base font-bold leading-none tabular-nums" : "text-xl font-extrabold leading-none tabular-nums"}>{totalSelecionado}</span>
                    </div>
                  </div>
                </div>
              )}
            </aside>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
