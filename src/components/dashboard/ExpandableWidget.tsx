import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpandableWidgetProps {
  title: string;
  children: ReactNode;
  renderExpanded: () => ReactNode;
}

export function ExpandableWidget({ title, children, renderExpanded }: ExpandableWidgetProps) {
  const [open, setOpen] = useState(false);
  const lastTapMsRef = useRef<number>(0);

  const onDoubleClick = useCallback(() => {
    setOpen(true);
  }, []);

  const onTouchEnd = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTapMsRef.current;
    lastTapMsRef.current = now;

    // Duplo toque: janela curta para evitar falsos positivos.
    if (delta > 0 && delta < 280) {
      setOpen(true);
    }
  }, []);

  const expanded = useMemo(() => (open ? renderExpanded() : null), [open, renderExpanded]);

  return (
    <>
      <div className="h-full min-h-0" onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd}>
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(92vw,1100px)] p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-base font-semibold text-foreground">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-background">
            <div className="w-full min-h-[70vh]">{expanded}</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
