import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StickyNote, Plus, MoreVertical, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePageHeader } from "@/components/layout/PageHeaderContext";

interface Nota {
  id: string;
  conteudo: string;
  created_at: string;
  user_id: string;
  membro_id: string | null;
  reuniao_id: string | null;
  membro_nome?: string | null;
  reuniao_data?: string | null;
  reuniao_tema?: string | null;
}

export default function Notas() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setConfig } = usePageHeader();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(false);
  const [notaParaExcluir, setNotaParaExcluir] = useState<Nota | null>(null);
  const [selectedNota, setSelectedNota] = useState<Nota | null>(null);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileActionsNota, setMobileActionsNota] = useState<Nota | null>(null);
  const [filtroVinculo, setFiltroVinculo] = useState<"todas" | "membro" | "reuniao" | "sem">("todas");
  const [filtroMembro, setFiltroMembro] = useState<string>("todos");
  const [filtroReuniao, setFiltroReuniao] = useState<string>("todas");

  useEffect(() => {
    loadNotas();
  }, []);

  const clearFilters = () => {
    setFiltroVinculo("todas");
    setFiltroMembro("todos");
    setFiltroReuniao("todas");
  };

  const loadNotas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notas")
        .select("id, conteudo, created_at, user_id, membro_id, reuniao_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const notasBase = (data || []) as Nota[];

      const membroIds = Array.from(
        new Set(notasBase.map((n) => n.membro_id).filter((id): id is string => !!id)),
      );
      const reuniaoIds = Array.from(
        new Set(notasBase.map((n) => n.reuniao_id).filter((id): id is string => !!id)),
      );

      const [membrosResp, reunioesResp] = await Promise.all([
        membroIds.length
          ? supabase.from("membros").select("id, nome").in("id", membroIds)
          : Promise.resolve({ data: [], error: null }),
        reuniaoIds.length
          ? supabase.from("reunioes").select("id, data, tema").in("id", reuniaoIds)
          : Promise.resolve({ data: [], error: null }),
      ] as const);

      if (membrosResp.error) throw membrosResp.error;
      if (reunioesResp.error) throw reunioesResp.error;

      const membrosMap = new Map<string, string>();
      (membrosResp.data || []).forEach((m: any) => {
        membrosMap.set(m.id, m.nome);
      });

      const reunioesMap = new Map<string, { data: string; tema: string | null }>();
      (reunioesResp.data || []).forEach((r: any) => {
        reunioesMap.set(r.id, { data: r.data, tema: r.tema });
      });

      const notasEnriquecidas: Nota[] = notasBase.map((n) => ({
        ...n,
        membro_nome: n.membro_id ? membrosMap.get(n.membro_id) || null : null,
        reuniao_data: n.reuniao_id ? reunioesMap.get(n.reuniao_id)?.data || null : null,
        reuniao_tema: n.reuniao_id ? reunioesMap.get(n.reuniao_id)?.tema || null : null,
      }));

      setNotas(notasEnriquecidas);

      if (!isMobile && notasEnriquecidas.length > 0) {
        setSelectedNota(notasEnriquecidas[0]);
      }
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast.error("Erro ao carregar notas");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNota = async () => {
    if (!notaParaExcluir) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("notas")
        .delete()
        .eq("id", notaParaExcluir.id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Nota excluída com sucesso!");
      if (selectedNota && selectedNota.id === notaParaExcluir.id) {
        setSelectedNota(null);
      }
      setNotaParaExcluir(null);
      loadNotas();
    } catch (error) {
      console.error("Erro ao excluir nota:", error);
      toast.error("Erro ao excluir nota");
    }
  };

  const getPreviewText = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || "";
    return text.length > 140 ? text.slice(0, 140) + "…" : text;
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTituloFromHtml = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = (temp.textContent || temp.innerText || "").trim();
    if (!text) return "(Sem título)";
    return text.length > 80 ? text.slice(0, 80) + "…" : text;
  };

  const isSplitView = !isMobile && !!selectedNota && notas.length > 0;

  const membrosDisponiveis = Array.from(
    new Set(notas.map((n) => n.membro_nome).filter((n): n is string => !!n)),
  );

  const reunioesDisponiveis = Array.from(
    new Map(
      notas
        .filter((n) => n.reuniao_id && n.reuniao_data)
        .map((n) => [
          n.reuniao_id as string,
          {
            id: n.reuniao_id as string,
            data: n.reuniao_data as string,
            tema: n.reuniao_tema || null,
          },
        ]),
    ).values(),
  );

  const notasFiltradas = notas.filter((nota) => {
    if (filtroVinculo === "membro" && !nota.membro_id) return false;
    if (filtroVinculo === "reuniao" && !nota.reuniao_id) return false;
    if (filtroVinculo === "sem" && (nota.membro_id || nota.reuniao_id)) return false;

    if (filtroMembro !== "todos" && nota.membro_nome !== filtroMembro) return false;
    if (filtroReuniao !== "todas" && nota.reuniao_id !== filtroReuniao) return false;

    return true;
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filtroVinculo !== "todas") count += 1;
    if (filtroMembro !== "todos") count += 1;
    if (filtroReuniao !== "todas") count += 1;
    return count;
  }, [filtroMembro, filtroReuniao, filtroVinculo]);

  const FiltersControls = (
    <div className="flex flex-wrap gap-2 text-xs md:text-sm">
      <Select value={filtroVinculo} onValueChange={(v) => setFiltroVinculo(v as any)}>
        <SelectTrigger className="h-8 w-[140px]">
          <SelectValue placeholder="Vínculo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as notas</SelectItem>
          <SelectItem value="membro">Com membro</SelectItem>
          <SelectItem value="reuniao">Com reunião</SelectItem>
          <SelectItem value="sem">Sem vínculo</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filtroMembro} onValueChange={setFiltroMembro} disabled={membrosDisponiveis.length === 0}>
        <SelectTrigger className="h-8 w-[170px]">
          <SelectValue placeholder="Membro" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os membros</SelectItem>
          {membrosDisponiveis.map((nome) => (
            <SelectItem key={nome} value={nome}>
              {nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filtroReuniao} onValueChange={setFiltroReuniao} disabled={reunioesDisponiveis.length === 0}>
        <SelectTrigger className="h-8 w-[190px]">
          <SelectValue placeholder="Reunião" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as reuniões</SelectItem>
          {reunioesDisponiveis.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {new Date(r.data).toLocaleDateString("pt-BR")} {r.tema ? `- ${r.tema}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  useEffect(() => {
    setConfig({
      title: "Notas",
      icon: StickyNote,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Notas" },
      ],
      showBackButton: true,
      backTo: "/",
      primaryActions: !isMobile ? (
        <Button
          size="sm"
          className="gap-1.5 text-xs md:text-sm whitespace-nowrap"
          onClick={() => navigate("/notas/nova")}
        >
          <Plus className="h-3.5 w-3.5" />
          Nova nota
        </Button>
      ) : null,
      secondaryActions: !isMobile ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 gap-2 whitespace-nowrap">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtros</h4>
                {activeFiltersCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={clearFilters}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {FiltersControls}
            </div>
          </PopoverContent>
        </Popover>
      ) : null,
    });

    return () => setConfig(null);
  }, [navigate, setConfig, isMobile, activeFiltersCount, filtroVinculo, filtroMembro, filtroReuniao, membrosDisponiveis.length, reunioesDisponiveis.length]);

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full w-full px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4">
        {isMobile ? (
          <div className="max-w-4xl mx-auto w-full flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">Notas</h2>
                <p className="text-xs text-muted-foreground">
                  {loading ? "Carregando…" : `${notas.length} nota${notas.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto scrollbar-none pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-16 rounded-2xl border border-border bg-card/50" />
                  <div className="h-16 rounded-2xl border border-border bg-card/50" />
                  <div className="h-16 rounded-2xl border border-border bg-card/50" />
                </div>
              ) : notas.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-6">
                  <p className="text-sm text-muted-foreground">ainda não há notas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notas.map((nota) => (
                    <button
                      key={nota.id}
                      type="button"
                      onClick={() => navigate(`/notas/editar/${nota.id}`)}
                      className="w-full text-left rounded-3xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)] active:scale-[0.99] transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{formatDate(nota.created_at)}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground truncate">
                            {getTituloFromHtml(nota.conteudo)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {getPreviewText(nota.conteudo)}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background hover:bg-accent/60 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileActionsNota(nota);
                            setMobileActionsOpen(true);
                          }}
                          aria-label="Ações"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom sheet de ações (mobile) */}
            <Sheet
              open={mobileActionsOpen}
              onOpenChange={(open) => {
                setMobileActionsOpen(open);
                if (!open) setMobileActionsNota(null);
              }}
            >
              <SheetContent
                side="bottom"
                className="rounded-t-3xl px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
              >
                <div className="mx-auto w-full max-w-md">
                  <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-2xl h-12"
                      onClick={() => {
                        if (!mobileActionsNota) return;
                        setMobileActionsOpen(false);
                        navigate(`/notas/editar/${mobileActionsNota.id}`);
                      }}
                      type="button"
                    >
                      Abrir
                    </Button>

                    <Button
                      variant="destructive"
                      className="w-full justify-start rounded-2xl h-12"
                      onClick={() => {
                        if (!mobileActionsNota) return;
                        setMobileActionsOpen(false);
                        setNotaParaExcluir(mobileActionsNota);
                      }}
                      type="button"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Único botão de nova nota (mobile) */}
            <div className="md:hidden fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30">
              <div className="mx-auto w-full max-w-4xl px-3">
                <Button
                  className="w-full h-12 rounded-2xl gap-2"
                  onClick={() => navigate("/notas/nova")}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Nova nota
                </Button>
              </div>
            </div>
          </div>
        ) : isSplitView ? (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Notas salvas</CardTitle>
                  <CardDescription>
                    {loading
                      ? "Carregando notas..."
                      : notasFiltradas.length === 0
                        ? "Nenhuma nota encontrada com os filtros atuais."
                        : "Clique para visualizar e dê duplo clique para editar uma nota."}
                  </CardDescription>
                </div>

                {/* No mobile, mantemos filtros no corpo para não lotar o header */}
                {isMobile ? FiltersControls : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ResizablePanelGroup direction="horizontal" className="min-h-[420px] md:min-h-[520px]">
                <ResizablePanel defaultSize={40} minSize={28}>
                  <div className="space-y-3 p-3 pr-1 md:pr-2 h-full overflow-y-auto pb-16 md:pb-4 scrollbar-thin">
                    {notasFiltradas.map((nota) => (
                      <div
                        key={nota.id}
                        className={cn(
                          "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card",
                          selectedNota?.id === nota.id && "border-primary/60 bg-accent/40",
                        )}
                      >
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => {
                            if (isMobile) {
                              navigate(`/notas/editar/${nota.id}`);
                            } else {
                              setSelectedNota(nota);
                            }
                          }}
                          onDoubleClick={!isMobile ? () => navigate(`/notas/editar/${nota.id}`) : undefined}
                        >
                          <p className="text-xs text-muted-foreground mb-1">{formatDate(nota.created_at)}</p>
                          <p className="text-sm font-medium">{getTituloFromHtml(nota.conteudo)}</p>
                          {(nota.membro_nome || nota.reuniao_data) && (
                            <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                              {nota.membro_nome && <p>Membro: {nota.membro_nome}</p>}
                              {nota.reuniao_data && (
                                <p>
                                  Reunião: {new Date(nota.reuniao_data).toLocaleDateString("pt-BR")}
                                  {nota.reuniao_tema ? ` - ${nota.reuniao_tema}` : ""}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-start justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedNota(nota)}>Visualizar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/notas/editar/${nota.id}`)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setNotaParaExcluir(nota)}>
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={60} minSize={40}>
                  <div className="h-full p-4 overflow-y-auto pb-16 md:pb-4 scrollbar-thin">
                    {selectedNota ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">{formatDate(selectedNota.created_at)}</p>
                          <div className="flex gap-2">
                            {selectedNota.membro_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => navigate(`/membros/visualizar/${selectedNota.membro_id}`)}
                              >
                                Membro
                              </Button>
                            )}
                            {selectedNota.reuniao_id && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => navigate(`/reunioes/visualizar/${selectedNota.reuniao_id}`)}
                              >
                                Reunião
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: selectedNota.conteudo }} />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Selecione uma nota na lista para visualizar aqui.</p>
                    )}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Notas salvas</CardTitle>
                  <CardDescription>
                    {loading
                      ? "Carregando notas..."
                      : notasFiltradas.length === 0
                        ? "Nenhuma nota encontrada com os filtros atuais."
                        : "Clique para visualizar ou editar uma nota."}
                  </CardDescription>
                </div>

                {/* No mobile, mantemos filtros no corpo para não lotar o header */}
                {isMobile ? FiltersControls : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {notasFiltradas.map((nota) => (
                <div key={nota.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/notas/editar/${nota.id}`)}>
                    <p className="text-xs text-muted-foreground mb-1">{formatDate(nota.created_at)}</p>
                    <p className="text-sm font-medium">{getTituloFromHtml(nota.conteudo)}</p>
                    {(nota.membro_nome || nota.reuniao_data) && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        {nota.membro_nome && <p>Membro: {nota.membro_nome}</p>}
                        {nota.reuniao_data && (
                          <p>
                            Reunião: {new Date(nota.reuniao_data).toLocaleDateString("pt-BR")}
                            {nota.reuniao_tema ? ` - ${nota.reuniao_tema}` : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/notas/editar/${nota.id}`)}>Visualizar / Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setNotaParaExcluir(nota)}>
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {!loading && notas.length === 0 && (
                <Button onClick={() => navigate("/notas/nova")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeira nota
                </Button>
              )}
            </CardContent>
          </Card>
        )}


        <AlertDialog open={!!notaParaExcluir} onOpenChange={() => setNotaParaExcluir(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir nota</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta nota? Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteNota}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
