import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type MobileAgendaItem = {
  id: string;
  kind: "evento" | "reuniao" | "visita";
  title: string;
  startISO: string;
  subtitle?: string;
};

function safeDateLabel(iso: string) {
  try {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "EEE, dd/MM", { locale: ptBR }) : iso;
  } catch {
    return iso;
  }
}

export default function MobileCalendario() {
  const { setConfig } = usePageHeader();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MobileAgendaItem[]>([]);

  useEffect(() => {
    setConfig({
      title: "Agenda",
      icon: CalendarDays,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Agenda" }],
      showBackButton: true,
      backTo: "/",
      secondaryActions: (
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => navigate("/calendario")}
        >
          Abrir calendário
        </Button>
      ),
    });
    return () => setConfig(null);
  }, [navigate, setConfig]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString().slice(0, 10);

        const [eventosRes, reunioesRes, visitasRes] = await Promise.all([
          supabase
            .from("eventos")
            .select("id, titulo, data_inicio, tipo")
            .gte("data_inicio", todayIso)
            .order("data_inicio", { ascending: true })
            .limit(50),
          supabase
            .from("reunioes")
            .select("id, data, tema")
            .gte("data", todayIso)
            .order("data", { ascending: true })
            .limit(20),
          supabase
            .from("visitas")
            .select("id, data_visita, motivo")
            .gte("data_visita", todayIso)
            .order("data_visita", { ascending: true })
            .limit(20),
        ]);

        const next: MobileAgendaItem[] = [];

        (eventosRes.data || []).forEach((e: any) => {
          next.push({
            id: e.id,
            kind: "evento",
            title: e.titulo,
            startISO: e.data_inicio,
            subtitle: e.tipo ? String(e.tipo) : undefined,
          });
        });

        (reunioesRes.data || []).forEach((r: any) => {
          next.push({
            id: r.id,
            kind: "reuniao",
            title: "Reunião",
            startISO: `${r.data}T00:00:00.000Z`,
            subtitle: r.tema || "Sem tema",
          });
        });

        (visitasRes.data || []).forEach((v: any) => {
          if (!v.data_visita) return;
          next.push({
            id: v.id,
            kind: "visita",
            title: "Visita",
            startISO: `${v.data_visita}T00:00:00.000Z`,
            subtitle: v.motivo || undefined,
          });
        });

        next.sort((a, b) => a.startISO.localeCompare(b.startISO));
        setItems(next);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MobileAgendaItem[]>();
    for (const item of items) {
      const dayKey = item.startISO.slice(0, 10);
      if (!map.has(dayKey)) map.set(dayKey, []);
      map.get(dayKey)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="h-full w-full px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+11rem)] overflow-y-auto scrollbar-none space-y-3">
        <p className="text-xs text-muted-foreground">Lista rápida de próximos itens.</p>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando…</CardContent>
          </Card>
        ) : grouped.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum item futuro encontrado.</CardContent>
          </Card>
        ) : (
          grouped.map(([day, dayItems]) => (
            <section key={day} className="space-y-2">
              <div className="px-1">
                <h2 className="text-sm font-semibold text-foreground">{safeDateLabel(`${day}T00:00:00.000Z`)}</h2>
              </div>
              <div className="space-y-2">
                {dayItems.map((it) => (
                  <Card key={it.kind + it.id} className="border-border/50 shadow-[var(--shadow-card)]">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm truncate">{it.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                        <Badge variant="secondary" className="mt-1 text-[10px]">{it.kind}</Badge>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => navigate("/calendario")}
                      >
                        Abrir
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
