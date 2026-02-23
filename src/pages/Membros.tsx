import { useIsMobile } from "@/hooks/use-mobile";
import DesktopMembros from "@/pages/membros/DesktopMembros";
import MobileMembros from "@/pages/membros/MobileMembros";

export default function Membros() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileMembros /> : <DesktopMembros __forceDesktop />;
}
