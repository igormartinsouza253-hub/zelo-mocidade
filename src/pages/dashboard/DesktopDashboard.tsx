import { ExpandableWidget } from "@/components/dashboard/ExpandableWidget";
import { AniversariantesWidget, type AniversarianteItem } from "@/components/dashboard/widgets/AniversariantesWidget";
import { FaixaEtariaWidget } from "@/components/dashboard/widgets/FaixaEtariaWidget";
import { FrequencySummaryWidget } from "@/components/dashboard/widgets/FrequencySummaryWidget";
import { NotasWidget } from "@/components/dashboard/widgets/NotasWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { ReunioesChartWidget } from "@/components/dashboard/widgets/ReunioesChartWidget";
import { StatsWidget } from "@/components/dashboard/widgets/StatsWidget";
import { TopMembrosWidget } from "@/components/dashboard/widgets/TopMembrosWidget";
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
  const statsWidget = (
    <StatsWidget
      size="lg"
      totalMembros={stats.totalMembros}
      totalReunioes={stats.totalReunioes}
      mediaPresenca={stats.mediaPresenca}
      ultimaReuniao={stats.ultimaReuniao}
    />
  );

  const reunioesChart = (size: "md" | "lg" = "lg") => (
    <ExpandableWidget
      title="Gráfico de presença"
      renderExpanded={() => (
        <ReunioesChartWidget size="lg" reunioesRecentes={frequenciaData.reunioesRecentes} />
      )}
    >
      <ReunioesChartWidget size={size} reunioesRecentes={frequenciaData.reunioesRecentes} />
    </ExpandableWidget>
  );

  const faixaEtariaChart = (size: "md" | "lg" = "lg", legendPosition: "side" | "bottom" = "side") => (
    <ExpandableWidget
      title="Distribuição por faixa etária"
      renderExpanded={() => (
        <FaixaEtariaWidget
          size="lg"
          porFaixaEtaria={frequenciaData.porFaixaEtaria}
          legendPosition="side"
        />
      )}
    >
      <FaixaEtariaWidget
        size={size}
        porFaixaEtaria={frequenciaData.porFaixaEtaria}
        legendPosition={legendPosition}
      />
    </ExpandableWidget>
  );

  const topMembros = (size: "md" | "lg" = "lg") => (
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
        size={size}
        top5Membros={frequenciaData.top5Membros}
        showLeastFrequent={showLeastFrequent}
        onToggleOrder={onToggleOrder}
        period={topPeriod}
        onPeriodChange={onTopPeriodChange}
      />
    </ExpandableWidget>
  );

  const notasWidget = (size: "md" | "lg" = "lg") => (
    <ExpandableWidget
      title="Notas rápidas"
      renderExpanded={() => <NotasWidget size="lg" notas={notas} onDelete={onDeleteNota} />}
    >
      <NotasWidget size={size} notas={notas} onDelete={onDeleteNota} />
    </ExpandableWidget>
  );

  const aniversariantesWidget = (size: "md" | "lg" = "lg") => (
    <ExpandableWidget
      title="Aniversariantes"
      renderExpanded={() => <AniversariantesWidget size="lg" aniversariantes={aniversariantes} />}
    >
      <AniversariantesWidget size={size} aniversariantes={aniversariantes} />
    </ExpandableWidget>
  );

  return (
    <div className="h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="hidden h-full min-h-0 grid-cols-[minmax(0,1.55fr)_minmax(310px,0.72fr)] grid-rows-[76px_minmax(0,1.02fr)_minmax(0,0.98fr)] gap-3 overflow-hidden xl:grid">
        <div className="min-h-0 overflow-hidden">{statsWidget}</div>
        <div className="min-h-0 overflow-hidden">
          <QuickActionsWidget size="sm" />
        </div>

        <section className="min-h-0 overflow-hidden">{reunioesChart("lg")}</section>

        <aside className="grid min-h-0 grid-rows-[minmax(104px,0.36fr)_minmax(0,1fr)] gap-3 overflow-hidden">
          <div className="min-h-0 overflow-hidden">
            <FrequencySummaryWidget size="md" percentualGeral={frequenciaData.percentualGeral} />
          </div>
          <div className="min-h-0 overflow-hidden">{topMembros("lg")}</div>
        </aside>

        <section className="grid min-h-0 grid-cols-[minmax(0,1.15fr)_minmax(260px,0.55fr)] gap-3 overflow-hidden">
          <div className="min-h-0 overflow-hidden">{faixaEtariaChart("lg", "side")}</div>
          <div className="min-h-0 overflow-hidden">{notasWidget("md")}</div>
        </section>

        <div className="min-h-0 overflow-hidden">{aniversariantesWidget("lg")}</div>
      </div>

      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.35fr)_minmax(250px,0.85fr)] grid-rows-[76px_minmax(0,0.98fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-3 overflow-hidden xl:hidden">
        <div className="col-span-2 min-h-0 overflow-hidden">{statsWidget}</div>
        <div className="min-h-0 overflow-hidden">{reunioesChart("md")}</div>
        <div className="min-h-0 overflow-hidden">{topMembros("md")}</div>
        <div className="min-h-0 overflow-hidden">{faixaEtariaChart("md", "bottom")}</div>
        <div className="min-h-0 overflow-hidden">{aniversariantesWidget("md")}</div>
        <div className="min-h-0 overflow-hidden">{notasWidget("md")}</div>
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(86px,0.55fr)] gap-3 overflow-hidden">
          <div className="min-h-0 overflow-hidden">
            <FrequencySummaryWidget size="md" percentualGeral={frequenciaData.percentualGeral} />
          </div>
          <div className="min-h-0 overflow-hidden">
            <QuickActionsWidget size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
