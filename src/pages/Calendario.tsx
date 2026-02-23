import { useIsMobile } from "@/hooks/use-mobile";
import DesktopCalendario from "@/pages/calendario/DesktopCalendario";
import MobileCalendar from "@/pages/calendario/MobileCalendar";

export default function Calendario() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileCalendar /> : <DesktopCalendario />;
}
