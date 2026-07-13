import { useEffect, useState } from "react";
import { DesktopDashboard } from "@/pages/dashboard/DesktopDashboard";
import { MobileDashboard } from "@/pages/dashboard/MobileDashboard";
import { useDashboardData } from "@/hooks/dashboard/useDashboardData";

const Dashboard = () => {
  // Os widgets desktop precisam de mais largura que as demais telas do app.
  const [useCompactDashboard, setUseCompactDashboard] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < 1280,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const handleChange = (event: MediaQueryListEvent) => setUseCompactDashboard(event.matches);

    setUseCompactDashboard(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);
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

  if (useCompactDashboard) return <MobileDashboard {...sharedProps} />;
  return <DesktopDashboard {...sharedProps} />;
};

export default Dashboard;
