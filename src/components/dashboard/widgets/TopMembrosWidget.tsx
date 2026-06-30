import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { WidgetSize } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface TopMembrosWidgetProps {
  size: WidgetSize;
  top5Membros: {
    id: string;
    nome: string;
    presencas: number;
    foto_url?: string | null;
  }[];
  onToggleOrder: () => void;
  showLeastFrequent: boolean;
  period: "1m" | "3m" | "1y";
  onPeriodChange: (value: "1m" | "3m" | "1y") => void;
}

export const TopMembrosWidget = ({
  size,
  top5Membros,
  onToggleOrder,
  showLeastFrequent,
  period,
  onPeriodChange,
}: TopMembrosWidgetProps) => {
  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);
  const displayedMembros = size === "sm" ? top5Membros.slice(0, 3) : top5Membros;

  const cancelScheduledNavigate = () => {
    if (navigateTimerRef.current) {
      window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }
  };

  const navigateWithDelay = (to: string) => {
    cancelScheduledNavigate();
    navigateTimerRef.current = window.setTimeout(() => {
      navigate(to);
      navigateTimerRef.current = null;
    }, 240);
  };

  useEffect(() => {
    return () => cancelScheduledNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (size === "sm") {
    return <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
        <CardHeader className={WIDGET_HEADER_PADDING["sm"] + " flex flex-row items-center justify-between"}>
          <CardTitle className={widgetTitleClass("sm")}>
            {showLeastFrequent ? "Menos frequentes" : "Mais frequentes"}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onToggleOrder}>
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 pt-0.5 scrollbar-none">
          {top5Membros.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nenhum dado disponível</p>
          ) : (
            displayedMembros.map((membro, index) => (
              <button
                key={membro.id}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-2 py-1.5 text-[11px] transition-colors hover:bg-accent/45"
                onClick={() => navigateWithDelay(`/membros/visualizar/${membro.id}`)}
                onDoubleClick={cancelScheduledNavigate}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="relative">
                    <Avatar className="h-5 w-5 rounded-lg border border-border/50">
                      <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                      <AvatarFallback className="rounded-xl">{membro.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-primary text-[8px] font-bold text-primary-foreground flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                  <span className="truncate text-foreground" title={membro.nome}>
                    {membro.nome}
                  </span>
                </div>
                <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                  {membro.presencas}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>;
  }
  if (size === "md") {
    return <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
        <CardHeader className={WIDGET_HEADER_PADDING["md"] + " flex flex-row items-center justify-between"}>
          <CardTitle className={widgetTitleClass("md")}>
            {showLeastFrequent ? "Menos frequentes" : "Mais frequentes"}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onToggleOrder}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-0 scrollbar-none">
          <div className="h-full min-h-0 space-y-1.5 w-full overflow-y-auto pr-1 scrollbar-none">
            {top5Membros.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum dado disponível</p> : displayedMembros.map((membro, index) => <div key={membro.id} className="flex w-full cursor-pointer items-center justify-between rounded-2xl px-2.5 py-1.5 text-sm transition-colors hover:bg-accent/45" onClick={() => navigateWithDelay(`/membros/visualizar/${membro.id}`)} onDoubleClick={cancelScheduledNavigate}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <Avatar className="h-7 w-7 rounded-xl border border-border/50">
                        <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                        <AvatarFallback className="rounded-xl">{membro.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                    <span className="font-medium text-foreground truncate">{membro.nome}</span>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[26px] px-1.5 rounded-full bg-muted text-[11px] text-muted-foreground">
                    {membro.presencas}
                  </span>
                </div>)}
          </div>
        </CardContent>
      </Card>;
  }
  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
      <CardHeader className={WIDGET_HEADER_PADDING["lg"] + " flex-row flex items-center justify-between px-3"}>
        <div className="flex min-w-0 flex-col">
          <CardTitle className={widgetTitleClass("lg")}>
            {showLeastFrequent ? "Menos frequentes" : "Mais frequentes"}
          </CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as "1m" | "3m" | "1y")}
            className="h-8 rounded-lg border border-border bg-background px-2 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="1m">Último mês</option>
            <option value="3m">Últimos 3 meses</option>
            <option value="1y">Todo período</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleOrder}
            className="h-8 w-8 rounded-lg border border-border/70 text-muted-foreground hover:text-primary hover:border-primary/70"
            aria-label="Inverter ordem"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 px-3 pb-3 pt-0.5">
        <div className="h-full min-h-0 space-y-2 w-full overflow-y-auto scrollbar-none pr-1">
          {top5Membros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
          ) : (
            displayedMembros.map((membro, index) => (
              <div
                key={membro.id}
                className="flex w-full cursor-pointer items-center justify-between rounded-2xl px-2.5 py-2 transition-colors hover:bg-accent/45"
                onClick={() => navigateWithDelay(`/membros/visualizar/${membro.id}`)}
                onDoubleClick={cancelScheduledNavigate}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <Avatar className="h-8 w-8 rounded-xl border border-border/50">
                      <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                      <AvatarFallback className="rounded-xl">{membro.nome.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="text-sm font-medium text-foreground truncate"
                      title={membro.nome}
                    >
                      {membro.nome}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Presenças em reuniões</span>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {membro.presencas}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
