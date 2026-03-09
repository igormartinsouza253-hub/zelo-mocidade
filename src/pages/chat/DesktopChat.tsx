import { MobileChatView } from "@/components/chat/mobile/MobileChatView";

// Desktop: usar o mesmo motor/recursos do chat mobile, com layout adaptado para desktop.
export default function DesktopChat() {
  return <MobileChatView layout="desktop" />;
}
