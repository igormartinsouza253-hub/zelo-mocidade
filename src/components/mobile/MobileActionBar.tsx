import * as React from "react";

import { cn } from "@/lib/utils";

export function MobileActionBar({
  children,
  className,
  floating = false,
}: {
  children: React.ReactNode;
  className?: string;
  floating?: boolean;
}) {
  if (floating) {
    return (
      <div className={cn("pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex justify-center px-4 md:hidden", className)}>
        <div className="pointer-events-auto w-full max-w-[22rem] rounded-3xl border border-border/65 bg-background/95 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/90">
          <div className="grid grid-cols-2 gap-2 [&_button]:h-11 [&_button]:rounded-2xl [&_button]:font-semibold">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-4xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="grid grid-cols-2 gap-2">{children}</div>
      </div>
    </div>
  );
}
