import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";
import { resolveHslFromCssVar } from "@/lib/resolve-color";
interface FaixaEtariaWidgetProps {
  size: WidgetSize;
  porFaixaEtaria: {
    faixa: string;
    total: number;
  }[];
  // PT-BR: permite alternar a posição da legenda sem mexer na lógica de dados.
  legendPosition?: "side" | "bottom";
}
export const FaixaEtariaWidget = ({
  size,
  porFaixaEtaria,
  legendPosition = "side",
}: FaixaEtariaWidgetProps) => {
  const FAIXA_COLORS: Record<string, string> = {
    "Crianças": resolveHslFromCssVar("--faixa-criancas", "51 100% 50%"),
    "Meninos": resolveHslFromCssVar("--faixa-meninos", "138 62% 38%"),
    "Moços": resolveHslFromCssVar("--faixa-mocos", "207 64% 47%"),
    "Meninas": resolveHslFromCssVar("--faixa-meninas", "292 100% 32%"),
    "Moças": resolveHslFromCssVar("--faixa-mocas", "335 100% 42%"),
    "Visitas": resolveHslFromCssVar("--faixa-visitas", "33 100% 45%"),
    "Recitativos individuais": resolveHslFromCssVar("--faixa-recitativos", "210 5% 44%"),
  };


  const isSmall = size === "sm";
  const isLarge = size === "lg";

  const headerPadding = WIDGET_HEADER_PADDING[size];

  const ORDER: string[] = ["Moças", "Moços", "Meninas", "Meninos", "Crianças"];
  const orderedData = ORDER.map((faixa) =>
    porFaixaEtaria.find((item) => item.faixa === faixa) || { faixa, total: 0 },
  );

  const data = orderedData.filter((d) => (d.total ?? 0) > 0);
  const hasData = data.length > 0;

  const chartHeight = isSmall ? 170 : isLarge ? 210 : 190;
  const innerRadius = isSmall ? 52 : isLarge ? 60 : 56;
  const outerRadius = isSmall ? 82 : isLarge ? 92 : 88;
  // PT-BR: no desktop do dashboard queremos gráfico acima e legenda abaixo.
  const useBottomLegend = isLarge && legendPosition === "bottom";

  return (
    <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
      <CardHeader className={headerPadding}>
        <CardTitle className={widgetTitleClass(size)}>Distribuição por faixa etária</CardTitle>
      </CardHeader>

      <CardContent className={isSmall ? "flex-1 min-h-0 pt-1 pb-2 px-3" : "flex-1 min-h-0 pt-3 pb-4 px-4"}>
        {!hasData ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Sem dados para exibir.</p>
          </div>
        ) : (
          <div className={isSmall ? "h-full flex flex-col" : "flex h-full items-center gap-4"}>
            <div className={isSmall ? "flex-1 min-h-0 flex items-center justify-center" : "flex-1 min-w-0 flex items-center"}>
              <ResponsiveContainer width="100%" height={chartHeight}>
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
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FAIXA_COLORS[entry.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%")}
                        stroke="hsl(var(--background))"
                        strokeWidth={5}
                        strokeLinejoin="round"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
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

            {/* Legenda (mobile: abaixo; demais: lateral) */}
            <div
              className={
                isSmall
                  ? "mt-2 grid grid-cols-2 gap-2"
                  : "flex flex-col gap-1.5 text-xs min-w-[140px]"
              }
            >
              {data.map((item) => (
                <div
                  key={item.faixa}
                  className={
                    isSmall
                      ? "rounded-2xl border border-border/40 bg-muted/20 px-2.5 py-2 flex items-center justify-between gap-2"
                      : "flex items-center justify-between gap-2 rounded-full px-2 py-1"
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          FAIXA_COLORS[item.faixa] || resolveHslFromCssVar("--primary", "158 64% 52%"),
                      }}
                    />
                    <span className="truncate text-foreground font-medium text-[11px]">{item.faixa}</span>
                  </div>
                  <span className="text-foreground font-semibold tabular-nums text-[11px]">{item.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};