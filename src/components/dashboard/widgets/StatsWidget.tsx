import { CalendarCheck, Clock3, TrendingUp, Users } from "lucide-react";
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
}: StatsWidgetProps) => {
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
      ultimaMes = data.toLocaleString("pt-BR", { month: "short" }).toUpperCase().slice(0, 3);
    }
  }

  const stats = [
    {
      icon: Users,
      label: "Membros",
      value: totalMembros,
      helper: "ativos no grupo",
      iconClass: "bg-emerald-500 text-white",
    },
    {
      icon: CalendarCheck,
      label: "Reuniões",
      value: totalReunioes,
      helper: "registradas",
      iconClass: "bg-sky-500 text-white",
    },
    {
      icon: TrendingUp,
      label: "Média",
      value: mediaPresenca,
      helper: "por reunião",
      iconClass: "bg-violet-500 text-white",
    },
    {
      icon: Clock3,
      label: "Última",
      value: ultimaDia,
      helper: ultimaMes || "sem data",
      iconClass: "bg-amber-500 text-white",
    },
  ] as const;

  return (
    <div className="grid h-full min-h-0 grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className="h-full min-h-0 overflow-hidden rounded-xl border-border/60 bg-card text-card-foreground shadow-[var(--shadow-card)]"
        >
          <CardContent className="flex h-full min-h-0 items-center gap-3 px-3 py-2">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconClass}`}>
              <stat.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold leading-none text-foreground">{stat.value}</span>
                {stat.label === "Última" && ultimaMes && (
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">{ultimaMes}</span>
                )}
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-foreground/80">{stat.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{stat.helper}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
