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

  const GROUP_KEYS = ["visitas", "Crianças", "Meninas", "Meninos", "Moças", "Moços"] as const;

  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);

  const isSmall = size === "sm";
  const isLarge = size === "lg";

  const headerPadding = WIDGET_HEADER_PADDING[size];
  const titleTextSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

  const meetings = useMemo(() => reunioesRecentes.slice(-5), [reunioesRecentes]);

  const [selectedIndex, setSelectedIndex] = useState(
    meetings.length > 0 ? meetings.length - 1 : 0,
  );

  useEffect(() => {
    setSelectedIndex(meetings.length > 0 ? meetings.length - 1 : 0);

    return () => {
      if (navigateTimerRef.current) {
        window.clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = null;
      }
    };
  }, [meetings]);

  const selectedReuniao = meetings.length > 0 ? meetings[Math.min(selectedIndex, meetings.length - 1)] : null;

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

  const barSize = isLarge ? 36 : size === "md" ? 28 : 22;
  const chartHeight = isLarge ? 300 : size === "md" ? 260 : 220;

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

    const isSelected = tickIndex === selectedIndex;
    const tickWidth = isSmall ? 52 : 68;
    const tickX = -(tickWidth / 2);

    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={tickX} y={4} width={tickWidth} height={30}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedIndex(tickIndex);
            }}
            className={`mx-auto block h-7 rounded-md border text-[10px] font-semibold leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
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

  return (
    <Card
      className={`h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col overflow-hidden ${
        isLarge ? "cursor-pointer transition-shadow hover:shadow-[var(--shadow-elevated)]" : ""
      }`}
      onClick={scheduleNavigate}
      onDoubleClick={cancelScheduledNavigate}
    >
      <CardHeader className={`${headerPadding} md:px-4`}>
        <CardTitle className={widgetTitleClass(titleTextSize)}>Gráfico de presença</CardTitle>
      </CardHeader>

      <CardContent className={isSmall ? "flex-1 px-2 pb-2 pt-1" : "flex-1 px-3 pb-3 pt-2"}>
        {meetings.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 text-center text-sm text-muted-foreground">
            Sem reuniões recentes para exibir.
          </div>
        ) : (
          <div
            className={`grid h-full min-h-0 gap-3 ${
              isLarge ? "grid-cols-[minmax(0,1.9fr)_minmax(240px,1fr)]" : "grid-cols-1"
            }`}
          >
            <div className="min-h-0 rounded-xl border border-border/50 bg-muted/15 p-2.5 md:p-3">
              <div className="h-full min-h-[220px] md:min-h-[260px]">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <BarChart
                    data={meetings}
                    margin={{ top: 22, right: 12, left: 12, bottom: 38 }}
                    barCategoryGap="22%"
                    barGap={0}
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
                      height={36}
                      tick={<DateTick />}
                    />

                    <YAxis
                      stroke="transparent"
                      tickLine={false}
                      axisLine={false}
                      tick={false}
                      domain={[0, Math.max(1, maxTotal)]}
                    />

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

                    <Bar dataKey="Crianças" stackId="a" fill={SERIES_COLORS["Crianças"]} barSize={barSize} radius={[0, 0, 10, 10]}>
                      {meetings.map((_, index) => (
                        <Cell
                          key={`criancas-${index}`}
                          fillOpacity={index === selectedIndex ? 1 : 0.46}
                          stroke={index === selectedIndex ? "hsl(var(--ring))" : "transparent"}
                          strokeWidth={index === selectedIndex ? 1.5 : 0}
                        />
                      ))}
                    </Bar>

                    {(["Meninas", "Meninos", "Moças", "Moços"] as const).map((faixa) => (
                      <Bar key={faixa} dataKey={faixa} stackId="a" fill={SERIES_COLORS[faixa]} barSize={barSize} radius={[0, 0, 0, 0]}>
                        {meetings.map((_, index) => (
                          <Cell key={`${faixa}-${index}`} fillOpacity={index === selectedIndex ? 1 : 0.46} />
                        ))}
                      </Bar>
                    ))}

                    <Bar dataKey="visitas" stackId="a" fill={VISITAS_COLOR} barSize={barSize} radius={[10, 10, 0, 0]}>
                      {meetings.map((_, index) => (
                        <Cell key={`visitas-${index}`} fillOpacity={index === selectedIndex ? 1 : 0.46} />
                      ))}
                      <LabelList content={TopLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <aside className="min-h-0 rounded-xl border border-border/50 bg-[hsl(var(--info-card-bg))] px-3 py-3 text-[hsl(var(--info-card-foreground))] shadow-[var(--shadow-soft)] md:px-4 md:py-4">
              {selectedReuniao && (
                <div className="flex h-full flex-col">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">Resumo da reunião</p>
                    <h4 className="inline-flex items-center rounded-md bg-primary-foreground/15 px-2.5 py-1 text-sm font-semibold">
                      {formatMeetingLabel(selectedReuniao.data)}
                    </h4>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {resumoItems.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-sm font-medium opacity-90">{item.label}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="flex items-center justify-between border-t border-primary-foreground/20 pt-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">Total geral</span>
                      <span className="text-2xl font-extrabold leading-none tabular-nums">{totalSelecionado}</span>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
