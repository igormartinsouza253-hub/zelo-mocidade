import { useIsMobile } from "@/hooks/use-mobile";
import DesktopEstatisticasReunioes from "@/pages/estatisticas/DesktopEstatisticasReunioes";
import MobileEstatisticasReunioes from "@/pages/estatisticas/MobileEstatisticasReunioes";

export default function EstatisticasReunioes() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileEstatisticasReunioes /> : <DesktopEstatisticasReunioes __forceDesktop />;
}
