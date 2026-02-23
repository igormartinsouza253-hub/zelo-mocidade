import { ChatView } from "@/components/chat/ChatView";

// Desktop/Tablet: usar o modo painel (compacto) embutido na página.
export default function DesktopChat() {
  return <ChatView mode="panel" />;
}
