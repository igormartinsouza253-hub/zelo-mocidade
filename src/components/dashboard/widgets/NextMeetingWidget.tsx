import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { formatDateLocal } from "@/lib/date-utils";
import { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface NextMeetingWidgetProps {
  size: WidgetSize;
  ultimaReuniao: string;
}
export const NextMeetingWidget = ({
  size,
  ultimaReuniao
}: NextMeetingWidgetProps) => {
  const hasData = ultimaReuniao !== "-";
  const formattedDate = hasData ? formatDateLocal(ultimaReuniao) : "Sem dados";
  if (size === "sm") {
    return;
  }
  if (size === "md") {
    return <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-[2.5rem] overflow-hidden">
        <CardHeader className={WIDGET_HEADER_PADDING["md"]}>
          <CardTitle className={widgetTitleClass("md")}>
            Última reunião
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-center gap-1 px-3 pb-3 pt-0">
          <div className="text-2xl font-bold text-foreground leading-tight">{formattedDate}</div>
          <p className="text-[11px] text-muted-foreground">
            Resumo rápido da última reunião realizada.
          </p>
        </CardContent>
      </Card>;
  }
  return <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-[2.5rem] overflow-hidden">
      <CardHeader className={WIDGET_HEADER_PADDING["lg"]}>
        <CardTitle className={widgetTitleClass("lg")}>
          Última reunião
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between gap-4 px-3 pb-3 pt-0.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Data registrada
          </span>
          <span className="text-3xl font-bold text-foreground leading-tight">{formattedDate}</span>
          <p className="text-xs text-muted-foreground max-w-xs">
            Este card mostra a data da última reunião registrada no sistema.
          </p>
        </div>
        <div className="hidden md:flex h-full items-center justify-center pr-3">
          <div className="rounded-2xl border border-border/60 bg-accent/20 px-4 py-3 flex flex-col items-center gap-1">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-[11px] text-muted-foreground">Histórico sempre à vista</span>
          </div>
        </div>
      </CardContent>
    </Card>;
};