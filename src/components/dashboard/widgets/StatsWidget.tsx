import { Users, Calendar, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { WidgetSize } from "../types";

interface StatsWidgetProps {
  totalMembros: number;
  totalReunioes: number;
  mediaPresenca: number;
  ultimaReuniao: string;
  size: WidgetSize;
}

export const StatsWidget = ({
  totalMembros,
  totalReunioes,
  mediaPresenca,
  ultimaReuniao,
  size,
}: StatsWidgetProps) => {
  const isSmall = size === "sm";
  const isLarge = size === "lg";

  let ultimaDia = "-";
  let ultimaMes = "";

  if (ultimaReuniao !== "-") {
    const [anoStr, mesStr, diaStr] = ultimaReuniao.split("-");
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const dia = Number(diaStr);

    if (!Number.isNaN(ano) && !Number.isNaN(mes) && !Number.isNaN(dia)) {
      const data = new Date(ano, mes - 1, dia);
      ultimaDia = String(data.getDate()).padStart(2, "0");
      ultimaMes = data
        .toLocaleString("pt-BR", { month: "short" })
        .toUpperCase()
        .slice(0, 3);
    }
  }

  const stats = [
    { icon: Users, label: "Membros", value: totalMembros, color: "hsl(var(--primary))" },
    { icon: Calendar, label: "Reuniões", value: totalReunioes, color: "hsl(var(--chart-2))" },
    { icon: TrendingUp, label: "Média", value: mediaPresenca, color: "hsl(var(--chart-3))" },
    {
      icon: Clock,
      label: "Última",
      value: ultimaDia,
      month: ultimaMes,
      color: "hsl(var(--chart-4))",
    },
  ] as const;

  const displayedStats = isSmall ? stats.slice(0, 2) : stats;

  return (
    <div
      className={`grid ${
        isSmall ? "grid-cols-2 gap-2" : isLarge ? "grid-cols-4 gap-4" : "grid-cols-2 gap-3"
      }`}
    >
      {displayedStats.map((stat, index) => (
        <Card
          key={index}
          className="bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow md:rounded-xl overflow-hidden"
        >
          <CardContent
            className={`${
              isSmall ? "p-2.5" : isLarge ? "p-4" : "p-3"
            } flex flex-col items-center justify-center gap-1.5`}
          >
            <div className="flex items-center justify-center mb-1">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                 <stat.icon
                   className={isSmall ? "h-3.5 w-3.5" : isLarge ? "h-5 w-5" : "h-4 w-4"}
                 />
              </div>
            </div>
            <div
              className={`${
                isSmall
                  ? "text-lg"
                  : isLarge
                    ? "text-2xl md:text-[24px] lg:text-[28px] xl:text-[30px] 2xl:text-[32px]"
                    : "text-2xl"
              } font-bold text-foreground leading-tight`}
            >
              {stat.value}
            </div>
            {stat.label === "Última" && "month" in stat && stat.month && stat.value !== "-" && (
              <div
                className={`${
                  isSmall ? "text-[10px]" : "text-xs"
                } font-semibold uppercase text-muted-foreground tracking-[0.16em]`}
              >
                {stat.month}
              </div>
            )}
            <div
              className={`${
                isSmall ? "text-[10px]" : "text-xs"
              } text-muted-foreground text-center`}
            >
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
