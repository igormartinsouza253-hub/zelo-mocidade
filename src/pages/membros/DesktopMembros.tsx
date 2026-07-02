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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  data_aniversario?: string | null;
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
  taxaMensalPorcentagem?: number;
  alertaAusencias?: boolean;
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
  const [profilePhoto, setProfilePhoto] = useState<{ src: string; alt: string } | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const navigate = useNavigate();
  const isMobile = __forceMobile ? true : __forceDesktop ? false : useIsMobile();
  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];
  const { setConfig } = usePageHeader();
  const { activeGroupId, isAdmin } = useActiveGroup();

  const hasSelected = selectedIds.length > 0;

  useEffect(() => {
    loadMembros();
    loadCargos();
  }, [activeGroupId]);

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
    if (!isMobile) return;

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
      mobileSearch: isMobile
        ? {
            value: search,
            onChange: setSearch,
            placeholder: "Buscar...",
            menu: (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center border border-border/70 bg-background/70 text-foreground transition-colors hover:bg-accent/35"
                    aria-label="Opcoes"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={18}
                  className="w-[calc(100vw-2rem)] max-w-[22rem] translate-x-[max(1rem,calc((100vw-22rem)/2))] rounded-3xl border border-border/55 bg-background/98 p-3 text-foreground shadow-[var(--shadow-card)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/94"
                >
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
                          <SelectItem value="frequencia">Frequencia</SelectItem>
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

                    <button
                      type="button"
                    className="w-full inline-flex items-center justify-between gap-2 rounded-2xl border border-border bg-background px-3 h-9 text-xs text-foreground transition-colors hover:bg-accent/35"
                      onClick={() => {
                        const next = selectedCargos.length || selectedFaixas.length || showInactive;
                        if (next) {
                          clearFilters();
                          setShowInactive(false);
                        }
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5" />
                        {selectedCargos.length || selectedFaixas.length || showInactive ? "Limpar filtros" : "Sem filtros ativos"}
                      </span>
                      {(selectedCargos.length > 0 || selectedFaixas.length > 0 || showInactive) && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
                          {selectedCargos.length + selectedFaixas.length + (showInactive ? 1 : 0)}
                        </span>
                      )}
                    </button>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => {
                      setSelectionMode((prev) => !prev);
                      setSelectedIds([]);
                    }}
                  >
                    {selectionMode ? "Sair do modo selecao" : "Selecionar para excluir"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          }
        : undefined,
      mobilePrimaryAction: isMobile
        ? {
            label: "Novo membro",
            icon: Plus,
            onClick: () => navigate("/membros/novo"),
          }
        : undefined,
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
              <SelectItem value="frequencia">Frequencia</SelectItem>
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
                aria-label="Opcoes"
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
                {selectionMode ? "Sair do modo selecao" : "Selecionar para excluir"}
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
    if (!activeGroupId) {
      setCargosDisponiveis([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .eq("group_id", activeGroupId)
        .order("nome");
      if (error) throw error;
      setCargosDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
    }
  };

  const loadMembros = async () => {
    if (!activeGroupId) {
      setMembros([]);
      setLoadingMembros(false);
      return;
    }

    try {
      setLoadingMembros(true);
      const { data: membrosData, error: membrosError } = await supabase
        .from("membros")
        .select("*")
        .eq("group_id", activeGroupId);
      if (membrosError) throw membrosError;

      const umMesAtras = new Date();
      umMesAtras.setDate(umMesAtras.getDate() - 30);
      const desde = umMesAtras.toISOString().split("T")[0];

      const [{ count: reunioesMes }, { data: ultimasReunioes }] = await Promise.all([
        supabase
          .from("reunioes")
          .select("*", { count: "exact", head: true })
          .eq("group_id", activeGroupId)
          .gte("data", desde),
        supabase
          .from("reunioes")
          .select("id, data")
          .eq("group_id", activeGroupId)
          .order("data", { ascending: false })
          .limit(4),
      ]);

      const membrosComPresencas = await Promise.all(
        (membrosData || []).map(async (membro) => {
          const [{ count }, { count: presencasMes }] = await Promise.all([
            supabase
              .from("presencas")
              .select("*", { count: "exact", head: true })
              .eq("group_id", activeGroupId)
              .eq("membro_id", membro.id),
            supabase
              .from("presencas")
              .select("reuniao_id, reunioes!inner(data)", { count: "exact", head: true })
              .eq("group_id", activeGroupId)
              .eq("membro_id", membro.id)
              .gte("reunioes.data", desde),
          ]);

          let ausenciasConsecutivas = 0;
          if (ultimasReunioes) {
            for (const reuniao of ultimasReunioes) {
              const { count: presencaNaReuniao } = await supabase
                .from("presencas")
                .select("*", { count: "exact", head: true })
                .eq("group_id", activeGroupId)
                .eq("membro_id", membro.id)
                .eq("reuniao_id", reuniao.id);

              if ((presencaNaReuniao || 0) === 0) {
                ausenciasConsecutivas++;
              } else {
                break;
              }
            }
          }

          return {
            ...membro,
            presencas: count || 0,
            taxaMensalPorcentagem: reunioesMes ? Math.round(((presencasMes || 0) / reunioesMes) * 100) : 0,
            alertaAusencias: ausenciasConsecutivas > 3,
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

  const formatPhoneBR = (telefone?: string | null) => {
    if (!telefone) return "Não informado";
    let digits = telefone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return telefone;
  };

  const formatBirthday = (membro: Membro) => {
    const raw = membro.data_aniversario || membro.data_nascimento;
    if (!raw) return "Não informado";

    if (/^\d{2}-\d{2}$/.test(raw)) {
      const [month, day] = raw.split("-");
      return `${day}/${month}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [, month, day] = raw.split("-");
      return `${day}/${month}`;
    }

    return raw;
  };

  const getFrequencyStatus = (membro: Membro) => {
    if (membro.alertaAusencias) {
      return {
        label: "Alerta",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    }

    if ((membro.taxaMensalPorcentagem ?? 0) >= 100) {
      return {
        label: "Frequente",
        className: "border-primary/30 bg-primary/10 text-primary",
      };
    }

    return {
      label: "Regular",
      className: "border-border/60 bg-background/70 text-foreground",
    };
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

  const handleConfirmInactivate = async () => {
    if (inactivateTargetIds.length === 0) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from("membros")
        .update({
          ativo: false,
          inativado_em: new Date().toISOString(),
          inativado_motivo: "Inativado manualmente",
          inativado_observacao: null,
        })
        .in("id", inactivateTargetIds);

      if (error) throw error;

      toast.success(
        inactivateTargetIds.length === 1 ? "Membro inativado." : "Membros inativados.",
      );

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

  const handleConfirmPermanentDelete = async () => {
    if (inactivateTargetIds.length === 0 || !isAdmin) {
      toast.error("Apenas admins podem excluir permanentemente.");
      return;
    }

    setDeleting(true);

    try {
      const [presencasResult, eventosResult, visitasResult, notasResult] = await Promise.all([
        supabase.from("presencas").delete().in("membro_id", inactivateTargetIds),
        supabase.from("eventos").delete().in("membro_visitado_id", inactivateTargetIds),
        supabase.from("visitas").delete().in("membro_visitado_id", inactivateTargetIds),
        supabase.from("notas").delete().in("membro_id", inactivateTargetIds),
      ]);

      const cleanupError = presencasResult.error ?? eventosResult.error ?? visitasResult.error ?? notasResult.error;
      if (cleanupError) throw cleanupError;

      const { error: membrosError } = await supabase.from("membros").delete().in("id", inactivateTargetIds);
      if (membrosError) throw membrosError;

      toast.success(
        inactivateTargetIds.length === 1 ? "Membro excluído permanentemente." : "Membros excluídos permanentemente.",
      );

      if (selectedMembro && inactivateTargetIds.includes(selectedMembro.id)) {
        setSelectedMembro(null);
      }

      setSelectedIds([]);
      await loadMembros();
    } catch (error) {
      console.error("Erro ao excluir membro(s):", error);
      toast.error("Erro ao excluir membro(s)");
    } finally {
      setDeleting(false);
      setInactivateDialogOpen(false);
      setInactivateTargetIds([]);
    }
  };

  return (
    <div className="h-full w-full bg-background overflow-hidden">
      <div className="flex flex-col h-full px-3 py-3 md:px-4 md:py-4 gap-0">
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
                          "cursor-pointer border transition-all",
                          isMobile
                            ? "rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm hover:border-primary/35 active:bg-accent/25"
                            : "rounded-3xl border-border/50 bg-card shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)]",
                          selectedMembro?.id === membro.id && "border-primary bg-primary/10",
                        )}
                        onClick={() => {
                          setSelectedMembro(membro);
                        }}
                        onDoubleClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-3 md:gap-4 p-3 md:p-3",
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
                          <Avatar className="h-11 w-11 flex-shrink-0 rounded-2xl border border-border/55 bg-primary/10 md:h-11 md:w-11">
                            <AvatarImage className="rounded-2xl object-cover" src={membro.foto_url || ""} alt={membro.nome} />
                            <AvatarFallback className="rounded-2xl bg-primary/10 text-sm font-semibold text-primary md:text-base">
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
                                      <span>/</span>
                                    </>
                                  )}
                                  {membro.cargos && membro.cargos.length > 0 && (
                                    <>
                                      <span className="truncate">{membro.cargos[0]}</span>
                                      <span>/</span>
                                    </>
                                  )}
                                  <span className="capitalize">{membro.faixa_etaria}</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span>{"Presen\u00e7as:"}</span>
                                  <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
                                  <span>{"Presen\u00e7as:"}</span>
                                  <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
                                  aria-label="Opcoes"
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
                    "h-full space-y-2 overflow-y-auto animate-fade-in md:space-y-3 md:pb-4 md:pr-2",
                    isMobile && "mx-auto w-full max-w-[22rem]",
                    isMobile
                      ? "scrollbar-none mx-auto w-full max-w-[22rem] pb-[calc(env(safe-area-inset-bottom)+11rem)] pr-0"
                      : "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30 pb-16",
                )}
              >
                {filteredMembros.map((membro) => (
                  <div
                    key={membro.id}
                    className={cn(
                      "w-full cursor-pointer border transition-all",
                      isMobile
                        ? "rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm hover:border-primary/35 active:bg-accent/25"
                        : "rounded-3xl border-border/50 bg-card shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)]",
                      selectedMembro?.id === membro.id && "border-primary bg-primary/10",
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
                    onDoubleClick={() => {
                      if (selectionMode) return;
                      navigate(`/membros/visualizar/${membro.id}`);
                    }}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 md:gap-4 p-3 md:p-3",
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
                      <Avatar
                        className={cn(
                          "h-11 w-11 flex-shrink-0 rounded-2xl border border-border/55 bg-primary/10 md:h-11 md:w-11",
                          membro.foto_url && "cursor-zoom-in",
                        )}
                        onClick={(e) => {
                          if (!membro.foto_url) return;
                          e.stopPropagation();
                          setProfilePhoto({ src: membro.foto_url, alt: membro.nome });
                        }}
                      >
                        <AvatarImage className="rounded-2xl object-cover" src={membro.foto_url || ""} alt={membro.nome} />
                        <AvatarFallback className="rounded-2xl bg-primary/10 text-sm font-semibold text-primary md:text-base">
                          {membro.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                            {membro.nome}
                          </h3>
                          {isMobile && expandedMembroId === membro.id && (
                            <Badge
                              variant="outline"
                              className={cn("h-5 shrink-0 rounded-full px-2 text-[10px]", getFrequencyStatus(membro).className)}
                            >
                              {getFrequencyStatus(membro).label}
                            </Badge>
                          )}
                          {membro.ativo === false && (
                            <Badge variant="destructive" className="h-5 px-2 text-[10px] rounded-full">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        {isMobile && expandedMembroId === membro.id ? null : listMode === "comfortable" ? (
                          <>
                            <div className="flex gap-1.5 md:gap-2 text-[11px] md:text-xs text-muted-foreground flex-wrap">
                              {calcularIdade(membro.data_nascimento) && (
                                <>
                                  <span>{calcularIdade(membro.data_nascimento)} anos</span>
                                  <span>/</span>
                                </>
                              )}
                              {membro.cargos && membro.cargos.length > 0 && (
                                <>
                                  <span className="truncate">{membro.cargos[0]}</span>
                                  <span>/</span>
                                </>
                              )}
                              <span className="capitalize">{membro.faixa_etaria}</span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>{"Presen\u00e7as:"}</span>
                              <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
                              <span>{"Presen\u00e7as:"}</span>
                              <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
                                aria-label="Opcoes"
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
                        className="border-t border-border/40 px-3 pb-3 pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Idade</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {calcularIdade(membro.data_nascimento)
                                ? `${calcularIdade(membro.data_nascimento)} anos`
                                : "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cargo</p>
                            <p className="mt-1 truncate font-semibold text-foreground">
                              {(membro.cargos ?? []).length ? (membro.cargos ?? []).join(", ") : "—"}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aniversário</p>
                            <p className="mt-1 truncate font-semibold text-foreground">{formatBirthday(membro)}</p>
                          </div>

                          <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{"Presen\u00e7as"}</p>
                            <p className="mt-1 font-semibold tabular-nums text-primary">{membro.presencas ?? 0}</p>
                          </div>
                        </div>

                        <div className="mt-2 rounded-2xl border border-border/55 bg-background/55 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Telefone</p>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">{formatPhoneBR(membro.telefone)}</p>
                        </div>

                        <div className="mt-2 flex items-center justify-between rounded-2xl border border-border/65 bg-background/90 p-1.5 shadow-[var(--shadow-soft)]">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl text-foreground hover:bg-accent/35"
                            aria-label="Editar membro"
                            onClick={() => navigate(`/membros/editar/${membro.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Excluir membro"
                            onClick={() => openInactivateDialog([membro.id])}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
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
        <Dialog open={Boolean(profilePhoto)} onOpenChange={(open) => !open && setProfilePhoto(null)}>
          <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-border/60 bg-background p-0 shadow-[var(--shadow-card)]">
            <DialogHeader className="sr-only">
              <DialogTitle>{profilePhoto?.alt || "Foto do membro"}</DialogTitle>
            </DialogHeader>
            {profilePhoto && (
              <div className="bg-card p-3">
                <img
                  src={profilePhoto.src}
                  alt={profilePhoto.alt}
                  className="aspect-square w-full rounded-3xl object-cover"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={inactivateDialogOpen} onOpenChange={setInactivateDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {inactivateTargetIds.length <= 1
                  ? "Como deseja remover este membro?"
                  : `Como deseja remover ${inactivateTargetIds.length} membros?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você pode inativar para preservar histórico ou excluir permanentemente (somente admins).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-between gap-2">
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <div className="flex items-center gap-2">
                <AlertDialogAction
                  onClick={handleConfirmInactivate}
                  disabled={deleting}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                >
                  {deleting ? "Processando..." : "Tornar inativo"}
                </AlertDialogAction>
                {isAdmin ? (
                  <AlertDialogAction onClick={handleConfirmPermanentDelete} disabled={deleting}>
                    {deleting ? "Excluindo..." : "Excluir permanente"}
                  </AlertDialogAction>
                ) : null}
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
};

export default Membros;

