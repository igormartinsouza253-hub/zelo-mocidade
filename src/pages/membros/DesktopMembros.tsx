import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Search,
  Trash2,
  MoreVertical,
  IdCard,
  Pencil,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { toast } from "sonner";
import { MemberDetailPanel } from "@/components/membros/MemberDetailPanel";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";

interface Membro {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cargos: string[] | null;
  faixa_etaria: string;
  foto_url: string | null;
  ativo?: boolean;
  inativado_em?: string | null;
  inativado_motivo?: string | null;
  inativado_observacao?: string | null;
  observacoes?: string | null;
  telefone?: string | null;
  status_telefone?: string | null;
  presencas?: number;
}

interface Cargo {
  id: string;
  nome: string;
}

type SortOption = "nome" | "idade" | "frequencia";
type SortDirection = "asc" | "desc";

const Membros = ({ __forceMobile, __forceDesktop }: { __forceMobile?: boolean; __forceDesktop?: boolean } = {}) => {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(() => {
    const saved = localStorage.getItem("membros_show_inactive");
    return saved ? saved === "true" : false;
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem("membros_sort") as SortOption) || "nome";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    return (localStorage.getItem("membros_sort_direction") as SortDirection) || "asc";
  });
  const [cargosDisponiveis, setCargosDisponiveis] = useState<Cargo[]>([]);
  const [selectedCargos, setSelectedCargos] = useState<string[]>(() => {
    const saved = localStorage.getItem("membros_filters_cargos");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedFaixas, setSelectedFaixas] = useState<string[]>(() => {
    const saved = localStorage.getItem("membros_filters_faixas");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [inactivateTargetIds, setInactivateTargetIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [listMode, setListMode] = useState<"compact" | "comfortable">("comfortable");
  const [selectedMembro, setSelectedMembro] = useState<Membro | null>(null);
  const [loadingMembros, setLoadingMembros] = useState(true);
  const [expandedMembroId, setExpandedMembroId] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const navigate = useNavigate();
  const isMobile = __forceMobile ? true : __forceDesktop ? false : useIsMobile();
  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];
  const { setConfig } = usePageHeader();
  const { activeGroup, isAdmin } = useActiveGroup();

  const hasSelected = selectedIds.length > 0;

  useEffect(() => {
    loadMembros();
    loadCargos();
  }, []);

  useEffect(() => {
    localStorage.setItem("membros_sort", sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem("membros_sort_direction", sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem("membros_show_inactive", String(showInactive));
  }, [showInactive]);

  useEffect(() => {
    localStorage.setItem("membros_filters_cargos", JSON.stringify(selectedCargos));
  }, [selectedCargos]);

  useEffect(() => {
    localStorage.setItem("membros_filters_faixas", JSON.stringify(selectedFaixas));
  }, [selectedFaixas]);

  useEffect(() => {
    if (isMobile) return;
    setListMode(selectedMembro ? "compact" : "comfortable");
  }, [selectedMembro, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    if (selectionMode) setExpandedMembroId(null);
  }, [isMobile, selectionMode]);

  useEffect(() => {
    setConfig({
      title: "Membros",
      icon: Users,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Membros" },
      ],
      showBackButton: true,
      backTo: "/",
      // No desktop, os controles ficam todos na barra superior (uma linha).
      // No mobile, mantemos os controles dentro da página para não lotar o header.
      primaryActions: !isMobile ? (
        <Button
          size="sm"
          className="gap-1.5 text-xs md:text-sm whitespace-nowrap"
          onClick={() => navigate("/membros/novo")}
        >
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
          Novo membro
        </Button>
      ) : null,
      secondaryActions: !isMobile ? (
        <>
          <Input
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[220px] text-sm"
          />

          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <SelectTrigger className="h-9 w-[170px] text-sm">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome</SelectItem>
              <SelectItem value="idade">Idade</SelectItem>
              <SelectItem value="frequencia">Frequência</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={toggleSortDirection}
            title={sortDirection === "asc" ? "Ordem crescente" : "Ordem decrescente"}
          >
            {sortDirection === "asc" ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-2 whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {(selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {selectedCargos.length + selectedFaixas.length + (showInactive ? 1 : 0)}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filtros</h4>
                  {(selectedCargos.length > 0 || selectedFaixas.length > 0) && (
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

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargos</Label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {cargosDisponiveis.map((cargo) => (
                      <div key={cargo.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-cargo-${cargo.id}`}
                          checked={selectedCargos.includes(cargo.nome)}
                          onCheckedChange={() => toggleCargo(cargo.nome)}
                        />
                        <label
                          htmlFor={`filter-cargo-${cargo.id}`}
                          className="text-sm leading-none cursor-pointer"
                        >
                          {cargo.nome}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Faixa Etária</Label>
                  <div className="space-y-2">
                    {faixasEtarias.map((faixa) => (
                      <div key={faixa} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-faixa-${faixa}`}
                          checked={selectedFaixas.includes(faixa)}
                          onCheckedChange={() => toggleFaixa(faixa)}
                        />
                        <label
                          htmlFor={`filter-faixa-${faixa}`}
                          className="text-sm leading-none cursor-pointer"
                        >
                          {faixa}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Exibição</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-show-inactive"
                      checked={showInactive}
                      onCheckedChange={(checked) => setShowInactive(Boolean(checked))}
                    />
                    <label htmlFor="filter-show-inactive" className="text-sm leading-none cursor-pointer">
                      Mostrar inativos
                    </label>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setSelectionMode((prev) => !prev);
                  setSelectedIds([]);
                }}
              >
                {selectionMode ? "Sair do modo seleção" : "Selecionar para excluir"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                disabled={selectedIds.length === 0 || deleting}
                onClick={() => openInactivateDialog(selectedIds)}
              >
                Excluir selecionados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null,
    });

    return () => setConfig(null);
  }, [
    navigate,
    setConfig,
    isMobile,
    search,
    sortBy,
    sortDirection,
    selectedCargos,
    selectedFaixas,
    cargosDisponiveis,
    selectionMode,
    selectedIds,
    deleting,
  ]);

  const loadCargos = async () => {
    try {
      const { data, error } = await supabase.from("cargos").select("*").order("nome");
      if (error) throw error;
      setCargosDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
    }
  };

  const loadMembros = async () => {
    try {
      setLoadingMembros(true);
      const { data: membrosData, error: membrosError } = await supabase.from("membros").select("*");
      if (membrosError) throw membrosError;

      const membrosComPresencas = await Promise.all(
        (membrosData || []).map(async (membro) => {
          const { count } = await supabase
            .from("presencas")
            .select("*", { count: "exact", head: true })
            .eq("membro_id", membro.id);

          return {
            ...membro,
            presencas: count || 0,
          };
        }),
      );

      setMembros(membrosComPresencas);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
    } finally {
      setLoadingMembros(false);
    }
  };

  const calcularIdade = (dataNascimento: string | null) => {
    if (!dataNascimento) return null;
    const hoje = new Date();
    const nascimento = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  };

  const toggleCargo = (cargoNome: string) => {
    setSelectedCargos((prev) => (prev.includes(cargoNome) ? prev.filter((c) => c !== cargoNome) : [...prev, cargoNome]));
  };

  const toggleFaixa = (faixa: string) => {
    setSelectedFaixas((prev) => (prev.includes(faixa) ? prev.filter((f) => f !== faixa) : [...prev, faixa]));
  };

  const removeCargo = (cargoNome: string) => {
    setSelectedCargos((prev) => prev.filter((c) => c !== cargoNome));
  };

  const removeFaixa = (faixa: string) => {
    setSelectedFaixas((prev) => prev.filter((f) => f !== faixa));
  };

  const clearFilters = () => {
    setSelectedCargos([]);
    setSelectedFaixas([]);
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const sortMembros = (lista: Membro[]) => {
    const sorted = [...lista];
    const direction = sortDirection === "asc" ? 1 : -1;

    switch (sortBy) {
      case "nome":
        return sorted.sort((a, b) => direction * a.nome.localeCompare(b.nome));
      case "idade":
        return sorted.sort((a, b) => {
          const idadeA = calcularIdade(a.data_nascimento);
          const idadeB = calcularIdade(b.data_nascimento);
          if (idadeA === null) return 1;
          if (idadeB === null) return -1;
          return direction * (idadeA - idadeB);
        });
      case "frequencia":
        return sorted.sort((a, b) => direction * ((a.presencas || 0) - (b.presencas || 0)));
      default:
        return sorted;
    }
  };

  const filteredMembros = sortMembros(
    membros.filter((membro) => {
      if (!showInactive && membro.ativo === false) return false;

      const termo = search.toLowerCase().trim();
      const matchesSearch =
        !termo ||
        membro.nome.toLowerCase().includes(termo) ||
        (membro.telefone ?? "").toLowerCase().includes(termo) ||
        (membro.faixa_etaria ?? "").toLowerCase().includes(termo) ||
        (membro.cargos ?? []).some((cargo) => cargo.toLowerCase().includes(termo));
      const matchesCargo =
        selectedCargos.length === 0 || selectedCargos.some((cargo) => membro.cargos?.includes(cargo));
      const matchesFaixa = selectedFaixas.length === 0 || selectedFaixas.includes(membro.faixa_etaria);
      return matchesSearch && matchesCargo && matchesFaixa;
    }),
  );

  const allSelected =
    filteredMembros.length > 0 && filteredMembros.every((m) => selectedIds.includes(m.id));

  const toggleSelectMembro = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const startLongPress = (membroId: string) => {
    clearLongPress();
    longPressTriggeredRef.current = false;

    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSelectionMode(true);
      setExpandedMembroId(null);
      setSelectedIds((prev) => (prev.includes(membroId) ? prev : [membroId]));
    }, 450);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredMembros.some((m) => m.id === id)));
    } else {
      const idsToAdd = filteredMembros
        .map((m) => m.id)
        .filter((id) => !selectedIds.includes(id));
      setSelectedIds((prev) => [...prev, ...idsToAdd]);
    }
  };

  const openInactivateDialog = (ids: string[]) => {
    setInactivateTargetIds(ids);
    setInactivateDialogOpen(true);
  };

  const handleConfirmInactivate = async ({ reason, note }: { reason: string; note: string | null }) => {
    if (inactivateTargetIds.length === 0) return;

    setDeleting(true);

    try {
      const { error: membrosError } = await supabase
        .from("membros")
        .update({
          ativo: false,
          inativado_em: new Date().toISOString(),
          inativado_motivo: reason,
          inativado_observacao: note,
        })
        .in("id", inactivateTargetIds);

      if (membrosError) throw membrosError;

      toast.success(
        inactivateTargetIds.length === 1 ? "Membro inativado com sucesso." : "Membros inativados com sucesso.",
      );

      // se o membro aberto no painel foi inativado, fechamos o painel
      if (selectedMembro && inactivateTargetIds.includes(selectedMembro.id)) {
        setSelectedMembro(null);
      }

      setSelectedIds([]);
      await loadMembros();
    } catch (error) {
      console.error("Erro ao inativar membro(s):", error);
      toast.error("Erro ao inativar membro(s)");
    } finally {
      setDeleting(false);
      setInactivateDialogOpen(false);
      setInactivateTargetIds([]);
    }
  };

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full px-3 py-3 md:px-4 md:py-4 gap-0">
        {/* Controles (Mobile): busca no topo + menu 3 pontos (compacto) */}
        {isMobile && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar membro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 pl-9 rounded-2xl"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground"
                    aria-label="Opções"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <div className="px-2 py-2 space-y-2">
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                        <SelectTrigger className="h-9 w-full text-xs rounded-2xl">
                          <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                          <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nome">Nome</SelectItem>
                          <SelectItem value="idade">Idade</SelectItem>
                          <SelectItem value="frequencia">Frequência</SelectItem>
                        </SelectContent>
                      </Select>

                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-foreground"
                        onClick={toggleSortDirection}
                        title={sortDirection === "asc" ? "Ordem crescente" : "Ordem decrescente"}
                      >
                        {sortDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full inline-flex items-center justify-between gap-2 rounded-2xl border border-border bg-background px-3 h-9 text-xs"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5" />
                            Filtros
                          </span>
                          {(selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                              {selectedCargos.length + selectedFaixas.length + (showInactive ? 1 : 0)}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="end">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm">Filtros</h4>
                            {(selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
                              <button
                                className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  clearFilters();
                                  setShowInactive(false);
                                }}
                              >
                                Limpar
                              </button>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Cargos</Label>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">
                              {cargosDisponiveis.map((cargo) => (
                                <div key={cargo.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`filter-cargo-${cargo.id}`}
                                    checked={selectedCargos.includes(cargo.nome)}
                                    onCheckedChange={() => toggleCargo(cargo.nome)}
                                  />
                                  <label
                                    htmlFor={`filter-cargo-${cargo.id}`}
                                    className="text-sm leading-none cursor-pointer"
                                  >
                                    {cargo.nome}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Faixa Etária</Label>
                            <div className="space-y-2">
                              {faixasEtarias.map((faixa) => (
                                <div key={faixa} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`filter-faixa-${faixa}`}
                                    checked={selectedFaixas.includes(faixa)}
                                    onCheckedChange={() => toggleFaixa(faixa)}
                                  />
                                  <label
                                    htmlFor={`filter-faixa-${faixa}`}
                                    className="text-sm leading-none cursor-pointer"
                                  >
                                    {faixa}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Exibição</Label>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="filter-show-inactive-mobile"
                                checked={showInactive}
                                onCheckedChange={(checked) => setShowInactive(Boolean(checked))}
                              />
                              <label
                                htmlFor="filter-show-inactive-mobile"
                                className="text-sm leading-none cursor-pointer"
                              >
                                Mostrar inativos
                              </label>
                            </div>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      setSelectionMode((prev) => !prev);
                      setSelectedIds([]);
                    }}
                  >
                    {selectionMode ? "Sair do modo seleção" : "Selecionar para excluir"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {(selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
              <div className="flex flex-wrap gap-2">
                {selectedCargos.map((cargo) => (
                  <Badge key={cargo} variant="secondary" className="gap-1">
                    {cargo}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeCargo(cargo)} />
                  </Badge>
                ))}
                {selectedFaixas.map((faixa) => (
                  <Badge key={faixa} variant="secondary" className="gap-1">
                    {faixa}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => removeFaixa(faixa)} />
                  </Badge>
                ))}
                {showInactive && (
                  <Badge variant="secondary" className="gap-1">
                    Inativos
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setShowInactive(false)} />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chips de filtros (Desktop): mantém visível sem duplicar botões */}
        {!isMobile && (selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedCargos.map((cargo) => (
              <Badge key={cargo} variant="secondary" className="gap-1">
                {cargo}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeCargo(cargo)} />
              </Badge>
            ))}
            {selectedFaixas.map((faixa) => (
              <Badge key={faixa} variant="secondary" className="gap-1">
                {faixa}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFaixa(faixa)} />
              </Badge>
            ))}
            {showInactive && (
              <Badge variant="secondary" className="gap-1">
                Inativos
                <X className="h-3 w-3 cursor-pointer" onClick={() => setShowInactive(false)} />
              </Badge>
            )}
          </div>
        )}

        {/* Barra de seleção em massa */}
        {selectionMode && filteredMembros.length > 0 && (
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-membros"
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
              />
              <label htmlFor="select-all-membros" className="text-xs md:text-sm">
                Selecionar todos
              </label>
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center rounded-2xl border text-xs md:text-sm h-8 px-3 gap-1.5 md:gap-2",
                hasSelected && !deleting
                  ? "bg-destructive text-destructive-foreground border-destructive/80"
                  : "bg-background text-muted-foreground border-border",
              )}
              onClick={() => openInactivateDialog(selectedIds)}
              disabled={!hasSelected || deleting}
            >
              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
              Excluir selecionados
            </button>
          </div>
        )}

        {/* Conteúdo principal: lista + painel detalhado */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loadingMembros ? (
            <div
              className={cn(
                "space-y-2 md:space-y-3 h-full overflow-y-auto pr-1 md:pr-2",
                isMobile
                  ? "scrollbar-none"
                  : "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30",
              )}
            >
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className={cn(
                    "h-12 md:h-14",
                    isMobile ? "rounded-2xl" : "rounded-3xl",
                  )}
                />
              ))}
            </div>
          ) : !isMobile && selectedMembro ? (
            <ResizablePanelGroup
              direction="horizontal"
              className="flex-1 min-h-0 gap-4 md:gap-6 transition-all duration-300 ease-in-out md:pl-1"
            >
              {/* Lista à esquerda (modo compacto quando há membro selecionado) */}
              <ResizablePanel defaultSize={35} minSize={24}>
                <div className="md:border-r md:border-border/60 md:pr-4 md:pt-1 h-full overflow-hidden transition-all duration-300 ease-in-out">
                <div
                  className={cn(
                    "space-y-2 md:space-y-3 h-full overflow-y-auto pr-1 md:pr-2 pb-16 md:pb-4 animate-fade-in",
                    "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30",
                    "md:translate-x-[-4px]",
                  )}
                >
                    {filteredMembros.map((membro) => (
                      <div
                        key={membro.id}
                        className={cn(
                          "shadow-[var(--shadow-soft)] border border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer bg-card",
                          isMobile ? "rounded-2xl" : "rounded-3xl",
                          selectedMembro?.id === membro.id && "border-primary bg-primary/5",
                        )}
                        onClick={() => {
                          setSelectedMembro(membro);
                        }}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-3 md:gap-4 p-2 md:p-3",
                            listMode === "comfortable" && "md:p-3.5",
                          )}
                        >
                          {selectionMode && (
                            <div
                              className="flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedIds.includes(membro.id)}
                                onCheckedChange={() => toggleSelectMembro(membro.id)}
                                aria-label="Selecionar membro"
                              />
                            </div>
                          )}
                          <Avatar className="h-10 w-10 md:h-11 md:w-11 flex-shrink-0">
                            <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm md:text-base">
                              {membro.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                                {membro.nome}
                              </h3>
                              {membro.ativo === false && (
                                <Badge variant="destructive" className="h-5 px-2 text-[10px] rounded-full">
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            {listMode === "comfortable" ? (
                              <>
                                <div className="flex gap-1.5 md:gap-2 text-[11px] md:text-xs text-muted-foreground flex-wrap">
                                  {calcularIdade(membro.data_nascimento) && (
                                    <>
                                      <span>{calcularIdade(membro.data_nascimento)} anos</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  {membro.cargos && membro.cargos.length > 0 && (
                                    <>
                                      <span className="truncate">{membro.cargos[0]}</span>
                                      <span>•</span>
                                    </>
                                  )}
                                  <span className="capitalize">{membro.faixa_etaria}</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>Presenças:</span>
                                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                                    {membro.presencas ?? 0}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-[11px] md:text-xs text-muted-foreground capitalize mt-0.5">
                                  {membro.faixa_etaria}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>Presenças:</span>
                                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                                    {membro.presencas ?? 0}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <div
                            className="flex items-start justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="inline-flex items-center justify-center rounded-full h-8 w-8 md:h-9 md:w-9 hover:bg-muted"
                                  aria-label="Ações do membro"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                                >
                                  Visualizar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/membros/editar/${membro.id}`)}
                                >
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => openInactivateDialog([membro.id])}
                                >
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}

                    {filteredMembros.length === 0 && (
                      <div className="text-center py-12">
                        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          {search ? "Nenhum membro encontrado" : "Nenhum membro cadastrado ainda"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="mx-1 md:mx-2" />

              {/* Painel de detalhes à direita */}
              <ResizablePanel defaultSize={65} minSize={40}>
                <div className="md:pt-1 h-full overflow-hidden animate-enter flex flex-col">
                  <div className="flex justify-end mb-2">
                    <button
                      className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground h-8 px-3 text-xs md:text-sm"
                      onClick={() => setSelectedMembro(null)}
                    >
                      Voltar para lista
                    </button>
                  </div>
                  {selectedMembro && (
                    <MemberDetailPanel
                      membro={selectedMembro}
                      onEdit={(id) => navigate(`/membros/editar/${id}`)}
                      onDeleted={() => {
                        setSelectedMembro(null);
                        loadMembros();
                      }}
                    />
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            // Lista única (mobile ou sem membro selecionado)
            <div className="md:pt-1 h-full overflow-hidden">
              <div
                className={cn(
                  "space-y-2 md:space-y-3 h-full overflow-y-auto pr-1 md:pr-2 pb-16 md:pb-4 animate-fade-in",
                  isMobile
                    ? "scrollbar-none"
                    : "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30",
                )}
              >
                {filteredMembros.map((membro) => (
                  <div
                    key={membro.id}
                    className={cn(
                      "shadow-[var(--shadow-soft)] border border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer bg-card",
                      isMobile ? "rounded-2xl" : "rounded-3xl",
                      selectedMembro?.id === membro.id && "border-primary bg-primary/5",
                    )}
                    onPointerDown={() => {
                      if (!isMobile) return;
                      if (selectionMode) return;
                      startLongPress(membro.id);
                    }}
                    onPointerUp={() => {
                      if (!isMobile) return;
                      clearLongPress();
                    }}
                    onPointerCancel={() => {
                      if (!isMobile) return;
                      clearLongPress();
                    }}
                    onPointerLeave={() => {
                      if (!isMobile) return;
                      clearLongPress();
                    }}
                    onClick={() => {
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      if (selectionMode) {
                        toggleSelectMembro(membro.id);
                        return;
                      }
                      if (isMobile) {
                        setExpandedMembroId((prev) => (prev === membro.id ? null : membro.id));
                        return;
                      }
                      setSelectedMembro(membro);
                    }}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 md:gap-4 p-2 md:p-3",
                        listMode === "comfortable" && "md:p-3.5",
                      )}
                    >
                      {selectionMode && (
                        <div
                          className="flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.includes(membro.id)}
                            onCheckedChange={() => toggleSelectMembro(membro.id)}
                            aria-label="Selecionar membro"
                          />
                        </div>
                      )}
                      <Avatar className="h-10 w-10 md:h-11 md:w-11 flex-shrink-0">
                        <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm md:text-base">
                          {membro.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                            {membro.nome}
                          </h3>
                          {membro.ativo === false && (
                            <Badge variant="destructive" className="h-5 px-2 text-[10px] rounded-full">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        {listMode === "comfortable" ? (
                          <>
                            <div className="flex gap-1.5 md:gap-2 text-[11px] md:text-xs text-muted-foreground flex-wrap">
                              {calcularIdade(membro.data_nascimento) && (
                                <>
                                  <span>{calcularIdade(membro.data_nascimento)} anos</span>
                                  <span>•</span>
                                </>
                              )}
                              {membro.cargos && membro.cargos.length > 0 && (
                                <>
                                  <span className="truncate">{membro.cargos[0]}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span className="capitalize">{membro.faixa_etaria}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>Presenças:</span>
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                                {membro.presencas ?? 0}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] md:text-xs text-muted-foreground capitalize mt-0.5">
                              {membro.faixa_etaria}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>Presenças:</span>
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                                {membro.presencas ?? 0}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {!isMobile && (
                        <div
                          className="flex items-start justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="inline-flex items-center justify-center rounded-full h-8 w-8 md:h-9 md:w-9 hover:bg-muted"
                                aria-label="Ações do membro"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                              >
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/membros/editar/${membro.id}`)}
                              >
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => openInactivateDialog([membro.id])}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>

                    {isMobile && expandedMembroId === membro.id && !selectionMode && (
                      <div
                        className="px-3 pb-3 pt-1 border-t border-border/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Idade</p>
                            <p className="font-medium">
                              {calcularIdade(membro.data_nascimento)
                                ? `${calcularIdade(membro.data_nascimento)} anos`
                                : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Cargo</p>
                            <p className="font-medium truncate">
                              {(membro.cargos ?? []).length ? (membro.cargos ?? []).join(", ") : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Grupo</p>
                            <p className="font-medium truncate">{activeGroup?.name ?? "—"}</p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground">Presenças</p>
                            <p className="font-medium">{membro.presencas ?? 0}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            aria-label="Editar membro"
                            onClick={() => navigate(`/membros/editar/${membro.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            aria-label="Excluir membro"
                            onClick={() => openInactivateDialog([membro.id])}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl"
                            aria-label="Ver informações completas"
                            onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                          >
                            <IdCard className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Ação rápida (mobile): excluir seleção via long-press */}
                {isMobile && selectionMode && hasSelected && (
                  <div className="fixed bottom-16 left-0 right-0 z-40">
                    <div className="container mx-auto max-w-2xl px-3">
                      <div className="rounded-2xl border border-border/50 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 shadow-[var(--shadow-card)]">
                        <div className="h-14 px-2 flex items-center justify-between">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl hover:bg-accent/40 transition-colors"
                            aria-label="Sair do modo seleção"
                            onClick={() => {
                              setSelectionMode(false);
                              setSelectedIds([]);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>

                          <div className="text-xs text-muted-foreground">
                            {selectedIds.length} selecionado{selectedIds.length === 1 ? "" : "s"}
                          </div>

                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                              deleting
                                ? "opacity-50"
                                : "hover:bg-destructive/10 text-destructive",
                            )}
                            aria-label="Excluir selecionados"
                            disabled={deleting}
                            onClick={() => openInactivateDialog(selectedIds)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {filteredMembros.length === 0 && !loadingMembros && (
                  <div className="text-center py-12">
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {search ? "Nenhum membro encontrado" : "Nenhum membro cadastrado ainda"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Botão flutuante de adicionar (Mobile) */}
        {isMobile && (
          <button
            type="button"
            onClick={() => navigate("/membros/novo")}
            className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] flex items-center justify-center"
            aria-label="Adicionar membro"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}

        <InactivateMemberDialog
          open={inactivateDialogOpen}
          onOpenChange={(open) => {
            if (!open && !deleting) {
              setInactivateDialogOpen(false);
              setInactivateTargetIds([]);
            }
          }}
          title={
            inactivateTargetIds.length <= 1
              ? "Inativar membro"
              : `Inativar ${inactivateTargetIds.length} membros`
          }
          confirmLabel="Inativar"
          loading={deleting}
          onConfirm={handleConfirmInactivate}
        />

      </div>
    </div>
  );
};

export default Membros;
