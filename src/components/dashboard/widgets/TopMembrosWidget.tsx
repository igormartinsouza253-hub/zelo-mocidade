import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { WidgetSize } from "../types";

interface TopMembrosWidgetProps {
  size: WidgetSize;
  top5Membros: {
    id: string;
    nome: string;
    presencas: number;
    foto_url?: string | null;
  }[];
  onToggleOrder: () => void;
  showLeastFrequent: boolean;
  period: "1m" | "3m" | "1y";
  onPeriodChange: (value: "1m" | "3m" | "1y") => void;
}

const PERIOD_OPTIONS = [
  { value: "1m" as const, label: "Último mês" },
  { value: "3m" as const, label: "Últimos 3 meses" },
  { value: "1y" as const, label: "Todo o período" },
];

const primaryTranslucentStyle = {
  backgroundColor: "hsl(var(--primary) / 0.5)",
  color: "hsl(var(--primary-foreground))",
};

const primarySolidStyle = {
  backgroundColor: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))",
};

function getInitials(name: string) {
  const firstName = name.trim().split(/\s+/)[0] || "?";
  const letters = firstName.slice(0, 2);
  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
}

export const TopMembrosWidget = ({
  size,
  top5Membros,
  onToggleOrder,
  showLeastFrequent,
  period,
  onPeriodChange,
}: TopMembrosWidgetProps) => {
  const navigate = useNavigate();
  const navigateTimerRef = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const compact = size === "sm";
  const displayedMembros = compact ? top5Membros.slice(0, 5) : top5Membros;

  const cancelScheduledNavigate = () => {
    if (navigateTimerRef.current) {
      window.clearTimeout(navigateTimerRef.current);
      navigateTimerRef.current = null;
    }
  };

  const navigateWithDelay = (to: string) => {
    cancelScheduledNavigate();
    navigateTimerRef.current = window.setTimeout(() => {
      navigate(to);
      navigateTimerRef.current = null;
    }, 240);
  };

  const setOrder = (leastFrequent: boolean) => {
    if (leastFrequent !== showLeastFrequent) {
      onToggleOrder();
    }
  };

  useEffect(() => {
    return () => cancelScheduledNavigate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-primary/55 bg-card p-1.5 text-card-foreground shadow-[var(--shadow-card)]">
      <div className="shrink-0 overflow-hidden rounded-[13px] bg-primary p-1.5 text-primary-foreground">
        <div className="flex min-h-8 items-center justify-between gap-2">
          <div className="min-w-0 px-1.5 leading-none">
            <h3 className="truncate text-[13px] font-bold uppercase">
              {showLeastFrequent ? "Menos frequentes" : "Mais frequentes"}
            </h3>
            <p className="mt-1 truncate text-[12px] font-medium opacity-95">Nas Reuniões</p>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary-foreground/18 text-primary-foreground transition-colors hover:bg-primary-foreground/25"
            aria-label={expanded ? "Recolher filtros" : "Expandir filtros"}
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-[10px] bg-primary-foreground/18 px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase leading-none">Período</p>
              <div className="mt-1.5 space-y-1">
                {PERIOD_OPTIONS.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium leading-none">
                    <input
                      type="radio"
                      name={`top-period-${size}`}
                      value={option.value}
                      checked={period === option.value}
                      onChange={() => onPeriodChange(option.value)}
                      className="h-3 w-3 accent-primary-foreground"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[10px] bg-primary-foreground/18 px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase leading-none">Ordem</p>
              <div className="mt-1.5 space-y-1">
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium leading-none">
                  <input
                    type="radio"
                    name={`top-order-${size}`}
                    checked={showLeastFrequent}
                    onChange={() => setOrder(true)}
                    className="h-3 w-3 accent-primary-foreground"
                  />
                  <span className="truncate">Menos frequentes</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium leading-none">
                  <input
                    type="radio"
                    name={`top-order-${size}`}
                    checked={!showLeastFrequent}
                    onChange={() => setOrder(false)}
                    className="h-3 w-3 accent-primary-foreground"
                  />
                  <span className="truncate">Mais frequentes</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <CardContent className={compact ? "min-h-0 flex-1 px-1.5 pb-1.5 pt-1.5" : "min-h-0 flex-1 px-1.5 pb-1.5 pt-2"}>
        <div className={compact ? "h-full min-h-0 space-y-1.5 overflow-y-auto pr-1 scrollbar-none" : "h-full min-h-0 space-y-2 overflow-y-auto pr-1 scrollbar-none"}>
          {top5Membros.length === 0 ? (
            <p className="px-2 py-3 text-sm font-semibold text-muted-foreground">Nenhum dado disponível</p>
          ) : (
            displayedMembros.map((membro, index) => (
              <button
                key={membro.id}
                type="button"
                className={compact ? "flex w-full items-center justify-between gap-2 rounded-2xl px-1.5 py-1 transition-colors hover:bg-accent/45" : "flex w-full items-center justify-between gap-2 rounded-2xl px-1.5 py-1.5 transition-colors hover:bg-accent/45"}
                onClick={() => navigateWithDelay(`/membros/visualizar/${membro.id}`)}
                onDoubleClick={cancelScheduledNavigate}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative">
                    {membro.foto_url ? (
                      <Avatar className={compact ? "h-8 w-8 rounded-[10px]" : "h-10 w-10 rounded-[11px]"}>
                        <AvatarImage className="rounded-[11px] object-cover" src={membro.foto_url} alt={membro.nome} />
                        <AvatarFallback className="rounded-[11px] text-base font-semibold" style={primaryTranslucentStyle}>
                          {getInitials(membro.nome)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className={compact ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-base font-semibold" : "flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] text-base font-semibold"}
                        style={primaryTranslucentStyle}
                      >
                        {getInitials(membro.nome)}
                      </div>
                    )}
                    <div
                      className={compact ? "absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none" : "absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none"}
                      style={primarySolidStyle}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </div>
                  </div>

                  <span className={compact ? "truncate text-sm font-semibold text-foreground" : "truncate text-[15px] font-semibold text-foreground"} title={membro.nome}>
                    {membro.nome}
                  </span>
                </div>

                <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-[9px] px-1.5 text-sm font-semibold" style={primaryTranslucentStyle}>
                  {membro.presencas}
                </span>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
