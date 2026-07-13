import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BarChart3, CheckCircle2, Percent } from "lucide-react";

interface MemberFrequencyCardProps {
  presencas: number;
  totalReunioes: number;
  taxaGeralPorcentagem: number;
  taxaMensalPorcentagem: number;
  ultimasPresencas: string[];
  alertaAusencias: boolean;
  formatarData: (data: string) => string;
  className?: string;
}

export function MemberFrequencyCard({
  presencas,
  totalReunioes,
  taxaGeralPorcentagem,
  taxaMensalPorcentagem,
  ultimasPresencas,
  alertaAusencias,
  formatarData,
  className = "",
}: MemberFrequencyCardProps) {
  const frequente = !alertaAusencias && taxaMensalPorcentagem >= 60;

  return (
    <Card className={`member-frequency-card overflow-hidden rounded-3xl shadow-[var(--shadow-card)] ${alertaAusencias ? "border-destructive/55 bg-destructive/10" : "border-border/55 bg-card/90"} ${className}`}>
      <CardHeader className="member-frequency-header px-4 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Frequência</CardTitle>
          <Badge variant="outline" className={`rounded-full ${frequente ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/25 bg-destructive/10 text-destructive"}`}>
            {frequente ? "Frequente" : "Atenção"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="member-frequency-content flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
        {alertaAusencias && (
          <div className="member-frequency-alert flex gap-3 rounded-2xl border border-destructive/45 bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-semibold">Mais de três ausências consecutivas. Considere realizar um acompanhamento.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <FrequencyMetric icon={CheckCircle2} value={presencas} label="Presenças" />
          <FrequencyMetric icon={BarChart3} value={totalReunioes} label="Reuniões" />
          <FrequencyMetric icon={Percent} value={`${taxaGeralPorcentagem}%`} label="Geral" />
          <FrequencyMetric icon={Percent} value={`${taxaMensalPorcentagem}%`} label="30 dias" />
        </div>

        <div className="member-frequency-latest rounded-2xl border border-border/55 bg-background/55 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Últimas presenças</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ultimasPresencas.length ? (
              ultimasPresencas.map((data) => (
                <Badge key={data} variant="outline" className="rounded-full border-border/60 bg-background/70">
                  {formatarData(data)}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhuma presença registrada</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FrequencyMetric({ icon: Icon, value, label }: { icon: typeof Percent; value: string | number; label: string }) {
  return (
    <div className="member-frequency-metric rounded-2xl border border-border/55 bg-background/55 p-3">
      <Icon className="mb-2 h-4 w-4 text-primary" />
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
