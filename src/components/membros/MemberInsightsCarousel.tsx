import { useMemo } from "react";
import { Award, Brain, CalendarCheck2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MemberInsightsCarouselProps {
  nome: string;
  presencas: number;
  taxaMensal: number;
  tendenciaMensal: { label: string; taxa: number }[];
  sequenciaRecente: { data: string; presente: boolean }[];
  maiorSequencia: number;
  primeiraPresenca: string | null;
  alertaAusencias: boolean;
  formatarData: (data: string) => string;
  className?: string;
}

export function MemberInsightsCarousel(props: MemberInsightsCarouselProps) {
  const resumo = useMemo(() => buildSummary(props), [props]);
  const taxasComDados = props.tendenciaMensal.filter((item) => item.taxa > 0);
  const anterior = taxasComDados.at(-2)?.taxa ?? 0;
  const atual = taxasComDados.at(-1)?.taxa ?? props.taxaMensal;
  const variacao = atual - anterior;
  const primeiroNome = props.nome.trim().split(/\s+/)[0] || "O membro";

  return (
    <Card className={`member-insights-card min-h-40 overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] ${props.className ?? ""}`}>
      <CardHeader className="px-4 pb-2 pt-4 md:px-5 md:pt-5">
        <CardTitle className="text-base">Insights do membro</CardTitle>
      </CardHeader>
      <CardContent className="member-insights-content flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:px-4 md:pb-4">
        <InsightSection
          title="Resumo inteligente"
          icon={Brain}
          className={props.alertaAusencias ? "border-destructive/30 bg-destructive/10" : "border-primary/20 bg-primary/10"}
        >
          <p className="text-sm font-semibold leading-relaxed text-foreground">{resumo}</p>
        </InsightSection>

        <InsightSection title="Tendência dos últimos meses" icon={variacao >= 0 ? TrendingUp : TrendingDown} className="member-insight-trend">
          <div className="member-insights-chart flex min-h-0 flex-1 items-end gap-2">
            {props.tendenciaMensal.map((item) => (
              <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-foreground">{item.taxa}%</span>
                <div className="flex h-full min-h-[3.25rem] w-full items-end overflow-hidden rounded-md bg-primary/10">
                  <div className="w-full rounded-md bg-primary" style={{ height: `${Math.max(item.taxa, 4)}%` }} />
                </div>
                <span className="text-[10px] capitalize text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
          <p className={`mt-2 text-xs font-medium ${variacao < 0 ? "text-destructive" : "text-primary"}`}>
            {variacao === 0 ? "Frequência estável no período." : `${variacao > 0 ? "+" : ""}${variacao} pontos em relação ao mês anterior.`}
          </p>
        </InsightSection>

        <InsightSection title="Sequência das últimas reuniões" icon={CalendarCheck2}>
          <div className="grid grid-cols-4 gap-2">
            {props.sequenciaRecente.slice(0, 8).map((item) => (
              <div key={item.data} className={`min-w-0 rounded-xl border px-2 py-2 text-center ${item.presente ? "border-primary/25 bg-primary/10" : "border-border/60 bg-muted/35"}`}>
                <span className={`mx-auto block h-2.5 w-2.5 rounded-full ${item.presente ? "bg-primary" : "bg-muted-foreground/35"}`} />
                <p className="mt-1 text-[10px] font-medium text-foreground">{props.formatarData(item.data)}</p>
              </div>
            ))}
          </div>
          {!props.sequenciaRecente.length && <p className="text-sm text-muted-foreground">Ainda não há reuniões registradas.</p>}
        </InsightSection>

        <InsightSection title="Marcos e recordes" icon={Award}>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <Metric value={props.presencas} label="Presenças" />
            <Metric value={props.maiorSequencia} label="Maior sequência" />
            <Metric value={props.primeiraPresenca ? props.formatarData(props.primeiraPresenca) : "—"} label="Primeira presença" compact />
          </div>
          <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">
            {props.presencas
              ? `${primeiroNome} está a ${(10 - (props.presencas % 10)) || 10} presenças do próximo marco de dezena.`
              : "O primeiro marco será registrado na próxima presença."}
          </p>
        </InsightSection>
      </CardContent>
    </Card>
  );
}

function InsightSection({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title: string;
  icon: typeof TrendingUp;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`member-insight-section min-h-0 rounded-2xl border border-border/55 bg-background/55 p-3 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Metric({ value, label, compact = false }: { value: string | number; label: string; compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/55 bg-background/55 p-3 text-center">
      <p className={`${compact ? "text-sm md:text-base" : "text-xl md:text-2xl"} break-words font-bold tabular-nums text-foreground`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function buildSummary(props: MemberInsightsCarouselProps) {
  const primeiroNome = props.nome.trim().split(/\s+/)[0] || "O membro";
  if (!props.presencas) return `${primeiroNome} ainda não possui presenças registradas. O acompanhamento começará após a primeira reunião.`;
  if (props.alertaAusencias) return `${primeiroNome} apresenta ausências consecutivas recentes. É recomendável verificar se precisa de acompanhamento ou atualização de contato.`;
  if (props.taxaMensal >= 80) return `${primeiroNome} mantém frequência elevada nos últimos 30 dias, com participação regular nas reuniões recentes.`;
  if (props.taxaMensal >= 60) return `${primeiroNome} apresenta frequência estável. A continuidade nas próximas reuniões pode consolidar uma boa sequência.`;
  return `${primeiroNome} apresentou frequência abaixo de 60% nos últimos 30 dias. Vale observar a sequência das próximas reuniões.`;
}
