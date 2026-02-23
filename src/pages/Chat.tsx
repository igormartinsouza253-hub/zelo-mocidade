import { useIsMobile } from "@/hooks/use-mobile";
import DesktopChat from "@/pages/chat/DesktopChat";
import MobileChat from "@/pages/chat/MobileChat";

export default function Chat() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileChat /> : <DesktopChat />;
}
