import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MessageCircle, UserPlus } from "lucide-react";
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
  const slideHeightClass = "h-[clamp(280px,38vh,340px)]";

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
      <div className="h-full w-full overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24 space-y-3 scrollbar-none">
        <MobileStatsGrid
          totalMembros={stats.totalMembros}
          totalReunioes={stats.totalReunioes}
          mediaPresenca={stats.mediaPresenca}
          ultimaReuniao={stats.ultimaReuniao}
        />

        <section aria-label="Atalhos" className="w-full">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/membros/novo")}
              className="h-24 rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow flex flex-col items-center justify-center gap-2"
            >
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                <UserPlus className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Novo membro</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/reunioes/nova")}
              className="h-24 rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow flex flex-col items-center justify-center gap-2"
            >
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Reunião</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/calendario?new=1")}
              className="h-24 rounded-3xl border-border/50 bg-card shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow flex flex-col items-center justify-center gap-2"
            >
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase">Novo evento</span>
            </Button>
          </div>
        </section>

        <section aria-label="Gráficos" className="w-full">
          <Card className="bg-card text-card-foreground border-border/50 shadow-[var(--shadow-card)] md:rounded-[2.5rem] overflow-hidden">
            <div className="p-3">
              <Carousel
                setApi={(nextApi) => setApi(nextApi)}
                opts={{ align: "start", loop: false }}
                className="w-full max-w-full overflow-hidden"
              >
                <CarouselContent>
                  <CarouselItem>
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      <ReunioesChartWidget size="md" reunioesRecentes={frequenciaData.reunioesRecentes} />
                    </div>
                  </CarouselItem>
                  <CarouselItem>
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      {/* sm no mobile evita a legenda e melhora o encaixe em 390px */}
                      <FaixaEtariaWidget size="sm" porFaixaEtaria={frequenciaData.porFaixaEtaria} />
                    </div>
                  </CarouselItem>
                  <CarouselItem>
                    <div className={slideHeightClass + " w-full min-w-0"}>
                      <TopMembrosWidget
                        size="md"
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

              <div className="mt-2 flex items-center justify-center gap-1.5">
                {Array.from({ length: slideCount }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={`Ir para o slide ${idx + 1}`}
                    onClick={() => api?.scrollTo(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === selectedIndex ? "w-8 bg-primary" : "w-3 bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="Aniversariantes" className="w-full">
          <AniversariantesWidget size="md" aniversariantes={aniversariantes} />
        </section>

        <section aria-label="Notas rápidas" className="w-full">
          <NotasWidget size="md" notas={notas} onDelete={onDeleteNota} />
        </section>
      </div>
    </div>
  );
}
