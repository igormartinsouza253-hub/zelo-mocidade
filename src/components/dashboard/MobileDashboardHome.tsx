import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CalendarPlus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

import { MobileStatsGrid } from "@/components/dashboard/MobileStatsGrid";
import { ReunioesChartWidget } from "@/components/dashboard/widgets/ReunioesChartWidget";
import { FaixaEtariaWidget } from "@/components/dashboard/widgets/FaixaEtariaWidget";
import { TopMembrosWidget } from "@/components/dashboard/widgets/TopMembrosWidget";
import { AniversariantesWidget, type AniversarianteItem } from "@/components/dashboard/widgets/AniversariantesWidget";
import { NotasWidget } from "@/components/dashboard/widgets/NotasWidget";

type Stats = {
  totalMembros: number;
  totalReunioes: number;
  mediaPresenca: number;
  ultimaReuniao: string;
};

type FrequenciaData = {
  reunioesRecentes: any[];
  porFaixaEtaria: { faixa: string; total: number }[];
  top5Membros: { id: string; nome: string; presencas: number; foto_url?: string | null }[];
  percentualGeral: number;
};

type Nota = {
  id: string;
  conteudo: string;
  created_at: string;
  user_id: string;
};

type MobileDashboardHomeProps = {
  stats: Stats;
  frequenciaData: FrequenciaData;
  notas: Nota[];
  aniversariantes: AniversarianteItem[];
  onDeleteNota: (id: string) => void;
  showLeastFrequent: boolean;
  onToggleOrder: () => void;
  topPeriod: "1m" | "3m" | "1y";
  onTopPeriodChange: (value: "1m" | "3m" | "1y") => void;
};

export function MobileDashboardHome({
  stats,
  frequenciaData,
  notas,
  aniversariantes,
  onDeleteNota,
  showLeastFrequent,
  onToggleOrder,
  topPeriod,
  onTopPeriodChange,
}: MobileDashboardHomeProps) {
  const navigate = useNavigate();

  // Altura estável por slide (evita “pulo” entre widgets no carrossel).
  // Ajustada para encaixar bem em 390x844 mantendo respiro para header/dock.
  const slideHeightClass = "h-[clamp(288px,42vh,328px)] md:h-[380px]";

  const [api, setApi] = useState<CarouselApi | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const slideCount = useMemo(() => api?.scrollSnapList().length ?? 3, [api]);

  useEffect(() => {
    if (!api) return;

    const update = () => setSelectedIndex(api.selectedScrollSnap());
    update();

    api.on("select", update);
    api.on("reInit", update);

    return () => {
      api.off("select", update);
    };
  }, [api]);

  return (
    <div className="h-full w-full bg-background overflow-x-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden px-3 pt-3 pb-20 space-y-2.5 scrollbar-none md:grid md:auto-rows-max md:grid-cols-2 md:gap-3 md:space-y-0 md:pb-3">
        <MobileStatsGrid
          totalMembros={stats.totalMembros}
          totalReunioes={stats.totalReunioes}
          mediaPresenca={stats.mediaPresenca}
          ultimaReuniao={stats.ultimaReuniao}
        />

        <section aria-label="Atalhos" className="w-full md:col-span-2">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/membros/novo")}
              className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-border/55 bg-card px-2 shadow-none transition-colors hover:bg-accent/30"
            >
              <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-extrabold leading-tight tracking-[0.08em] uppercase">Novo membro</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/reunioes/nova")}
              className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-border/55 bg-card px-2 shadow-none transition-colors hover:bg-accent/30"
            >
              <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <CalendarPlus className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-extrabold leading-tight tracking-[0.08em] uppercase">Reunião</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/calendario?new=1")}
              className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-border/55 bg-card px-2 shadow-none transition-colors hover:bg-accent/30"
            >
              <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="text-[9px] font-extrabold leading-tight tracking-[0.08em] uppercase">Novo evento</span>
            </Button>
          </div>
        </section>

        <section aria-label="Gráficos" className="w-full md:col-span-2">
          <Card className="overflow-hidden rounded-[18px] border-border/55 bg-card text-card-foreground shadow-none">
            <div className="px-1.5 pb-1.5 pt-1.5">
              <Carousel
                setApi={(nextApi) => setApi(nextApi)}
                opts={{ align: "start", loop: false }}
                className="w-full max-w-full"
              >
                <CarouselContent className="ml-0">
                  <CarouselItem className="pl-0">
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      <ReunioesChartWidget size="md" reunioesRecentes={frequenciaData.reunioesRecentes} compactMobile />
                    </div>
                  </CarouselItem>
                  <CarouselItem className="pl-0">
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      {/* sm no mobile evita a legenda e melhora o encaixe em 390px */}
                      <FaixaEtariaWidget size="sm" porFaixaEtaria={frequenciaData.porFaixaEtaria} compactMobile />
                    </div>
                  </CarouselItem>
                  <CarouselItem className="pl-0">
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      <TopMembrosWidget
                        size="sm"
                        top5Membros={frequenciaData.top5Membros}
                        showLeastFrequent={showLeastFrequent}
                        onToggleOrder={onToggleOrder}
                        period={topPeriod}
                        onPeriodChange={onTopPeriodChange}
                      />
                    </div>
                  </CarouselItem>
                </CarouselContent>
              </Carousel>

              <div className="mt-1 flex h-6 items-center justify-center gap-1">
                {Array.from({ length: slideCount }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Ir para o slide ${idx + 1}`}
                    aria-current={idx === selectedIndex ? "true" : undefined}
                    onClick={() => api?.scrollTo(idx)}
                    className="flex h-6 w-6 items-center justify-center outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <span
                      className={`h-1.5 rounded-full transition-all ${
                        idx === selectedIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/25"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="Aniversariantes" className="h-[clamp(260px,38vh,310px)] w-full md:h-[310px]">
          <AniversariantesWidget size="md" aniversariantes={aniversariantes} />
        </section>

        <section aria-label="Notas rápidas" className="h-[clamp(200px,31vh,220px)] w-full md:h-[310px]">
          <NotasWidget size="md" notas={notas} onDelete={onDeleteNota} />
        </section>
      </div>
    </div>
  );
}
