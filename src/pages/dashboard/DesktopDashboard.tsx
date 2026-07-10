import { ExpandableWidget } from "@/components/dashboard/ExpandableWidget";
import { AniversariantesWidget, type AniversarianteItem } from "@/components/dashboard/widgets/AniversariantesWidget";
import { FaixaEtariaWidget } from "@/components/dashboard/widgets/FaixaEtariaWidget";
import { NotasWidget } from "@/components/dashboard/widgets/NotasWidget";
import { ReunioesChartWidget } from "@/components/dashboard/widgets/ReunioesChartWidget";
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
  const dashboardSummary = {
    totalMembros: stats.totalMembros,
    totalReunioes: stats.totalReunioes,
    mediaPresenca: stats.mediaPresenca,
    ultimaReuniao: stats.ultimaReuniao,
    percentualGeral: frequenciaData.percentualGeral,
  };

  const reunioesChart = (size: "md" | "lg" = "lg") => (
    <ExpandableWidget
      title="Gráfico de presença"
      renderExpanded={() => (
        <ReunioesChartWidget
          size="lg"
          reunioesRecentes={frequenciaData.reunioesRecentes}
          dashboardSummary={dashboardSummary}
        />
      )}
    >
      <ReunioesChartWidget
        size={size}
        reunioesRecentes={frequenciaData.reunioesRecentes}
        dashboardSummary={dashboardSummary}
      />
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
          desktopDashboard
        />
      )}
    >
      <FaixaEtariaWidget
        size={size}
        porFaixaEtaria={frequenciaData.porFaixaEtaria}
        legendPosition={legendPosition}
        desktopDashboard
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
    <div className="desktop-dashboard-shell h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="desktop-dashboard-grid-wide hidden h-full min-h-0 grid-cols-[minmax(0,1.55fr)_minmax(320px,0.58fr)] grid-rows-[minmax(0,1.28fr)_minmax(260px,0.82fr)] gap-3 overflow-hidden xl:grid">
        <section className="min-h-0 overflow-hidden">{reunioesChart("lg")}</section>
        <section className="min-h-0 overflow-hidden">{topMembros("lg")}</section>

        <section className="grid min-h-0 grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden xl:col-span-2">
          <div className="min-h-0 overflow-hidden">{faixaEtariaChart("lg", "side")}</div>
          <div className="min-h-0 overflow-hidden">{notasWidget("md")}</div>
          <div className="min-h-0 overflow-hidden">{aniversariantesWidget("md")}</div>
        </section>
      </div>

      <div className="desktop-dashboard-grid-compact grid h-full min-h-0 grid-cols-6 grid-rows-[minmax(0,1.16fr)_minmax(260px,0.86fr)] gap-3 overflow-hidden xl:hidden">
        <div className="col-span-4 min-h-0 overflow-hidden">{reunioesChart("md")}</div>
        <div className="col-span-2 min-h-0 overflow-hidden">{topMembros("md")}</div>
        <section className="col-span-6 grid min-h-0 grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 overflow-hidden">
          <div className="min-h-0 overflow-hidden">{faixaEtariaChart("lg", "side")}</div>
          <div className="min-h-0 overflow-hidden">{notasWidget("md")}</div>
          <div className="min-h-0 overflow-hidden">{aniversariantesWidget("md")}</div>
        </section>
      </div>
    </div>
  );
}
