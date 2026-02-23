import { Calendar, Clock, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type MobileStatsGridProps = {
  totalMembros: number;
  totalReunioes: number;
  mediaPresenca: number;
  ultimaReuniao: string;
};

function formatUltimaReuniao(ultimaReuniao: string) {
  if (!ultimaReuniao || ultimaReuniao === "-") {
    return { day: "-", month: "" };
  }

  const [anoStr, mesStr, diaStr] = ultimaReuniao.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);
  if (Number.isNaN(ano) || Number.isNaN(mes) || Number.isNaN(dia)) {
    return { day: "-", month: "" };
  }

  const data = new Date(ano, mes - 1, dia);
  const day = String(data.getDate()).padStart(2, "0");
  const month = data
    .toLocaleString("pt-BR", { month: "short" })
    .toUpperCase()
    .slice(0, 3);

  return { day, month };
}

export function MobileStatsGrid({
  totalMembros,
  totalReunioes,
  mediaPresenca,
  ultimaReuniao,
}: MobileStatsGridProps) {
  const ultima = formatUltimaReuniao(ultimaReuniao);

  const items = [
    {
      icon: Users,
      label: "Membros",
      value: totalMembros,
    },
    {
      icon: Calendar,
      label: "Reuniões",
      value: totalReunioes,
    },
    {
      icon: TrendingUp,
      label: "Média",
      value: mediaPresenca,
    },
    {
      icon: Clock,
      label: "Última",
      value: ultima.day,
      month: ultima.month,
    },
  ] as const;

  return (
    <section aria-label="Estatísticas" className="w-full">
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <Card
            key={item.label}
            className="bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] md:rounded-[2.5rem] overflow-hidden"
          >
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="h-9 w-9 shrink-0 rounded-2xl bg-muted flex items-center justify-center">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>

              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <div className="text-xl font-bold leading-none text-foreground">
                    {item.value}
                  </div>
                  {item.label === "Última" && "month" in item && item.month && item.value !== "-" && (
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {item.month}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  {item.label}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
