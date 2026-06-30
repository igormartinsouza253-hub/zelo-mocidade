import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Handshake,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLongPress } from "@/hooks/useLongPress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Membro {
  id: string;
  nome: string;
  faixa_etaria: string;
  foto_url: string | null;
}

interface Visita {
  id: string;
  created_at: string;
  data_visita: string | null;
  membro_visitado_id: string;
  motivo: string;
  membros_presentes: string[];
  observacoes: string | null;
  is_past: boolean;
}

interface EnrichedVisita extends Visita {
  membro_visitado_nome: string;
  membro_visitado_avatar: string | null;
}

type Filter = "futuras" | "passadas";

function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ isPast }: { isPast: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        isPast ? "bg-muted text-muted-foreground border-border" : "bg-primary text-primary-foreground border-primary/20",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isPast ? "bg-muted-foreground" : "bg-primary-foreground",
        )}
        aria-hidden="true"
      />
      {isPast ? "Passada" : "Futura"}
    </span>
  );
}

function VisitaCard({
  visita,
  selectionMode,
  selected,
  onToggleSelection,
  onOpen,
  onEnterSelectionMode,
}: {
  visita: EnrichedVisita;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelection: () => void;
  onOpen: () => void;
  onEnterSelectionMode: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const longPress = useLongPress({
    onLongPress: () => {
      if (!prefersReducedMotion && typeof navigator !== "undefined" && "vibrate" in navigator) {
        // feedback sutil
        (navigator as any).vibrate?.(15);
      }
      onEnterSelectionMode();
    },
  });

  return (
    <Card
      className={cn(
        "rounded-2xl transition-colors",
        !prefersReducedMotion && "transition-transform",
        !prefersReducedMotion && pressed && "scale-[0.99]",
        selectionMode && selected && "ring-2 ring-ring",
      )}
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? selected : undefined}
      onClick={() => {
        if (selectionMode) onToggleSelection();
        else onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectionMode) onToggleSelection();
          else onOpen();
        }
      }}
      onPointerDown={() => {
        setPressed(true);
        longPress.onPointerDown();
      }}
      onPointerUp={() => {
        setPressed(false);
        longPress.onPointerUp();
      }}
      onPointerCancel={() => {
        setPressed(false);
        longPress.onPointerCancel();
      }}
      onPointerLeave={() => {
        setPressed(false);
        longPress.onPointerLeave();
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={visita.membro_visitado_avatar || undefined} alt={visita.membro_visitado_nome} />
              <AvatarFallback className="text-xs">
                {visita.membro_visitado_nome
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{visita.membro_visitado_nome}</p>
                <StatusPill isPast={visita.is_past} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{visita.motivo}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDateTime(visita.data_visita)}</span>
              </div>
            </div>
          </div>

          {selectionMode && (
            <div className="pt-1">
              <div
                className={cn(
                  "h-5 w-5 rounded-md border flex items-center justify-center",
                  selected ? "bg-primary text-primary-foreground border-primary/30" : "bg-background border-border",
                )}
                aria-hidden="true"
              >
                {selected && <CheckCircle2 className="h-4 w-4" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MobileVisitas() {
  const navigate = useNavigate();
  const { setConfig } = usePageHeader();

  const [membros, setMembros] = useState<Membro[]>([]);
  const [visitasRaw, setVisitasRaw] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>("futuras");

  const [suggestions, setSuggestions] = useState<Membro[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // seleção por long-press
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // Quando em modo seleção, esconde a dock inferior do app (deixa só a barra de ação).
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("mobileDockVisibility", {
        detail: { hidden: selectionMode },
      }),
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("mobileDockVisibility", {
          detail: { hidden: false },
        }),
      );
    };
  }, [selectionMode]);

  // confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  useEffect(() => {
    setConfig({
      title: "Visitas",
      icon: Handshake,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Visitas" }],
      showBackButton: true,
      backTo: "/",
      mobileActions: (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setSuggestionsOpen(true)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Sugestoes
        </Button>
      ),
      mobilePrimaryAction: {
        label: "Nova visita",
        icon: Plus,
        onClick: () => navigate("/visitas/nova"),
      },
    });

    return () => setConfig(null);
  }, [navigate, setConfig]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (membros.length > 0) void loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membros.length, visitasRaw.length]);

  useEffect(() => {
    const channel = supabase
      .channel("visitas-changes-mobile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitas" },
        () => {
          void loadVisitas();
          void loadSuggestions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      await Promise.all([loadMembros(), loadVisitas()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembros() {
    const { data, error } = await supabase
      .from("membros")
      .select("id, nome, faixa_etaria, foto_url")
      .order("nome");

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar membros");
      return;
    }

    setMembros(data || []);
  }

  async function loadVisitas() {
    const { data, error } = await supabase
      .from("visitas")
      .select("*")
      .order("data_visita", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar visitas");
      return;
    }

    const normalized: Visita[] = (data || []).map((v) => ({
      ...v,
      membros_presentes: (v.membros_presentes || []) as string[],
    }));

    setVisitasRaw(normalized);
  }

  async function loadSuggestions() {
    try {
      setLoadingSuggestions(true);

      const { data: reunioes, error: reunioesError } = await supabase
        .from("reunioes")
        .select("id, data")
        .order("data", { ascending: false })
        .limit(4);

      if (reunioesError) throw reunioesError;

      if (!reunioes || reunioes.length === 0) {
        setSuggestions([]);
        return;
      }

      const reuniaoIds = reunioes.map((r) => r.id);

      const { data: presencas, error: presencasError } = await supabase
        .from("presencas")
        .select("membro_id, reuniao_id")
        .in("reuniao_id", reuniaoIds);

      if (presencasError) throw presencasError;

      const { data: visitasData, error: visitasError } = await supabase
        .from("visitas")
        .select("membro_visitado_id");

      if (visitasError) throw visitasError;

      const membrosQueJaReceberamVisita = new Set(
        (visitasData || []).map((v) => v.membro_visitado_id as string),
      );

      const presentesPorReuniao = new Map<string, Set<string>>();
      (presencas || []).forEach((p) => {
        const set = presentesPorReuniao.get(p.reuniao_id) || new Set<string>();
        set.add(p.membro_id as string);
        presentesPorReuniao.set(p.reuniao_id, set);
      });

      const sugestoes: Membro[] = [];

      for (const membro of membros) {
        if (membrosQueJaReceberamVisita.has(membro.id)) continue;
        if (!['Meninos', 'Meninas', 'Moços', 'Moças'].includes(membro.faixa_etaria)) continue;

        const faltasSeguidas = reuniaoIds.every((reuniaoId) => {
          const presentes = presentesPorReuniao.get(reuniaoId) || new Set<string>();
          return !presentes.has(membro.id);
        });

        if (faltasSeguidas) sugestoes.push(membro);
      }

      setSuggestions(sugestoes);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  const visitasEnriquecidas = useMemo<EnrichedVisita[]>(() => {
    const membrosMap = new Map(membros.map((m) => [m.id, m] as const));
    return visitasRaw.map((v) => {
      const membro = membrosMap.get(v.membro_visitado_id);
      return {
        ...v,
        membro_visitado_nome: membro?.nome ?? "Membro desconhecido",
        membro_visitado_avatar: membro?.foto_url ?? null,
      };
    });
  }, [membros, visitasRaw]);

  const futuras = useMemo(
    () => visitasEnriquecidas.filter((v) => !v.is_past),
    [visitasEnriquecidas],
  );
  const passadas = useMemo(
    () => visitasEnriquecidas.filter((v) => v.is_past),
    [visitasEnriquecidas],
  );

  const data = filter === "futuras" ? futuras : passadas;

  async function handleMarkAsDone(visita: EnrichedVisita) {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitas")
        .update({ is_past: true, data_visita: now })
        .eq("id", visita.id);

      if (error) throw error;
      toast.success("Visita marcada como concluída");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao concluir visita");
    }
  }

  async function handleDeleteMany(ids: string[]) {
    try {
      const { error } = await supabase.from("visitas").delete().in("id", ids);
      if (error) throw error;
      toast.success(ids.length === 1 ? "Visita excluída" : "Visitas excluídas");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir visita");
    }
  }

  async function handleDelete(visita: EnrichedVisita) {
    await handleDeleteMany([visita.id]);
  }

  function handleEdit(visita: EnrichedVisita) {
    navigate(`/visitas/nova?id=${visita.id}`);
  }

  const selectedVisitas = useMemo(() => {
    if (!selectionMode || selectedIds.size === 0) return [] as EnrichedVisita[];
    const set = selectedIds;
    return visitasEnriquecidas.filter((v) => set.has(v.id));
  }, [selectionMode, selectedIds, visitasEnriquecidas]);

  const canConcludeSelected = useMemo(
    () => selectedVisitas.some((v) => !v.is_past),
    [selectedVisitas],
  );

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className={cn("h-full w-full bg-background", selectionMode && "relative")}> 
      {selectionMode && (
        <div
          className="md:hidden fixed inset-0 bg-primary/40 mix-blend-multiply pointer-events-none"
          aria-hidden="true"
        />
      )}
      <section className="relative mx-auto w-full max-w-4xl px-3 pb-28 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="h-9">
              <TabsTrigger value="futuras" className="text-xs">
                Futuras
              </TabsTrigger>
              <TabsTrigger value="passadas" className="text-xs">
                Passadas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <Card className="rounded-2xl">
            <div className="p-6 text-center text-muted-foreground space-y-2">
              <div className="mx-auto h-11 w-11 rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
                {filter === "futuras" ? (
                  <Clock className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <p className="text-sm font-medium text-foreground">
                {filter === "futuras" ? "Nenhuma visita futura" : "Nenhuma visita registrada"}
              </p>
              <p className="text-xs">
                {filter === "futuras"
                  ? "Agende uma nova visita para começar."
                  : "As visitas concluídas aparecerão aqui."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.map((visita) => {
              const selected = selectedIds.has(visita.id);
              return (
                <VisitaCard
                  key={visita.id}
                  visita={visita}
                  selectionMode={selectionMode}
                  selected={selected}
                  onToggleSelection={() => toggleSelection(visita.id)}
                  onOpen={() => navigate(`/visitas/${visita.id}`)}
                  onEnterSelectionMode={() => {
                    setSelectionMode(true);
                    setSelectedIds(new Set([visita.id]));
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

       {/* Action bar do modo seleção */}
       {selectionMode && (
         <div className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
           <div className="mx-auto w-full max-w-4xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
             <div className="flex items-center justify-between gap-2">
               <div className="flex items-center gap-2 min-w-0">
                 <Button
                   type="button"
                   variant="outline"
                   size="icon"
                   className="h-10 w-10"
                   onClick={() => {
                     setSelectionMode(false);
                     setSelectedIds(new Set());
                   }}
                   aria-label="Sair do modo seleção"
                 >
                   <X className="h-4 w-4" />
                 </Button>
                 <p className="text-sm font-medium text-foreground truncate">
                   {selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}
                 </p>
               </div>

               <div className="flex items-center gap-2">
                 <Button
                   type="button"
                   variant="outline"
                   className="h-10"
                   disabled={selectedIds.size !== 1}
                   onClick={() => {
                     const id = Array.from(selectedIds)[0];
                     navigate(`/visitas/nova?id=${id}`);
                   }}
                 >
                   <Pencil className="h-4 w-4 mr-2" />
                   Editar
                 </Button>

                 <Button
                   type="button"
                   variant="outline"
                   className="h-10"
                   disabled={!canConcludeSelected}
                   onClick={() => {
                     // conclui apenas as futuras selecionadas
                     selectedVisitas.filter((v) => !v.is_past).forEach((v) => void handleMarkAsDone(v));

                     setSelectionMode(false);
                     setSelectedIds(new Set());
                   }}
                 >
                   <CheckCircle2 className="h-4 w-4 mr-2" />
                   Concluir
                 </Button>

                 <Button
                   type="button"
                   variant="outline"
                   className="h-10 text-destructive border-destructive/70"
                   disabled={selectedIds.size === 0}
                   onClick={() => {
                     setIdsToDelete(Array.from(selectedIds));
                     setDeleteDialogOpen(true);
                   }}
                 >
                   <Trash2 className="h-4 w-4 mr-2" />
                   Excluir
                 </Button>
               </div>
             </div>
           </div>
         </div>
       )}

       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Excluir visita{idsToDelete.length === 1 ? "" : "s"}?</AlertDialogTitle>
             <AlertDialogDescription>
               {idsToDelete.length === 1
                 ? "Esta ação não pode ser desfeita."
                 : `Esta ação não pode ser desfeita. Você vai excluir ${idsToDelete.length} visitas.`}
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const ids = idsToDelete;
                  void handleDeleteMany(ids);
                  setDeleteDialogOpen(false);
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                  setIdsToDelete([]);
                }}
              >
               Excluir
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>

       <Dialog open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
         <DialogContent className="max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <AlertTriangle className="h-4 w-4 text-warning" />
               Sugestões de visita
             </DialogTitle>
           </DialogHeader>

           <div className="space-y-3 max-h-[420px] overflow-y-auto">
             <p className="text-xs text-muted-foreground">
               Com base nas últimas reuniões de jovens, estes membros estão há algumas semanas sem aparecer e ainda não
               receberam uma visita registrada.
             </p>

             {loadingSuggestions ? (
               <div className="space-y-2">
                 {[1, 2, 3].map((i) => (
                   <Skeleton key={i} className="h-12 w-full rounded-lg" />
                 ))}
               </div>
             ) : suggestions.length === 0 ? (
               <p className="text-xs text-muted-foreground">
                 Nenhum jovem em situação crítica de faltas nas últimas reuniões.
               </p>
             ) : (
               <div className="space-y-2">
                 {suggestions.map((m) => (
                   <div
                     key={m.id}
                     className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2"
                   >
                     <div className="flex items-center gap-2 min-w-0">
                       <Avatar className="h-8 w-8">
                         <AvatarImage src={m.foto_url || undefined} alt={m.nome} />
                         <AvatarFallback className="text-[10px]">
                           {m.nome
                             .split(" ")
                             .map((n) => n[0])
                             .join("")
                             .slice(0, 2)
                             .toUpperCase()}
                         </AvatarFallback>
                       </Avatar>
                       <div className="flex flex-col min-w-0">
                         <p className="text-xs font-medium text-foreground truncate">{m.nome}</p>
                         <p className="text-[11px] text-muted-foreground truncate">
                           {m.faixa_etaria} • Faltou às últimas reuniões
                         </p>
                       </div>
                     </div>
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       className="h-7 text-[11px] flex-shrink-0"
                       onClick={() => {
                         setSuggestionsOpen(false);
                         navigate(`/visitas/nova?membroId=${m.id}`);
                       }}
                     >
                       Agendar
                     </Button>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </DialogContent>
       </Dialog>
     </main>
   );
 }
