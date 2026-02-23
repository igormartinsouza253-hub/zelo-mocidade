import { useIsMobile } from "@/hooks/use-mobile";
import DesktopReunioes from "@/pages/reunioes/DesktopReunioes";
import MobileReunioes from "@/pages/reunioes/MobileReunioes";

export default function Reunioes() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileReunioes /> : <DesktopReunioes __forceDesktop />;
}
