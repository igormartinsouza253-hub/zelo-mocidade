import { Card } from "@/components/ui/card";
import { StatsWidget } from "@/components/dashboard/widgets/StatsWidget";
import { NextMeetingWidget } from "@/components/dashboard/widgets/NextMeetingWidget";
import { FrequencySummaryWidget } from "@/components/dashboard/widgets/FrequencySummaryWidget";
import { FaixaEtariaWidget } from "@/components/dashboard/widgets/FaixaEtariaWidget";
import { ReunioesChartWidget } from "@/components/dashboard/widgets/ReunioesChartWidget";
import { TopMembrosWidget } from "@/components/dashboard/widgets/TopMembrosWidget";
import { NotasWidget } from "@/components/dashboard/widgets/NotasWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { AniversariantesWidget, type AniversarianteItem } from "@/components/dashboard/widgets/AniversariantesWidget";
import { ExpandableWidget } from "@/components/dashboard/ExpandableWidget";

import type { DashboardFrequenciaData, DashboardNota, DashboardStats } from "@/hooks/dashboard/useDashboardData";

type DesktopDashboardProps = {
  stats: DashboardStats;
  frequenciaData: DashboardFrequenciaData;
  notas: DashboardNota[];
  aniversariantes: AniversarianteItem[];
  onDeleteNota: (id: string) => void;
  showLeastFrequent: boolean;
  onToggleOrder: () => void;
  topPeriod: "1m" | "3m" | "1y";
  onTopPeriodChange: (value: "1m" | "3m" | "1y") => void;
};

export function DesktopDashboard({
  stats,
  frequenciaData,
  notas,
  aniversariantes,
  onDeleteNota,
  showLeastFrequent,
  onToggleOrder,
  topPeriod,
  onTopPeriodChange,
}: DesktopDashboardProps) {
  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 min-h-0">
          <Card className="h-full w-full rounded-xl bg-card border border-border/80 shadow-[var(--shadow-card)]">
            <div className="h-full w-full p-3 md:p-4 xl:p-5 2xl:p-6 grid gap-3 md:gap-4 xl:gap-5 2xl:gap-6 grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,3fr)]">
              {/* Coluna esquerda: Aniversariantes + Notas */}
              <div className="flex flex-col gap-4 min-h-0 h-full w-full">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AniversariantesWidget size="lg" aniversariantes={aniversariantes} />
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ExpandableWidget
                    title="Notas rápidas"
                    renderExpanded={() => <NotasWidget size="lg" notas={notas} onDelete={onDeleteNota} />}
                  >
                    <NotasWidget size="lg" notas={notas} onDelete={onDeleteNota} />
                  </ExpandableWidget>
                </div>
              </div>

              {/* Coluna central: Gráfico de presença + Faixa etária */}
              <div className="flex flex-col gap-4 min-h-0 h-full w-full">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ExpandableWidget
                    title="Gráfico de presença"
                    renderExpanded={() => (
                      <ReunioesChartWidget size="lg" reunioesRecentes={frequenciaData.reunioesRecentes} />
                    )}
                  >
                    <ReunioesChartWidget size="lg" reunioesRecentes={frequenciaData.reunioesRecentes} />
                  </ExpandableWidget>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <ExpandableWidget
                    title="Distribuição por faixa etária"
                    renderExpanded={() => <FaixaEtariaWidget size="lg" porFaixaEtaria={frequenciaData.porFaixaEtaria} />}
                  >
                    <FaixaEtariaWidget size="lg" porFaixaEtaria={frequenciaData.porFaixaEtaria} />
                  </ExpandableWidget>
                </div>
              </div>

              {/* Coluna direita */}
              <div className="flex flex-col gap-4 min-h-0 h-full w-full">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)] gap-4">
                  <QuickActionsWidget size="sm" />
                  <FrequencySummaryWidget size="md" percentualGeral={frequenciaData.percentualGeral} />
                </div>

                <NextMeetingWidget size="sm" ultimaReuniao={stats.ultimaReuniao} />

                <StatsWidget
                  size="lg"
                  totalMembros={stats.totalMembros}
                  totalReunioes={stats.totalReunioes}
                  mediaPresenca={stats.mediaPresenca}
                  ultimaReuniao={stats.ultimaReuniao}
                />

                <ExpandableWidget
                  title="Mais frequentes"
                  renderExpanded={() => (
                    <TopMembrosWidget
                      size="lg"
                      top5Membros={frequenciaData.top5Membros}
                      showLeastFrequent={showLeastFrequent}
                      onToggleOrder={onToggleOrder}
                      period={topPeriod}
                      onPeriodChange={onTopPeriodChange}
                    />
                  )}
                >
                  <TopMembrosWidget
                    size="lg"
                    top5Membros={frequenciaData.top5Membros}
                    showLeastFrequent={showLeastFrequent}
                    onToggleOrder={onToggleOrder}
                    period={topPeriod}
                    onPeriodChange={onTopPeriodChange}
                  />
                </ExpandableWidget>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
