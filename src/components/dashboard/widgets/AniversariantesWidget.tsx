import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { WidgetSize } from "../types";
import { formatDateShort } from "@/lib/date-utils";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";


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

export const AniversariantesWidget = ({
  size,
  aniversariantes,
}: AniversariantesWidgetProps) => {
  const navigate = useNavigate();
  const [monthOffset, setMonthOffset] = React.useState(0);

  const today = new Date();
  const currentMonthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const displayedMonthIndex = currentMonthDate.getMonth();
  const displayedMonthLabel = currentMonthDate
    .toLocaleString("pt-BR", { month: "short" })
    .toUpperCase();

  const aniversariantesMes = aniversariantes.filter(
    (a) => new Date(a.data).getMonth() === displayedMonthIndex
  );
  const totalMes = aniversariantesMes.length;

  const principais =
    size === "lg"
      ? aniversariantesMes
      : size === "md"
        ? aniversariantesMes
        : [];

  const hojeKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const getDia = (data: string) => String(new Date(data).getDate()).padStart(2, "0");

  if (size === "sm") {
    return (
      <Card
        className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex items-center justify-center cursor-pointer md:rounded-xl"
        onClick={() => navigate("/calendario")}
      >
        <CardContent className="flex flex-col items-center justify-center gap-1.5 px-3 pb-3 pt-2">
          <div className="text-[11px] font-semibold tracking-[0.02em] text-foreground">
            Aniversariantes
          </div>
          <div className="text-2xl font-bold text-foreground leading-tight">{totalMes}</div>
          <p className="text-[11px] text-muted-foreground text-center leading-snug">deste mês</p>
        </CardContent>
      </Card>
    );
  }

  if (size === "md") {
    const aniversariantesHoje = principais.filter((a) => a.data.slice(5) === hojeKey);
    const proximos = principais.filter((a) => a.data.slice(5) !== hojeKey);

    return (
      <Card
        className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col cursor-pointer md:rounded-xl"
        onClick={() => navigate("/calendario")}
      >
        <CardHeader className={WIDGET_HEADER_PADDING["md"] + " flex items-center"}>
          <CardTitle className={widgetTitleClass("md") + " text-left mr-auto"}>
            Aniversariantes
          </CardTitle>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
            <button
              type="button"
              className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-border/60 bg-background hover:bg-accent/60"
              onClick={(e) => {
                e.stopPropagation();
                setMonthOffset((v) => v - 1);
              }}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <span className="font-semibold tracking-[0.16em] uppercase">
              {displayedMonthLabel}
            </span>
            <button
              type="button"
              className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-border/60 bg-background hover:bg-accent/60"
              onClick={(e) => {
                e.stopPropagation();
                setMonthOffset((v) => v + 1);
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto px-3 pb-3 pt-0">
          {totalMes === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aniversariante cadastrado para este mês.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Próximos aniversários
                </span>
                <span>{totalMes} no mês</span>
              </div>
              <div className="space-y-1.5">
                {aniversariantesHoje.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-foreground">
                      <span className="font-medium">Hoje</span>
                      <span className="text-muted-foreground">
                        {aniversariantesHoje.length} aniversariante(s)
                      </span>
                    </div>
                    {aniversariantesHoje.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl md:rounded-full border border-border/50 bg-primary/10 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={item.foto_url || undefined} alt={item.nome} />
                            <AvatarFallback>{item.nome.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-semibold text-foreground">
                              {item.nome}
                            </span>
                            {item.idade && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.idade} anos
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-primary">Hoje</span>
                      </div>
                    ))}
                  </div>
                )}

                {proximos.length > 0 && (
                  <div className="space-y-1.5">
                    {proximos.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-border/40 bg-accent/20 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={item.foto_url || undefined} alt={item.nome} />
                            <AvatarFallback>{item.nome.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-foreground">
                              {item.nome}
                            </span>
                            {item.idade && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.idade} anos
                              </span>
                            )}
                          </div>
                        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <span className="inline-flex items-center justify-center min-w-[30px] px-2 py-0.5 rounded-full bg-accent text-foreground font-semibold">
            {getDia(item.data)}
          </span>
        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // size === "lg"
  const aniversariantesHoje = principais.filter((a) => a.data.slice(5) === hojeKey);
  const proximos = principais.filter((a) => a.data.slice(5) !== hojeKey);

  return (
    <Card
      className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col cursor-pointer md:rounded-[2.5rem] overflow-hidden"
      onClick={() => navigate("/calendario")}
    >
      <CardHeader className={WIDGET_HEADER_PADDING["lg"] + " flex flex-row items-center justify-between px-[12px]"}>
        <div className="flex flex-col my-[10px] mx-[10px]">
          <CardTitle className={widgetTitleClass("lg")}>
            Aniversariantes
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mr-2">
          <button
            type="button"
            className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-border/60 bg-background hover:bg-accent/60"
            onClick={(e) => {
              e.stopPropagation();
              setMonthOffset((v) => v - 1);
            }}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="font-semibold tracking-[0.16em] uppercase">
            {displayedMonthLabel}
          </span>
          <button
            type="button"
            className="h-6 w-6 inline-flex items-center justify-center rounded-full border border-border/60 bg-background hover:bg-accent/60"
            onClick={(e) => {
              e.stopPropagation();
              setMonthOffset((v) => v + 1);
            }}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 px-3 pb-3 pt-0.5">
        {totalMes === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum aniversariante cadastrado para este mês.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Agenda do mês
              </span>
              <span>{totalMes} aniversariantes</span>
            </div>
            <div className="flex-1 min-h-0 space-y-1.5 overflow-auto pr-1 scrollbar-thin scrollbar-thumb-muted/50 scrollbar-track-transparent">
              {aniversariantesHoje.length > 0 && (
                <div className="space-y-1.5 mb-1.5">
                  {aniversariantesHoje.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-primary/10 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={item.foto_url || undefined} alt={item.nome} />
                          <AvatarFallback>{item.nome.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-semibold text-foreground">
                            {item.nome}
                          </span>
                          {item.idade && (
                            <span className="text-[11px] text-muted-foreground">
                              {item.idade} anos
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-primary">Hoje</span>
                    </div>
                  ))}
                </div>
              )}

              {proximos.length > 0 && (
                <div className="space-y-1.5">
                  {proximos.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border/40 bg-accent/20 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={item.foto_url || undefined} alt={item.nome} />
                          <AvatarFallback>{item.nome.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium text-foreground">
                            {item.nome}
                          </span>
                          {item.idade && (
                            <span className="text-[11px] text-muted-foreground">
                              {item.idade} anos
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center justify-center min-w-[30px] px-2 py-0.5 rounded-full bg-accent text-foreground font-semibold">
                          {getDia(item.data)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
