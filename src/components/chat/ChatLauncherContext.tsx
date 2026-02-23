import * as React from "react";

export type ChatOpenMode = "panel" | "page";

type ChatLauncherContextValue = {
  openChatPanel: () => void;
  closeChatPanel: () => void;
  isChatPanelOpen: boolean;
  preferredOpenMode: ChatOpenMode;
  setPreferredOpenMode: (mode: ChatOpenMode) => void;
};

const ChatLauncherContext = React.createContext<ChatLauncherContextValue | null>(null);

export function ChatLauncherProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ChatLauncherContextValue;
}) {
  return <ChatLauncherContext.Provider value={value}>{children}</ChatLauncherContext.Provider>;
}

export function useChatLauncher() {
  const ctx = React.useContext(ChatLauncherContext);
  if (!ctx) throw new Error("useChatLauncher must be used within ChatLauncherProvider");
  return ctx;
}
