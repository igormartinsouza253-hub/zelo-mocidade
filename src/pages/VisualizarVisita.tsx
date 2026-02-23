import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Calendar, CheckCircle2, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  foto_url: string | null;
  faixa_etaria: string;
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

export default function VisualizarVisita() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [visita, setVisita] = useState<Visita | null>(null);
  const [membro, setMembro] = useState<Membro | null>(null);
  const [presentes, setPresentes] = useState<Membro[]>([]);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    void load(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load(visitaId: string) {
    try {
      setLoading(true);

      const { data: visitaData, error: visitaError } = await supabase
        .from("visitas")
        .select("*")
        .eq("id", visitaId)
        .single<Visita>();

      if (visitaError) throw visitaError;
      if (!visitaData) throw new Error("not_found");

      const normalized: Visita = {
        ...visitaData,
        membros_presentes: (visitaData.membros_presentes || []) as string[],
      };

      setVisita(normalized);

      const { data: membroData } = await supabase
        .from("membros")
        .select("id, nome, foto_url, faixa_etaria")
        .eq("id", normalized.membro_visitado_id)
        .maybeSingle<Membro>();

      setMembro(membroData ?? null);

      if (normalized.membros_presentes.length > 0) {
        const { data: presentesData } = await supabase
          .from("membros")
          .select("id, nome, foto_url, faixa_etaria")
          .in("id", normalized.membros_presentes);

        setPresentes((presentesData as any) || []);
      } else {
        setPresentes([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar visita");
      navigate("/visitas", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  const isFuture = useMemo(() => (visita ? !visita.is_past : false), [visita]);

  async function handleConcluir() {
    if (!visita) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("visitas")
        .update({ is_past: true, data_visita: now })
        .eq("id", visita.id);
      if (error) throw error;

      toast.success("Visita marcada como concluída");
      setVisita((prev) => (prev ? { ...prev, is_past: true, data_visita: now } : prev));
    } catch (e) {
      console.error(e);
      toast.error("Erro ao concluir visita");
    }
  }

  async function handleExcluir() {
    if (!visita) return;

    try {
      const { error } = await supabase.from("visitas").delete().eq("id", visita.id);
      if (error) throw error;

      toast.success("Visita excluída");
      navigate("/visitas", { replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir visita");
    }
  }

  return (
    <div className="h-full w-full bg-background">
      {/* Top action bar própria (sem header padrão do app) */}
      <div className="md:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="h-14 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/visitas")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Visita</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {visita ? (visita.is_past ? "Passada" : "Futura") : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {visita && isFuture && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10"
                onClick={() => void handleConcluir()}
                aria-label="Marcar como concluída"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            )}
            {visita && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10"
                onClick={() => navigate(`/visitas/nova?id=${visita.id}`)}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 text-destructive border-destructive/70"
                onClick={() => setDeleteOpen(true)}
                aria-label="Excluir"
                disabled={!visita}
              >
                <Trash2 className="h-4 w-4" />
              </Button>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleExcluir()}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-4xl px-3 py-4 pb-24 space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : !visita ? null : (
          <>
            <Card className="rounded-2xl">
              <div className="p-4 flex items-start gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={membro?.foto_url || undefined} alt={membro?.nome || "Membro"} />
                  <AvatarFallback className="text-xs">
                    {(membro?.nome || "M")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground truncate">
                    {membro?.nome || "Membro"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">{visita.motivo}</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={cn(!visita.data_visita && "text-muted-foreground")}>
                      {formatDateTime(visita.data_visita)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl">
              <div className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Observações
                </p>
                <p className={cn("text-sm", visita.observacoes ? "text-foreground" : "text-muted-foreground")}>
                  {visita.observacoes || "—"}
                </p>
              </div>
            </Card>

            <Card className="rounded-2xl">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Membros presentes</p>
                </div>

                {presentes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum membro informado.</p>
                ) : (
                  <div className="space-y-2">
                    {presentes.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={p.foto_url || undefined} alt={p.nome} />
                          <AvatarFallback className="text-[11px]">
                            {p.nome
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.faixa_etaria}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
