import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopDashboard } from "@/pages/dashboard/DesktopDashboard";
import { MobileDashboard } from "@/pages/dashboard/MobileDashboard";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";

const Dashboard = () => {
  const isMobile = useIsMobile();
  const {
    stats,
    frequenciaData,
    notas,
    aniversariantes,
    showLeastFrequent,
    setShowLeastFrequent,
    topPeriod,
    setTopPeriod,
    deletarNota,
  } = useDashboardData();

  const sharedProps = {
    stats,
    frequenciaData,
    notas,
    aniversariantes,
    onDeleteNota: deletarNota,
    showLeastFrequent,
    onToggleOrder: () => setShowLeastFrequent((prev) => !prev),
    topPeriod,
    onTopPeriodChange: setTopPeriod,
  };

  if (isMobile) return <MobileDashboard {...sharedProps} />;
  return <DesktopDashboard {...sharedProps} />;
};

export default Dashboard;