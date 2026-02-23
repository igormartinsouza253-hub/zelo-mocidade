import * as React from "react";

type LongPressOptions = {
  thresholdMs?: number;
  onLongPress: () => void;
};

/**
 * Hook simples de long-press para mobile (pointer events).
 * - Dispara onLongPress após thresholdMs
 * - Cancela em pointerUp/pointerCancel/pointerLeave
 */
export function useLongPress({ onLongPress, thresholdMs = 450 }: LongPressOptions) {
  const timerRef = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    clear();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onLongPress();
    }, thresholdMs);
  }, [clear, onLongPress, thresholdMs]);

  React.useEffect(() => clear, [clear]);

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
  } as const;
}
