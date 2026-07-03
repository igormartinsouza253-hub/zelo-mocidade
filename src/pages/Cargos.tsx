import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { usePageHeader } from "@/components/layout/PageHeaderContext";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const cargoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome do cargo e obrigatorio")
    .max(50, "Nome do cargo deve ter no maximo 50 caracteres"),
});

interface Cargo {
  id: string;
  nome: string;
}

interface MembroCargo {
  id: string;
  nome: string;
  foto_url: string | null;
  faixa_etaria: string | null;
  cargos: string[] | null;
}

export default function Cargos() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [membros, setMembros] = useState<MembroCargo[]>([]);
  const [novoCargo, setNovoCargo] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [editName, setEditName] = useState("");
  const [cargoParaExcluir, setCargoParaExcluir] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(false);
  const { setConfig } = usePageHeader();
  const { activeGroupId, loading: loadingActiveGroup } = useActiveGroup();
  const isMobile = useIsMobile();

  useEffect(() => {
    setConfig({
      title: "Cargos",
      icon: Award,
      showBackButton: true,
      backTo: "/",
      mobileSearch: {
        value: addMode ? novoCargo : search,
        onChange: addMode ? setNovoCargo : setSearch,
        placeholder: addMode ? "Nome do cargo" : "Buscar cargos",
        menu: addMode ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cancelar novo cargo"
            onClick={() => {
              setAddMode(false);
              setNovoCargo("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : undefined,
      },
      mobilePrimaryAction: {
        label: addMode ? "Salvar cargo" : "Novo cargo",
        icon: addMode ? CheckCircle2 : Plus,
        onClick: () => {
          if (!addMode) {
            setAddMode(true);
            setNovoCargo("");
            return;
          }
          void handleCreateCargo(novoCargo);
        },
      },
      primaryActions: !isMobile ? (
        <Button type="button" className="gap-2" onClick={() => setAddMode(true)}>
          <Plus className="h-4 w-4" />
          Novo cargo
        </Button>
      ) : undefined,
    });

    return () => setConfig(null);
  }, [addMode, isMobile, novoCargo, search, setConfig]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  const loadData = async () => {
    if (!activeGroupId) {
      setCargos([]);
      setMembros([]);
      return;
    }

    try {
      const [cargosResult, membrosResult] = await Promise.all([
        supabase
          .from("cargos")
          .select("id, nome")
          .eq("group_id", activeGroupId)
          .order("nome"),
        supabase
          .from("membros")
          .select("id, nome, foto_url, faixa_etaria, cargos")
          .eq("group_id", activeGroupId)
          .eq("ativo", true)
          .order("nome"),
      ]);

      if (cargosResult.error) throw cargosResult.error;
      if (membrosResult.error) throw membrosResult.error;

      setCargos(cargosResult.data || []);
      setMembros((membrosResult.data || []) as MembroCargo[]);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
      toast.error("Erro ao carregar cargos");
    }
  };

  const membrosPorCargo = useMemo(() => {
    const map = new Map<string, MembroCargo[]>();

    cargos.forEach((cargo) => {
      map.set(
        cargo.nome,
        membros.filter((membro) => (membro.cargos || []).includes(cargo.nome)),
      );
    });

    return map;
  }, [cargos, membros]);

  const filteredCargos = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cargos;

    return cargos.filter((cargo) => {
      const memberNames = (membrosPorCargo.get(cargo.nome) || []).map((membro) => membro.nome).join(" ");
      return `${cargo.nome} ${memberNames}`.toLowerCase().includes(term);
    });
  }, [cargos, membrosPorCargo, search]);

  const selectedMembers = selectedCargo ? membrosPorCargo.get(selectedCargo.nome) || [] : [];
  const deleteAffectedMembers = cargoParaExcluir ? membrosPorCargo.get(cargoParaExcluir.nome) || [] : [];

  const validateCargoName = (name: string) => {
    const validation = cargoSchema.safeParse({ nome: name.trim() });
    if (!validation.success) {
      toast.error(validation.error.errors[0]?.message || "Nome invalido");
      return null;
    }
    return validation.data.nome;
  };

  const handleCreateCargo = async (name: string) => {
    if (!activeGroupId) {
      toast.error("Selecione um grupo antes de criar cargos.");
      return;
    }

    const nome = validateCargoName(name);
    if (!nome) return;

    const duplicated = cargos.some((cargo) => cargo.nome.toLowerCase() === nome.toLowerCase());
    if (duplicated) {
      toast.error("Este cargo ja existe neste grupo.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("cargos").insert([{ nome, group_id: activeGroupId }]);
      if (error) throw error;

      toast.success("Cargo adicionado com sucesso!");
      setNovoCargo("");
      setAddMode(false);
      await loadData();
    } catch (error: any) {
      console.error("Erro ao adicionar cargo:", error);
      toast.error(error.code === "23505" ? "Este cargo ja existe neste grupo." : "Erro ao adicionar cargo");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (cargo: Cargo) => {
    setEditingCargo(cargo);
    setEditName(cargo.nome);
  };

  const handleRenameCargo = async () => {
    if (!activeGroupId || !editingCargo) return;

    const nextName = validateCargoName(editName);
    if (!nextName) return;

    if (nextName === editingCargo.nome) {
      setEditingCargo(null);
      return;
    }

    const duplicated = cargos.some(
      (cargo) => cargo.id !== editingCargo.id && cargo.nome.toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicated) {
      toast.error("Ja existe outro cargo com este nome.");
      return;
    }

    setLoading(true);
    try {
      const affected = membrosPorCargo.get(editingCargo.nome) || [];

      const { error } = await supabase
        .from("cargos")
        .update({ nome: nextName })
        .eq("id", editingCargo.id)
        .eq("group_id", activeGroupId);
      if (error) throw error;

      const updates = affected.map((membro) => {
        const updatedCargos = (membro.cargos || []).map((cargo) => (cargo === editingCargo.nome ? nextName : cargo));
        return supabase
          .from("membros")
          .update({ cargos: updatedCargos })
          .eq("id", membro.id)
          .eq("group_id", activeGroupId);
      });

      const results = await Promise.all(updates);
      const updateError = results.find((result) => result.error)?.error;
      if (updateError) throw updateError;

      toast.success("Cargo atualizado com sucesso!");
      setEditingCargo(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao renomear cargo:", error);
      toast.error("Erro ao atualizar cargo");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCargo = async () => {
    if (!activeGroupId || !cargoParaExcluir) return;

    setLoading(true);
    try {
      const affected = membrosPorCargo.get(cargoParaExcluir.nome) || [];

      const updates = affected.map((membro) => {
        const updatedCargos = (membro.cargos || []).filter((cargo) => cargo !== cargoParaExcluir.nome);
        return supabase
          .from("membros")
          .update({ cargos: updatedCargos })
          .eq("id", membro.id)
          .eq("group_id", activeGroupId);
      });

      const results = await Promise.all(updates);
      const updateError = results.find((result) => result.error)?.error;
      if (updateError) throw updateError;

      const { error } = await supabase
        .from("cargos")
        .delete()
        .eq("id", cargoParaExcluir.id)
        .eq("group_id", activeGroupId);

      if (error) throw error;

      toast.success("Cargo excluido com sucesso!");
      setCargoParaExcluir(null);
      setSelectedCargo((current) => (current?.id === cargoParaExcluir.id ? null : current));
      await loadData();
    } catch (error) {
      console.error("Erro ao excluir cargo:", error);
      toast.error("Erro ao excluir cargo");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMemberCargo = async (membro: MembroCargo, cargoNome: string) => {
    if (!activeGroupId) return;

    const currentCargos = membro.cargos || [];
    const hasCargo = currentCargos.includes(cargoNome);
    const nextCargos = hasCargo
      ? currentCargos.filter((cargo) => cargo !== cargoNome)
      : [...currentCargos, cargoNome];

    setMembros((prev) =>
      prev.map((item) => (item.id === membro.id ? { ...item, cargos: nextCargos } : item)),
    );

    const { error } = await supabase
      .from("membros")
      .update({ cargos: nextCargos })
      .eq("id", membro.id)
      .eq("group_id", activeGroupId);

    if (error) {
      console.error("Erro ao atualizar cargo do membro:", error);
      toast.error("Erro ao atualizar membro");
      await loadData();
      return;
    }

    toast.success(hasCargo ? "Cargo removido do membro" : "Cargo atribuido ao membro");
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-3 py-3 md:px-6 md:py-6">
      <section className="mb-3 rounded-3xl border border-border/60 bg-card/92 p-3 shadow-[var(--shadow-soft)] md:p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Award className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-foreground md:text-lg">Gerenciamento de cargos</p>
            <p className="text-xs leading-snug text-muted-foreground md:text-sm">
              Organize funcoes do grupo, veja quem ocupa cada cargo e mantenha os membros sincronizados.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-border/55 bg-background/60 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Cargos</p>
            <p className="text-lg font-black text-foreground">{cargos.length}</p>
          </div>
          <div className="rounded-2xl border border-border/55 bg-background/60 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Com membros</p>
            <p className="text-lg font-black text-foreground">
              {cargos.filter((cargo) => (membrosPorCargo.get(cargo.nome) || []).length > 0).length}
            </p>
          </div>
          <div className="rounded-2xl border border-border/55 bg-background/60 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Sem uso</p>
            <p className="text-lg font-black text-foreground">
              {cargos.filter((cargo) => (membrosPorCargo.get(cargo.nome) || []).length === 0).length}
            </p>
          </div>
        </div>
      </section>

      <div className="relative mb-3 hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cargo ou membro"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-2xl border-border/60 bg-background/70 pl-9"
          />
      </div>

      <section className="min-h-0 flex-1 overflow-y-auto pb-52 scrollbar-none md:pb-12">
        {filteredCargos.length === 0 ? (
          <div className="rounded-3xl border border-border/60 bg-card/92 p-8 text-center shadow-[var(--shadow-soft)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
              <Award className="h-6 w-6" />
            </div>
            <p className="text-sm font-black text-foreground">
              {search.trim() ? "Nenhum cargo encontrado" : "Nenhum cargo cadastrado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search.trim() ? "Tente buscar por outro nome." : "Crie o primeiro cargo para organizar os membros."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filteredCargos.map((cargo) => {
              const members = membrosPorCargo.get(cargo.nome) || [];
              const isSelected = selectedCargo?.id === cargo.id;

              return (
                <button
                  key={cargo.id}
                  type="button"
                  onClick={() => setSelectedCargo(cargo)}
                  className={cn(
                    "group rounded-3xl border bg-card/92 p-3 text-left shadow-[var(--shadow-soft)] transition hover:border-primary/60 hover:bg-accent/20",
                    isSelected ? "border-primary/70 ring-2 ring-primary/20" : "border-border/60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Award className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground">{cargo.nome}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {members.length} membro{members.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Badge variant={members.length > 0 ? "default" : "outline"} className="shrink-0 rounded-full">
                          {members.length}
                        </Badge>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 -space-x-2">
                          {members.slice(0, 4).map((membro) => (
                            <Avatar key={membro.id} className="h-7 w-7 rounded-xl border-2 border-card">
                              <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                              <AvatarFallback className="rounded-xl bg-muted text-[10px] font-black">
                                {membro.nome.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {members.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Toque para ver detalhes</span>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            role="button"
                            tabIndex={0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStartEdit(cargo);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                handleStartEdit(cargo);
                              }
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 text-destructive transition hover:bg-destructive/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCargoParaExcluir(cargo);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                setCargoParaExcluir(cargo);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={!!selectedCargo} onOpenChange={(open) => !open && setSelectedCargo(null)}>
        <DialogContent className="left-1/2 flex max-h-[calc(100dvh-2rem)] w-[calc(100dvw-1rem)] max-w-[calc(100dvw-1rem)] flex-col overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex min-w-0 items-center gap-2 px-5 pt-5">
              <Users className="h-4 w-4 text-primary" />
              <span className="min-w-0 truncate">{selectedCargo?.nome}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-3 overflow-hidden px-2 pb-4 sm:px-3">
            <div className="shrink-0 min-w-0 rounded-2xl border border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
              {selectedMembers.length} de {membros.length} membro{membros.length === 1 ? "" : "s"} com este cargo.
            </div>

            <div className="min-h-0 min-w-0 max-w-full flex-1 space-y-2 overflow-x-hidden overflow-y-auto overscroll-contain pr-0 scrollbar-none">
              {membros.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-muted/35 p-4 text-sm text-muted-foreground">
                  Nenhum membro ativo encontrado.
                </div>
              ) : (
                membros.map((membro) => {
                  const hasCargo = selectedCargo ? (membro.cargos || []).includes(selectedCargo.nome) : false;

                  return (
                    <div key={membro.id} className="grid min-w-0 max-w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-2xl border border-border/60 bg-card p-2.5">
                      <Avatar className="h-10 w-10 shrink-0 rounded-2xl border border-border/60">
                        <AvatarImage className="rounded-2xl object-cover" src={membro.foto_url || undefined} alt={membro.nome} />
                        <AvatarFallback className="rounded-2xl bg-primary/10 font-black text-primary">
                          {membro.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-foreground">{membro.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{membro.faixa_etaria || "Sem faixa etaria"}</p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant={hasCargo ? "default" : "outline"}
                        className="h-10 w-10 shrink-0 rounded-2xl sm:w-auto sm:px-3 sm:text-xs"
                        onClick={() => selectedCargo && void handleToggleMemberCargo(membro, selectedCargo.nome)}
                        aria-label={hasCargo ? "Remover cargo" : "Atribuir cargo"}
                      >
                        {hasCargo ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                            <span className="hidden sm:inline">Remover</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 sm:mr-1.5 sm:h-3.5 sm:w-3.5" />
                            <span className="hidden sm:inline">Atribuir</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addMode && !isMobile} onOpenChange={(open) => !open && setAddMode(false)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Novo cargo</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateCargo(novoCargo);
            }}
          >
            <Input
              value={novoCargo}
              onChange={(event) => setNovoCargo(event.target.value)}
              className="h-11 rounded-2xl"
              placeholder="Nome do cargo"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setAddMode(false);
                  setNovoCargo("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-2xl" disabled={loading || !novoCargo.trim()}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCargo} onOpenChange={(open) => !open && setEditingCargo(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="h-11 rounded-2xl"
              placeholder="Nome do cargo"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setEditingCargo(null)}>
                Cancelar
              </Button>
              <Button type="button" className="rounded-2xl" onClick={handleRenameCargo} disabled={loading || !editName.trim()}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cargoParaExcluir} onOpenChange={() => setCargoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cargo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo <span className="font-semibold">{cargoParaExcluir?.nome}</span>?
              {deleteAffectedMembers.length > 0
                ? ` Ele sera removido de ${deleteAffectedMembers.length} membro${deleteAffectedMembers.length === 1 ? "" : "s"}.`
                : " Nenhum membro usa este cargo hoje."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCargo}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
