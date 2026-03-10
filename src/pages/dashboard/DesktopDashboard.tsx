import { Card } from "@/components/ui/card";
import { StatsWidget } from "@/components/dashboard/widgets/StatsWidget";

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
    <div className="min-h-full w-full bg-background">
      <div className="flex min-h-full w-full flex-col">
        <div className="flex-1 min-h-0">
          <Card className="min-h-full w-full rounded-xl bg-card border border-border/80 shadow-[var(--shadow-card)]">
            <div className="min-h-full w-full p-3 md:p-4 xl:p-5 2xl:p-6 grid gap-3 md:gap-4 xl:gap-5 2xl:gap-6 grid-cols-[minmax(0,2.8fr)_minmax(0,5fr)_minmax(0,3fr)]">
              {/* PT-BR: Coluna esquerda fixa com Faixa Etária em altura total */}
              <div className="min-h-[700px] min-h-0">
                <ExpandableWidget
                  title="Distribuição por faixa etária"
                  renderExpanded={() => (
                    <FaixaEtariaWidget size="lg" porFaixaEtaria={frequenciaData.porFaixaEtaria} legendPosition="bottom" />
                  )}
                >
                  <FaixaEtariaWidget size="lg" porFaixaEtaria={frequenciaData.porFaixaEtaria} legendPosition="bottom" />
                </ExpandableWidget>
              </div>

              {/* PT-BR: Coluna central com gráfico principal maior + aniversariantes/notas lado a lado */}
              <div className="grid min-h-[700px] grid-rows-[minmax(420px,1.35fr)_minmax(260px,0.8fr)] gap-4">
                <div className="min-h-0">
                  <ExpandableWidget
                    title="Gráfico de presença"
                    renderExpanded={() => (
                      <ReunioesChartWidget size="lg" reunioesRecentes={frequenciaData.reunioesRecentes} />
                    )}
                  >
                    <ReunioesChartWidget size="lg" reunioesRecentes={frequenciaData.reunioesRecentes} />
                  </ExpandableWidget>
                </div>

                {/* PT-BR: mesmos tamanhos e scroll interno invisível para conteúdo excedente */}
                <div className="grid min-h-0 grid-cols-2 gap-4">
                  <div className="min-h-0">
                    <AniversariantesWidget size="lg" aniversariantes={aniversariantes} />
                  </div>
                  <div className="min-h-0">
                    <ExpandableWidget
                      title="Notas rápidas"
                      renderExpanded={() => <NotasWidget size="lg" notas={notas} onDelete={onDeleteNota} />}
                    >
                      <NotasWidget size="lg" notas={notas} onDelete={onDeleteNota} />
                    </ExpandableWidget>
                  </div>
                </div>
              </div>

              {/* PT-BR: Coluna direita preservada para ações, resumo e ranking */}
              <div className="grid min-h-[700px] grid-rows-[minmax(130px,auto)_minmax(170px,auto)_minmax(280px,1fr)] gap-4">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)] gap-4">
                  <QuickActionsWidget size="sm" />
                  <FrequencySummaryWidget size="md" percentualGeral={frequenciaData.percentualGeral} />
                </div>

                <StatsWidget
                  size="lg"
                  totalMembros={stats.totalMembros}
                  totalReunioes={stats.totalReunioes}
                  mediaPresenca={stats.mediaPresenca}
                  ultimaReuniao={stats.ultimaReuniao}
                />

                <div className="min-h-0">
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
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
