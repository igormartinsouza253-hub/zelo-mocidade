import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface FrequencySummaryWidgetProps {
  percentualGeral: number;
  size: "sm" | "md" | "lg";
}

export const FrequencySummaryWidget = ({
  percentualGeral,
  size,
}: FrequencySummaryWidgetProps) => {
  const clampedPercent = Math.max(0, Math.min(100, percentualGeral || 0));
  const status =
    clampedPercent >= 75 ? "Boa frequência" : clampedPercent >= 55 ? "Atenção moderada" : "Precisa de cuidado";
  const statusClass =
    clampedPercent >= 75
      ? "bg-primary/15 text-primary"
      : clampedPercent >= 55
        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-destructive/10 text-destructive";

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/40 bg-card text-card-foreground shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className={WIDGET_HEADER_PADDING[size]}>
        <CardTitle className={widgetTitleClass(size)}>Frequência geral</CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-4 pb-4 pt-0">
        <div className="flex items-end justify-between gap-3">
          <span className="text-3xl font-bold leading-none text-foreground">{clampedPercent}%</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
            {status}
          </span>
        </div>

        <Progress value={clampedPercent} className="h-3 rounded-full bg-muted" />

        <p className="text-xs text-muted-foreground">
          Percentual médio de presença dos membros ativos nas reuniões registradas.
        </p>
      </CardContent>
    </Card>
  );
};
