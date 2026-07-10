import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useExpandableWidget } from "@/components/dashboard/ExpandableWidget";
import type { WidgetSize } from "../types";

export interface AniversarianteItem {
  id: string;
  nome: string;
  data: string;
  idade?: number;
  foto_url?: string | null;
}

interface AniversariantesWidgetProps {
  size: WidgetSize;
  aniversariantes: AniversarianteItem[];
}

type BirthdayViewMode = "cards" | "list";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const getBirthdayParts = (data: string) => {
  const parts = data.split("-").map(Number);
  const mes = parts.length === 3 ? parts[1] : parts[0];
  const dia = parts.length === 3 ? parts[2] : parts[1];
  return { mes, dia };
};

const getDayLabel = (data: string) => String(getBirthdayParts(data).dia || "").padStart(2, "0");

const getMonthLabel = (monthIndex: number) => {
  const month = MONTHS[monthIndex] || "";
  return `${month.slice(0, 3).toUpperCase()}.`;
};

const getBirthdayDateLabel = (data: string) => {
  const { mes, dia } = getBirthdayParts(data);
  const month = MONTHS[(mes || 1) - 1] || "";
  return `${String(dia || "").padStart(2, "0")} de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
};

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export const AniversariantesWidget = ({
  size,
  aniversariantes,
}: AniversariantesWidgetProps) => {
  const navigate = useNavigate();
  const expandableWidget = useExpandableWidget();
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [viewMode, setViewMode] = React.useState<BirthdayViewMode>("list");
  const [carouselIndex, setCarouselIndex] = React.useState(0);
  const [carouselDirection, setCarouselDirection] = React.useState<1 | -1>(1);
  const [carouselMaxOffset, setCarouselMaxOffset] = React.useState(0);
  const [carouselCanScroll, setCarouselCanScroll] = React.useState(false);
  const [carouselPaused, setCarouselPaused] = React.useState(false);
  const carouselViewportRef = React.useRef<HTMLDivElement | null>(null);
  const titleClickTimerRef = React.useRef<number | null>(null);

  const today = new Date();
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const displayedMonthIndex = currentMonthDate.getMonth();
  const displayedMonthLabel = getMonthLabel(displayedMonthIndex);

  const aniversariantesMes = aniversariantes.filter((item) => {
    const { mes } = getBirthdayParts(item.data);
    return mes - 1 === displayedMonthIndex;
  });
  const totalMes = aniversariantesMes.length;

  const compact = size === "md";
  const carouselCardWidth = compact ? 150 : 170;
  const carouselGap = 8;
  const carouselStep = carouselCardWidth + carouselGap;
  const carouselMaxIndex = carouselCanScroll ? Math.ceil(carouselMaxOffset / carouselStep) : 0;
  const carouselOffset = carouselCanScroll ? Math.min(carouselIndex * carouselStep, carouselMaxOffset) : 0;

  const updateMonth = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.stopPropagation();
    setMonthOffset((current) => current + direction);
  };

  const updateMode = (event: React.MouseEvent<HTMLButtonElement>, mode: BirthdayViewMode) => {
    event.stopPropagation();
    setViewMode(mode);
  };

  const toggleViewMode = () => {
    setViewMode((current) => (current === "cards" ? "list" : "cards"));
  };

  const cancelTitleClick = () => {
    if (titleClickTimerRef.current) {
      window.clearTimeout(titleClickTimerRef.current);
      titleClickTimerRef.current = null;
    }
  };

  const handleTitleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    cancelTitleClick();
    titleClickTimerRef.current = window.setTimeout(() => {
      expandableWidget?.openExpanded();
      titleClickTimerRef.current = null;
    }, 220);
  };

  const handleTitleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    cancelTitleClick();
    toggleViewMode();
  };

  const openMember = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation();
    navigate(`/membros/visualizar/${id}`);
  };

  React.useEffect(() => {
    const measureCarousel = () => {
      const viewportWidth = carouselViewportRef.current?.clientWidth ?? 0;
      const totalCardsWidth =
        aniversariantesMes.length * carouselCardWidth +
        Math.max(0, aniversariantesMes.length - 1) * carouselGap;
      const overflow = Math.max(0, totalCardsWidth - viewportWidth);
      const shouldScroll = overflow > carouselCardWidth * 0.1;

      setCarouselCanScroll(shouldScroll);
      setCarouselMaxOffset(shouldScroll ? overflow : 0);
      if (!shouldScroll) {
        setCarouselIndex(0);
        setCarouselDirection(1);
      }
    };

    measureCarousel();

    const viewport = carouselViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureCarousel);
      return () => window.removeEventListener("resize", measureCarousel);
    }

    const observer = new ResizeObserver(measureCarousel);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [aniversariantesMes.length, carouselCardWidth, carouselGap, viewMode]);

  React.useEffect(() => {
    setCarouselIndex(0);
    setCarouselDirection(1);
  }, [displayedMonthIndex, viewMode]);

  React.useEffect(() => {
    setCarouselIndex((current) => Math.min(current, carouselMaxIndex));
  }, [carouselMaxIndex]);

  React.useEffect(() => {
    if (!carouselCanScroll || carouselPaused || viewMode !== "cards") return;

    const intervalId = window.setInterval(() => {
      setCarouselIndex((current) => {
        if (carouselDirection === 1) {
          if (current >= carouselMaxIndex) {
            setCarouselDirection(-1);
            return Math.max(0, current - 1);
          }
          return current + 1;
        }

        if (current <= 0) {
          setCarouselDirection(1);
          return Math.min(carouselMaxIndex, current + 1);
        }
        return current - 1;
      });
    }, 4300);

    return () => window.clearInterval(intervalId);
  }, [carouselCanScroll, carouselDirection, carouselMaxIndex, carouselPaused, viewMode]);

  React.useEffect(() => {
    return () => cancelTitleClick();
  }, []);

  if (size === "sm") {
    return (
      <Card className="flex h-full items-center justify-center rounded-3xl border-border/55 bg-card/90 text-card-foreground shadow-[var(--shadow-card)]">
        <CardContent className="flex flex-col items-center justify-center gap-1.5 px-3 pb-3 pt-2">
          <div className="text-[11px] font-semibold tracking-[0.02em] text-foreground">
            Aniversariantes
          </div>
          <div className="text-2xl font-bold leading-tight text-foreground">{totalMes}</div>
          <p className="text-center text-[11px] leading-snug text-muted-foreground">deste mês</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-primary/55 bg-card p-1.5 text-card-foreground shadow-[var(--shadow-card)]"
    >
      <div
        className="shrink-0 rounded-[13px] bg-primary p-1.5 text-primary-foreground"
        onClick={handleTitleClick}
        onDoubleClick={handleTitleDoubleClick}
        title="Clique duas vezes para alternar a exibição"
      >
        <div className="flex min-h-8 items-center justify-between gap-2">
          <div className="min-w-0 px-1.5 leading-none">
            <h3 className="truncate text-[13px] font-bold uppercase">Aniversariantes</h3>
            <p className="mt-1 truncate text-[12px] font-medium opacity-95">Próximos aniversários</p>
          </div>

          <div className="flex shrink-0 items-center rounded-[10px] bg-primary-foreground/18 px-1 py-0.5">
            <button
              type="button"
              className="inline-flex h-7 w-6 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/18"
              onClick={(event) => updateMonth(event, -1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[2.7rem] text-center text-[13px] font-bold uppercase leading-none">
              {displayedMonthLabel}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-6 items-center justify-center rounded-lg text-primary-foreground transition-colors hover:bg-primary-foreground/18"
              onClick={(event) => updateMonth(event, 1)}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <CardContent className="flex min-h-0 flex-1 flex-col px-1.5 pb-1.5 pt-1.5">
        {totalMes === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-[14px] border border-dashed border-primary/35 px-3 text-center text-sm font-medium text-muted-foreground">
            Nenhum aniversariante cadastrado para este mês.
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden">
              {viewMode === "cards" ? (
                <div
                  ref={carouselViewportRef}
                  className="relative h-full overflow-hidden"
                  onMouseEnter={() => setCarouselPaused(true)}
                  onMouseLeave={() => setCarouselPaused(false)}
                >
                  <div
                    className={carouselCanScroll ? "flex h-full w-max gap-2 transition-transform ease-in-out" : "flex h-full w-full gap-2"}
                    style={
                      carouselCanScroll
                        ? { transform: `translateX(-${carouselOffset}px)`, transitionDuration: "3200ms" }
                        : undefined
                    }
                  >
                    {aniversariantesMes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(event) => openMember(event, item.id)}
                        className={
                          carouselCanScroll
                            ? compact
                              ? "flex h-full w-[150px] shrink-0 flex-col rounded-[13px] border border-primary/55 bg-card p-1 text-left transition-colors hover:bg-accent/35"
                              : "flex h-full w-[170px] shrink-0 flex-col rounded-[13px] border border-primary/55 bg-card p-1 text-left transition-colors hover:bg-accent/35"
                            : "flex h-full min-w-0 flex-1 flex-col rounded-[13px] border border-primary/55 bg-card p-1 text-left transition-colors hover:bg-accent/35"
                        }
                      >
                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[10px] bg-primary/25">
                          {item.foto_url ? (
                            <img
                              src={item.foto_url}
                              alt={item.nome}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-primary">
                              <UserRound className={compact ? "h-16 w-16 stroke-[1.8]" : "h-20 w-20 stroke-[1.8]"} />
                            </div>
                          )}
                          {item.idade ? (
                            <span className="absolute bottom-1 left-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                              {item.idade}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 space-y-1">
                          <div className="rounded-[9px] bg-primary px-2 py-1 text-[14px] font-bold leading-none text-primary-foreground">
                            <span className="block truncate">{getFirstName(item.nome)}</span>
                          </div>
                          <p className="truncate px-1 text-[13px] font-semibold leading-tight text-primary">
                            {getBirthdayDateLabel(item.data)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-0 space-y-1.5 overflow-y-auto pr-1 scrollbar-none">
                  {aniversariantesMes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(event) => openMember(event, item.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-[14px] border border-primary/55 bg-card px-2 py-1.5 text-left transition-colors hover:bg-accent/35"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-10 w-10 rounded-[11px]">
                          <AvatarImage className="rounded-[11px] object-cover" src={item.foto_url || undefined} alt={item.nome} />
                          <AvatarFallback className="rounded-[11px] bg-primary/20 text-primary">
                            <UserRound className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 leading-none">
                          <p className="truncate text-[15px] font-semibold text-foreground">{item.nome}</p>
                          {item.idade ? (
                            <p className="mt-1 truncate text-[12px] font-medium text-muted-foreground">
                              {item.idade} anos
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-[24px] font-bold leading-none text-primary">
                        {getDayLabel(item.data)}
                      </span>
                    </button>
                  ))}
                  {aniversariantesMes.length < 2 ? (
                    <div className="flex min-h-[3.75rem] w-full items-center gap-2 rounded-[14px] border border-dashed border-primary/35 bg-primary/5 px-2 py-2 text-left">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 leading-none">
                        <p className="truncate text-[13px] font-semibold text-primary">Sem outros aniversários</p>
                        <p className="mt-1 truncate text-[12px] font-medium text-muted-foreground">Neste mês, por enquanto.</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mt-1.5 flex h-3 shrink-0 items-center justify-center gap-1.5">
              <button
                type="button"
                aria-label="Exibir em carrossel"
                onClick={(event) => updateMode(event, "cards")}
                className="relative flex h-5 w-6 items-center justify-center rounded-full before:absolute before:-inset-x-2 before:-inset-y-1.5"
              >
                <span className={viewMode === "cards" ? "h-1.5 w-6 rounded-full bg-primary transition-all" : "h-1.5 w-6 rounded-full bg-muted-foreground/55 transition-all hover:bg-primary/55"} />
              </button>
              <button
                type="button"
                aria-label="Exibir em lista"
                onClick={(event) => updateMode(event, "list")}
                className="relative flex h-5 w-6 items-center justify-center rounded-full before:absolute before:-inset-x-2 before:-inset-y-1.5"
              >
                <span className={viewMode === "list" ? "h-1.5 w-6 rounded-full bg-primary transition-all" : "h-1.5 w-6 rounded-full bg-muted-foreground/55 transition-all hover:bg-primary/55"} />
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
