import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";
interface FrequencySummaryWidgetProps {
  percentualGeral: number;
  size: "sm" | "md" | "lg";
}
export const FrequencySummaryWidget = ({
  percentualGeral,
  size
}: FrequencySummaryWidgetProps) => {
  const isSmall = size === "sm";
  const isLarge = size === "lg";
  const clampedPercent = Math.max(0, Math.min(100, percentualGeral || 0));
  const valueText = isLarge ? "text-4xl" : isSmall ? "text-2xl" : "text-3xl";
  const contentPadding = isSmall ? "space-y-1.5 pt-1 pb-2 px-2" : "space-y-3 pt-2 pb-3 px-3";
  const progressHeight = isSmall ? "h-1.5" : "h-2.5";
  const headerPadding = WIDGET_HEADER_PADDING[size];
  return <Card className="bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
      <CardHeader className={headerPadding}>
        <CardTitle className={widgetTitleClass(size)}>
          Frequência geral
        </CardTitle>
      </CardHeader>
      <CardContent className={contentPadding}>
        <div className={`${valueText} font-bold text-foreground leading-tight`}>
          {clampedPercent}%
        </div>
        <Progress value={clampedPercent} className={`${progressHeight} rounded-full bg-muted overflow-hidden`} />
        {!isSmall}
      </CardContent>
    </Card>;
};