import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";
import { resolveHslFromCssVar } from "@/lib/resolve-color";

interface FaixaEtariaWidgetProps {
  size: WidgetSize;
  compactMobile?: boolean;
  porFaixaEtaria: {
    faixa: string;
    total: number;
  }[];
  legendPosition?: "side" | "bottom";
}

export const FaixaEtariaWidget = ({
  size,
  compactMobile = false,
  porFaixaEtaria,
  legendPosition = "side",
}: FaixaEtariaWidgetProps) => {
  const FAIXA_COLORS: Record<string, string> = {
    Crianças: resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    Meninos: resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    Moços: resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    Meninas: resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    Moças: resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    Visitas: resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
    "Recitativos individuais": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };

  const isSmall = size === "sm";
  const isLarge = size === "lg";
  const useBottomLegend = legendPosition === "bottom";
  const order = ["Moças", "Moços", "Meninas", "Meninos", "Crianças"];
  const data = order
    .map((faixa) => porFaixaEtaria.find((item) => item.faixa === faixa) || { faixa, total: 0 })
    .filter((item) => (item.total ?? 0) > 0);
  const totalGeral = data.reduce((sum, item) => sum + item.total, 0);
  const maiorFaixa = data.reduce((current, item) => (item.total > current.total ? item : current), data[0]);
  const menorFaixa = data.reduce((current, item) => (item.total < current.total ? item : current), data[0]);

  const innerRadius = compactMobile ? "52%" : isSmall ? "48%" : isLarge ? "52%" : "50%";
  const outerRadius = compactMobile ? "72%" : isSmall ? "70%" : isLarge ? "70%" : "72%";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/40 bg-card text-card-foreground shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className={WIDGET_HEADER_PADDING[size]}>
        <CardTitle className={widgetTitleClass(size)}>Distribuição por faixa etária</CardTitle>
      </CardHeader>

      <CardContent className={compactMobile ? "flex min-h-0 flex-1 flex-col px-3 pb-2 pt-0" : "flex min-h-0 flex-1 flex-col px-4 pb-3 pt-1"}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 text-sm text-muted-foreground">
            Sem dados para exibir.
          </div>
        ) : (
          <div className={compactMobile ? "flex h-full min-h-0 flex-col gap-2" : useBottomLegend ? "flex h-full min-h-0 flex-col gap-2" : "grid h-full min-h-0 grid-cols-[minmax(220px,0.78fr)_minmax(300px,1fr)] items-center gap-4"}>
            <div
              className={
                compactMobile
                  ? "mx-auto min-h-0 w-full max-w-[230px] flex-[1.05]"
                  : useBottomLegend
                    ? "mx-auto min-h-0 w-full max-w-[280px] flex-[1.05]"
                  : "flex min-h-0 items-center justify-center self-stretch"
              }
            >
              <div className={compactMobile ? "h-full max-h-[150px] w-full max-w-[230px]" : "h-full max-h-[230px] w-full max-w-[310px]"}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="faixa"
                    cx="50%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={4}
                    minAngle={3}
                    labelLine={false}
                    cornerRadius={10}
                  >
                    <Label
                      position="center"
                      content={({ viewBox }) => {
                        if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} dy="-0.2em" className="fill-foreground text-2xl font-bold">
                              {totalGeral}
                            </tspan>
                            <tspan x={viewBox.cx} dy="1.5em" className="fill-muted-foreground text-[10px] font-medium">
                              pessoas
                            </tspan>
                          </text>
                        );
                      }}
                    />
                    {data.map((entry) => (
                      <Cell
                        key={entry.faixa}
                        fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                        stroke={compactMobile ? "hsl(var(--card))" : "hsl(var(--background))"}
                        strokeLinejoin="round"
                        strokeWidth={compactMobile ? 3 : 5}
                      />
                    ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                      formatter={(value: any, name: any) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className={
                compactMobile
                  ? "grid min-h-0 grid-cols-2 gap-1.5 overflow-y-auto pr-1 scrollbar-none"
                  : useBottomLegend
                    ? "grid min-h-0 grid-cols-2 gap-1.5 overflow-y-auto pr-1 scrollbar-none"
                  : "grid max-h-full min-w-0 grid-cols-2 gap-2 overflow-y-auto pr-1 text-xs scrollbar-none"
              }
            >
              {!useBottomLegend && !compactMobile && (
                <div className="col-span-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Resumo</p>
                  <div className="mt-1.5 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Maior grupo</span>
                      <span className="font-semibold text-foreground">{maiorFaixa.faixa}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Menor grupo</span>
                      <span className="font-semibold text-foreground">{menorFaixa.faixa}</span>
                    </div>
                  </div>
                </div>
              )}
              {data.map((item) => (
                <div
                  key={item.faixa}
                  className={compactMobile ? "flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5" : "flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5"}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: FAIXA_COLORS[item.faixa] || "hsl(var(--primary))" }}
                    />
                    <span className="truncate text-[10px] font-medium text-foreground">{item.faixa}</span>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums text-foreground">{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
