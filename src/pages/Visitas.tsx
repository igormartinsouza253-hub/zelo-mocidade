import { useIsMobile } from "@/hooks/use-mobile";
import DesktopVisitas from "@/pages/visitas/DesktopVisitas";
import MobileVisitas from "@/pages/visitas/MobileVisitas";

export default function Visitas() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileVisitas /> : <DesktopVisitas />;
}

