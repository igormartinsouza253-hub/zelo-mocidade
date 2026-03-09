import { useEffect, useRef, useState } from "react";
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

  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);

  const isSmall = size === "sm";
  const isLarge = size === "lg";
  const height = isLarge ? 260 : size === "md" ? 230 : 200;

  const headerPadding = WIDGET_HEADER_PADDING[size];
  const titleTextSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "md";

  const [selectedIndex, setSelectedIndex] = useState(
    reunioesRecentes && reunioesRecentes.length > 0
      ? reunioesRecentes.length - 1
      : 0,
  );

  // No mobile/tablet, clicar em uma coluna foca a reunião e mostra o resumo.
  // Quando há foco, as demais colunas somem.
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (reunioesRecentes && reunioesRecentes.length > 0) {
      setSelectedIndex(reunioesRecentes.length - 1);
    }
    setFocusedIndex(null);

    return () => {
      if (navigateTimerRef.current) {
        window.clearTimeout(navigateTimerRef.current);
        navigateTimerRef.current = null;
      }
    };
  }, [reunioesRecentes]);

  const selectedReuniao =
    reunioesRecentes && reunioesRecentes.length > 0
      ? reunioesRecentes[Math.min(selectedIndex, reunioesRecentes.length - 1)]
      : null;

  const focusedReuniao =
    focusedIndex !== null && reunioesRecentes && reunioesRecentes.length > 0
      ? reunioesRecentes[Math.min(focusedIndex, reunioesRecentes.length - 1)]
      : null;

  const reuniaoParaResumo = isLarge ? selectedReuniao : focusedReuniao ?? selectedReuniao;

  const resumoItems = reuniaoParaResumo
    ? [
        {
          key: "visitas" as const,
          label: "Visitas",
          color: resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
          value: reuniaoParaResumo.visitas ?? 0,
        },
        {
          key: "Crianças" as const,
          label: "Crianças",
          color: SERIES_COLORS["Crianças"],
          value: reuniaoParaResumo.Crianças ?? 0,
        },
        {
          key: "Meninas" as const,
          label: "Meninas",
          color: SERIES_COLORS["Meninas"],
          value: reuniaoParaResumo.Meninas ?? 0,
        },
        {
          key: "Meninos" as const,
          label: "Meninos",
          color: SERIES_COLORS["Meninos"],
          value: reuniaoParaResumo.Meninos ?? 0,
        },
        {
          key: "Moças" as const,
          label: "Moças",
          color: SERIES_COLORS["Moças"],
          value: reuniaoParaResumo.Moças ?? 0,
        },
        {
          key: "Moços" as const,
          label: "Moços",
          color: SERIES_COLORS["Moços"],
          value: reuniaoParaResumo.Moços ?? 0,
        },
      ].filter((item) => item.value && item.value > 0)
    : [];

  const totalSelecionado = selectedReuniao?.total ?? 0;

  const scheduleNavigate = () => {
    // No mobile, o card é interativo para foco/Resumo — não deve navegar ao tocar.
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

  const dataForChart = reunioesRecentes;

  const formatMeetingLabel = (raw: string) => {
    // Aceita ISO (YYYY-MM-DD), "DD/MM" ou qualquer string curta já formatada.
    try {
      if (!raw) return "";
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        const d = parseISO(raw);
        return isValid(d) ? format(d, "dd-MM") : raw;
      }
      // Se já veio em DD/MM ou DD-MM, só normaliza para DD-MM
      if (/^\d{2}[/-]\d{2}/.test(raw)) return raw.replace("/", "-").slice(0, 5);
      return raw;
    } catch {
      return raw;
    }
  };

  const maxTotal = Math.max(
    1,
    ...(reunioesRecentes || []).map((r) => (typeof r.total === "number" ? r.total : 0)),
  );

  const recitativosIndividuaisSelecionado = reuniaoParaResumo?.recitativos_individuais ?? 0;
  const totalPresencaSelecionado = reuniaoParaResumo?.total ?? 0;
  const totalRecitativosSelecionado = recitativosIndividuaisSelecionado + totalPresencaSelecionado;

  const barSize = focusedReuniao ? 44 : 18;

  const TopLabel = (props: any) => {
    const { x, y, width, payload } = props;
    if (!payload) return null;
    const ri = payload.recitativos_individuais ?? 0;
    const total = payload.total ?? 0;
    const tr = ri + total;

    const cx = (x ?? 0) + (width ?? 0) / 2;
    const cy = (y ?? 0) - 2;

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

  return (
    <Card
      className={`h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden ${
        isLarge ? "cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow" : ""
      }`}
      onClick={scheduleNavigate}
      onDoubleClick={cancelScheduledNavigate}
    >
      <CardHeader className={`${headerPadding} md:px-4`}>
        <CardTitle className={widgetTitleClass(titleTextSize)}>
          Gráfico de presença
        </CardTitle>
      </CardHeader>

      <CardContent
        className={
          isSmall
            ? "flex-1 min-h-0 px-2 pt-1 pb-2"
            : "flex-1 min-h-0 px-3 pt-2 pb-3"
        }
      >
        {isLarge ? (
          <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(240px,0.95fr)]">
            <div className="flex-[3.5] min-w-0 flex flex-col">
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex-1 flex items-center">
                  <ResponsiveContainer width="100%" height={height}>
                    <BarChart
                      data={reunioesRecentes}
                      margin={{
                        left: 0,
                        right: 0,
                        top: 8,
                        bottom: 0,
                      }}
                      barCategoryGap="25%"
                      barGap={0}
                    >
                      <CartesianGrid
                        strokeDasharray="2 6"
                        stroke="hsl(var(--border) / 0.35)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="data"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tick={false}
                      />
                      <YAxis
                        stroke="transparent"
                        tickLine={false}
                        axisLine={false}
                        tick={false}
                        domain={[0, Math.max(1, maxTotal)]}
                      />
                      <Tooltip
                        cursor={{
                          fill: "hsl(var(--muted) / 0.25)",
                        }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          boxShadow: "var(--shadow-soft)",
                        }}
                      />

                      {Object.keys(SERIES_COLORS).map((faixa) => (
                        <Bar
                          key={faixa}
                          dataKey={faixa}
                          stackId="a"
                          fill={SERIES_COLORS[faixa]}
                          barSize={barSize}
                          radius={[0, 0, 0, 0]}
                        />
                      ))}
                      <Bar
                        dataKey="visitas"
                        stackId="a"
                         fill={resolveHslFromCssVar("--faixa-visitas", "33 100% 45%")}
                        barSize={barSize}
                        radius={[999, 999, 0, 0]}
                      >
                        <LabelList content={TopLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {reunioesRecentes && reunioesRecentes.length > 0 && (
                  <div className="relative mt-3 h-7">
                    {reunioesRecentes.map((reuniao, index) => {
                      const total = reunioesRecentes.length || 1;
                      const left = ((index + 0.5) / total) * 100;

                      return (
                        <button
                          key={reuniao.data + index}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIndex(index);
                          }}
                          style={{
                            left: `${left}%`,
                            transform: "translateX(-50%)",
                          }}
                          className={`absolute bottom-0 min-w-[52px] rounded-full border px-3 py-0.5 text-[11px] leading-none text-center truncate transition-colors ${
                            index === selectedIndex
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border/60 hover:bg-muted"
                          }`}
                        >
                          {reuniao.data}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

             {selectedReuniao && (
               <div className="flex-[2.5] max-w-[240px] self-end rounded-[2rem] flex flex-col justify-between px-3 py-3 min-h-[200px] bg-[hsl(var(--info-card-bg))] text-[hsl(var(--info-card-foreground))] border border-border/40">
                 <div>
                  <p className="inline-flex items-baseline gap-2 mt-1 text-left">
                    <span className="inline-flex items-center rounded-full bg-primary-foreground/15 px-3 py-0.5 text-xs md:text-sm font-semibold uppercase tracking-[0.16em]">
                      Reunião {selectedReuniao.data}
                    </span>
                  </p>
                </div>

                <div className="mt-3 flex-1 flex flex-col gap-1.5 text-[11px]">
                  {resumoItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: item.color,
                          }}
                        />
                        <span className="opacity-90 font-semibold text-sm">
                          {item.label}
                        </span>
                      </div>
                      <span className="font-semibold text-base">{item.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-2 border-t border-primary-foreground/20 flex items-center justify-between text-xs font-semibold">
                  <span className="uppercase tracking-[0.12em] opacity-80 text-base font-bold">
                    Total
                  </span>
                  <span className="text-lg font-extrabold">{totalSelecionado}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full min-h-0 flex items-stretch gap-2">
            {/* Área do gráfico */}
            <div className="flex-1 min-w-0 h-full min-h-0 flex flex-col">
              {/* Painel do gráfico: ocupa 100% da área útil */}
              <div className="flex-1 min-h-0 rounded-3xl border border-border/40 bg-muted/20 p-2">
                <div className="h-full w-full min-h-0">
                  <ResponsiveContainer
                    key={focusedIndex === null ? "all" : `focused-${focusedIndex}`}
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={dataForChart}
                      margin={{ left: 0, right: 0, top: 10, bottom: 12 }}
                      barCategoryGap="24%"
                      barGap={0}
                      onClick={(state: any) => {
                        // Clique fora das barras: se estiver focado, desfoca
                        if (!state?.activePayload?.length) {
                          setFocusedIndex(null);
                        }
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="2 6"
                        stroke="hsl(var(--border) / 0.35)"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="data"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        tickMargin={10}
                        tickFormatter={formatMeetingLabel}
                      />
                      <YAxis
                        stroke="transparent"
                        tickLine={false}
                        axisLine={false}
                        tick={false}
                        domain={[0, Math.max(1, maxTotal)]}
                      />

                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted) / 0.25)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          boxShadow: "var(--shadow-soft)",
                        }}
                        labelFormatter={(label) => formatMeetingLabel(String(label))}
                      />

                      {Object.keys(SERIES_COLORS).map((faixa) => (
                        <Bar
                          key={faixa}
                          dataKey={faixa}
                          stackId="a"
                          fill={SERIES_COLORS[faixa]}
                          barSize={28}
                          radius={[0, 0, 0, 0]}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                          onClick={(_data: any, index: number, e: any) => {
                            e?.stopPropagation?.();
                            const baseIndex = index;
                            setFocusedIndex((prev) => (prev === baseIndex ? null : baseIndex));
                          }}
                        >
                          {(dataForChart || []).map((_, i) => (
                            <Cell
                              key={`cell-${faixa}-${i}`}
                              fillOpacity={
                                focusedIndex !== null && i !== focusedIndex ? 0.16 : 1
                              }
                            />
                          ))}
                        </Bar>
                      ))}
                      <Bar
                        dataKey="visitas"
                        stackId="a"
                        fill={resolveHslFromCssVar("--faixa-visitas", "33 100% 45%")}
                        barSize={28}
                        radius={[12, 12, 0, 0]}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        onClick={(_data: any, index: number, e: any) => {
                          e?.stopPropagation?.();
                          const baseIndex = index;
                          setFocusedIndex((prev) => (prev === baseIndex ? null : baseIndex));
                        }}
                      >
                        {(dataForChart || []).map((_, i) => (
                          <Cell
                            key={`cell-visitas-${i}`}
                            fillOpacity={focusedIndex !== null && i !== focusedIndex ? 0.16 : 1}
                          />
                        ))}
                        <LabelList content={TopLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {focusedReuniao && (
                <button
                  type="button"
                  className="mt-2 w-full rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocusedIndex(null);
                  }}
                >
                  Ver todas as reuniões
                </button>
              )}
            </div>

            {/* Área de detalhes: ocupa exatamente o espaço liberado */}
            <div
              className={
                focusedReuniao
                  ? "flex-1 min-w-0 h-full rounded-2xl border border-border/40 bg-[hsl(var(--info-card-bg))] text-[hsl(var(--info-card-foreground))] px-3 py-3 animate-enter"
                  : "hidden"
              }
            >
              {focusedReuniao && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
                      Reunião
                    </span>
                    <span className="text-xs font-semibold">
                      {formatMeetingLabel(focusedReuniao.data)}
                    </span>
                  </div>

                  <div className="mt-2 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 px-2 py-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                      <span className="opacity-85">Recitativos ind.</span>
                      <span className="text-sm font-extrabold tabular-nums">
                        {recitativosIndividuaisSelecionado}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold">
                      <span className="opacity-85">Total recitativos</span>
                      <span className="text-sm font-extrabold tabular-nums">
                        {totalRecitativosSelecionado}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-col gap-1.5">
                    {resumoItems.length > 0 ? (
                      resumoItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="truncate text-[11px] font-semibold opacity-90">
                              {item.label}
                            </span>
                          </div>
                          <span className="text-sm font-bold">{item.value}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] opacity-80">Sem dados para esta reunião.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
