import { MobileDashboardHome } from "@/components/dashboard/MobileDashboardHome";
import type { DashboardFrequenciaData, DashboardNota, DashboardStats } from "@/hooks/dashboard/useDashboardData";
import type { AniversarianteItem } from "@/components/dashboard/widgets/AniversariantesWidget";

type MobileDashboardProps = {
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

export function MobileDashboard(props: MobileDashboardProps) {
  return <MobileDashboardHome {...props} />;
}
