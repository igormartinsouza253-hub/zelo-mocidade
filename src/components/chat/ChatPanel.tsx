import { useEffect, useMemo, useRef, useState } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { useChatLauncher } from "@/components/chat/ChatLauncherContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function ChatPanel() {
  const { isChatPanelOpen, closeChatPanel } = useChatLauncher();

  const minWidth = 420;
  const maxWidth = 860;

  const [widthPx, setWidthPx] = useState(() => {
    if (typeof window === "undefined") return 560;
    const raw = window.localStorage.getItem("chatPanelWidthPx");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? Math.min(maxWidth, Math.max(minWidth, parsed)) : 560;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("chatPanelWidthPx", String(widthPx));
  }, [widthPx]);

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(widthPx);
  useEffect(() => {
    widthRef.current = widthPx;
  }, [widthPx]);

  const beginResize = (clientX: number) => {
    dragRef.current = { startX: clientX, startWidth: widthRef.current };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = dragRef.current.startX - e.clientX; // moving left increases width (right sheet)
      const next = Math.min(maxWidth, Math.max(minWidth, dragRef.current.startWidth + dx));
      setWidthPx(next);
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const widthStyle = useMemo(() => {
    // On very small viewports, keep it mostly full width.
    return { width: `min(92vw, ${widthPx}px)` } as const;
  }, [widthPx]);

  return (
    <Sheet open={isChatPanelOpen} onOpenChange={(open) => (open ? undefined : closeChatPanel())}>
      <SheetContent side="right" className="p-0 max-w-none flex flex-col" style={widthStyle}>
        {/* Drag handle */}
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar painel do chat"
          onMouseDown={(e) => beginResize(e.clientX)}
          onTouchStart={(e) => beginResize(e.touches[0]?.clientX ?? 0)}
          style={{ touchAction: "none" }}
        >
          <div className="absolute left-0 top-0 h-full w-px bg-border" />
        </div>

        <ChatView mode="panel" />
      </SheetContent>
    </Sheet>
  );
}
