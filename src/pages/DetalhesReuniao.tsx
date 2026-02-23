import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Filter, X, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";
import { PrayerMemberPicker } from "@/components/reunioes/PrayerMemberPicker";

// Lista de livros da Bíblia com seus capítulos
const bibliaLivros: Record<string, number> = {
  "Gênesis": 50, "Êxodo": 40, "Levítico": 27, "Números": 36, "Deuteronômio": 34,
  "Josué": 24, "Juízes": 21, "Rute": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Reis": 22, "2 Reis": 25, "1 Crônicas": 29, "2 Crônicas": 36, "Esdras": 10,
  "Neemias": 13, "Ester": 10, "Jó": 42, "Salmos": 150, "Provérbios": 31,
  "Eclesiastes": 12, "Cantares": 8, "Isaías": 66, "Jeremias": 52, "Lamentações": 5,
  "Ezequiel": 48, "Daniel": 12, "Oséias": 14, "Joel": 3, "Amós": 9,
  "Obadias": 1, "Jonas": 4, "Miquéias": 7, "Naum": 3, "Habacuque": 3,
  "Sofonias": 3, "Ageu": 2, "Zacarias": 14, "Malaquias": 4,
  "Mateus": 28, "Marcos": 16, "Lucas": 24, "João": 21, "Atos": 28,
  "Romanos": 16, "1 Coríntios": 16, "2 Coríntios": 13, "Gálatas": 6, "Efésios": 6,
  "Filipenses": 4, "Colossenses": 4, "1 Tessalonicenses": 5, "2 Tessalonicenses": 3,
  "1 Timóteo": 6, "2 Timóteo": 4, "Tito": 3, "Filemom": 1, "Hebreus": 13,
  "Tiago": 5, "1 Pedro": 5, "2 Pedro": 3, "1 João": 5, "2 João": 1,
  "3 João": 1, "Judas": 1, "Apocalipse": 22
};

interface Membro {
  id: string;
  nome: string;
  cargos: string[];
  faixa_etaria: string;
  foto_url: string | null;
}

interface Cargo {
  id: string;
  nome: string;
}

const DetalhesReuniao = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { setConfig } = usePageHeader();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [selectedMembros, setSelectedMembros] = useState<string[]>([]);
  const [membrosQueOraram, setMembrosQueOraram] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [cargosDisponiveis, setCargosDisponiveis] = useState<Cargo[]>([]);
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedFaixas, setSelectedFaixas] = useState<string[]>([]);
  const [reuniaoGroupId, setReuniaoGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    data: "",
    tema: "",
    observacoes: "",
    numero_visitas: 0,
    recitativos_individuais: 0,
    quem_atendeu: "",
    palavra_referencia: "",
  });

  const faixasEtarias = ["Crianças", "Meninos", "Meninas", "Moços", "Moças"];

  useEffect(() => {
    loadReuniao();
    loadMembros();
    loadCargos();
  }, [id]);

  useEffect(() => {
    setConfig({
      title: "Editar reunião",
      showBackButton: true,
      backTo: "/reunioes",
      secondaryActions: isMobile ? null : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/reunioes")}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={() => setShowDeleteDialog(true)}
            disabled={loading}
            title="Excluir reunião"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      primaryActions: isMobile ? null : (
        <Button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      ),
    });

    return () => setConfig(null);
  }, [navigate, loading, setConfig, isMobile]);

  const loadCargos = async () => {
    try {
      const { data, error } = await supabase
        .from("cargos")
        .select("*")
        .order("nome");
      if (error) throw error;
      setCargosDisponiveis(data || []);
    } catch (error) {
      console.error("Erro ao carregar cargos:", error);
    }
  };

  const loadMembros = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, cargos, faixa_etaria, foto_url")
        .order("nome");

      if (error) throw error;
      setMembros(data || []);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
    }
  };

  const loadReuniao = async () => {
    try {
      const { data: reuniao, error: reuniaoError } = await supabase
        .from("reunioes")
        .select("*")
        .eq("id", id)
        .single();

      if (reuniaoError) throw reuniaoError;

      setFormData({
        data: reuniao.data,
        tema: reuniao.tema || "",
        observacoes: reuniao.observacoes || "",
        numero_visitas: reuniao.numero_visitas || 0,
        recitativos_individuais: reuniao.recitativos_individuais || 0,
        quem_atendeu: reuniao.quem_atendeu || "",
        palavra_referencia: reuniao.palavra_referencia || "",
      });
      setReuniaoGroupId(reuniao.group_id ?? null);


      // Carregar orações se existirem
      const { data: presencas, error: presencasError } = await supabase
        .from("presencas")
        .select("membro_id, orou")
        .eq("reuniao_id", id);

      if (presencasError) throw presencasError;

      const presentes = presencas?.map((p) => p.membro_id) || [];
      setSelectedMembros(presentes);
      setMembrosQueOraram(
        (presencas || [])
          .filter((p: any) => Boolean(p.orou))
          .map((p: any) => p.membro_id)
      );
    } catch (error) {
      console.error("Erro ao carregar reunião:", error);
      toast.error("Erro ao carregar dados da reunião");
      navigate("/reunioes");
    }
  };

  const toggleCargo = (cargoNome: string) => {
    setSelectedCargos((prev) =>
      prev.includes(cargoNome) ? prev.filter((c) => c !== cargoNome) : [...prev, cargoNome]
    );
  };

  const toggleFaixa = (faixa: string) => {
    setSelectedFaixas((prev) =>
      prev.includes(faixa) ? prev.filter((f) => f !== faixa) : [...prev, faixa]
    );
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

  const filteredMembros = membros.filter((membro) => {
    const matchesSearch = membro.nome.toLowerCase().includes(search.toLowerCase());
    const matchesCargo =
      selectedCargos.length === 0 || selectedCargos.some((cargo) => membro.cargos.includes(cargo));
    const matchesFaixa =
      selectedFaixas.length === 0 || selectedFaixas.includes(membro.faixa_etaria);
    return matchesSearch && matchesCargo && matchesFaixa;
  });

  const toggleMembro = (membroId: string) => {
    setSelectedMembros((prev) => {
      const isSelected = prev.includes(membroId);
      const next = isSelected ? prev.filter((id) => id !== membroId) : [...prev, membroId];
      if (isSelected) {
        setMembrosQueOraram((p) => p.filter((id) => id !== membroId));
      }
      return next;
    });
  };

  const toggleMembroQueOrou = (membroId: string) => {
    if (!selectedMembros.includes(membroId)) {
      toast.error("Para marcar oração, o membro precisa estar presente.");
      return;
    }
    setMembrosQueOraram((prev) =>
      prev.includes(membroId) ? prev.filter((id) => id !== membroId) : [...prev, membroId],
    );
  };

  const membrosQueOraramSet = useMemo(
    () => new Set(membrosQueOraram),
    [membrosQueOraram]
  );

  const presenceCounts = useMemo(() => {
    const presentes = selectedMembros.length + (formData.numero_visitas || 0);
    const total = presentes + (formData.recitativos_individuais || 0);
    return { presentes, total };
  }, [selectedMembros, formData.numero_visitas, formData.recitativos_individuais]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!reuniaoGroupId) {
        throw new Error("missing_group_id");
      }

      const { error: reuniaoError } = await supabase
        .from("reunioes")
        .update({
          data: formData.data,
          tema: formData.tema,
          observacoes: formData.observacoes,
          numero_visitas: formData.numero_visitas,
          recitativos_individuais: formData.recitativos_individuais || 0,
          quem_atendeu: formData.quem_atendeu || null,
          palavra_referencia: formData.palavra_referencia || null,
          // Não alteramos o campo antigo de orações aqui, para preservar dados anteriores.
        })
        .eq("id", id);

      if (reuniaoError) throw reuniaoError;

      // Remover todas as presenças antigas
      const { error: deletePresencasError } = await supabase
        .from("presencas")
        .delete()
        .eq("reuniao_id", id);
      if (deletePresencasError) throw deletePresencasError;

      // Adicionar novas presenças
      if (selectedMembros.length > 0) {
        const presencas = selectedMembros.map((membroId) => ({
          group_id: reuniaoGroupId,
          reuniao_id: id,
          membro_id: membroId,
          orou: membrosQueOraramSet.has(membroId),
        }));

        const { error: presencasError } = await supabase.from("presencas").insert(presencas);

        if (presencasError) throw presencasError;
      }

      toast.success("Reunião atualizada com sucesso!");
      navigate("/reunioes");
    } catch (error) {
      console.error("Erro ao atualizar reunião:", error);
      toast.error("Erro ao atualizar reunião");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Primeiro deletar as presenças
      await supabase.from("presencas").delete().eq("reuniao_id", id);

      // Depois deletar a reunião
      const { error } = await supabase.from("reunioes").delete().eq("id", id);

      if (error) throw error;

      toast.success("Reunião excluída com sucesso!");
      navigate("/reunioes");
    } catch (error) {
      console.error("Erro ao excluir reunião:", error);
      toast.error("Erro ao excluir reunião");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex justify-start">
      <div className={cn("w-full px-4 md:px-6 py-4 md:py-6", isMobile && "h-full overflow-y-auto scrollbar-none")}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:min-h-[360px]">
            <div className="md:flex-1 md:min-h-0">
              <Card className="h-full shadow-[var(--shadow-soft)] border-border/50">
                <CardHeader>
                  <CardTitle>Informações da Reunião</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="data">Data</Label>
                      <Input
                        id="data"
                        type="date"
                        required
                        value={formData.data}
                        onChange={(e) =>
                          setFormData({ ...formData, data: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tema">Tema (opcional)</Label>
                      <Input
                        id="tema"
                        value={formData.tema}
                        onChange={(e) =>
                          setFormData({ ...formData, tema: e.target.value })
                        }
                        placeholder="Tema da reunião"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações (opcional)</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          observacoes: e.target.value,
                        })
                      }
                      placeholder="Observações sobre a reunião"
                      rows={3}
                    />
                  </div>

                  {!isMobile && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="numero_visitas">Número de Visitas</Label>
                        <Input
                          id="numero_visitas"
                          type="number"
                          min="0"
                          value={formData.numero_visitas}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              numero_visitas: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="Número de visitantes presentes"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recitativos_individuais">
                          Recitativos Individuais (Opcional)
                        </Label>
                        <Input
                          id="recitativos_individuais"
                          type="number"
                          min="0"
                          value={formData.recitativos_individuais}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recitativos_individuais: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="Número de recitativos individuais"
                        />
                      </div>
                    </div>
                  )}


                  <div className="space-y-2">
                    <Label htmlFor="quem_atendeu">Quem Atendeu (Opcional)</Label>
                    <Input
                      id="quem_atendeu"
                      value={formData.quem_atendeu}
                      onChange={(e) =>
                        setFormData({ ...formData, quem_atendeu: e.target.value })
                      }
                      placeholder="Nome de quem atendeu"
                      maxLength={200}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="palavra_referencia">Palavra (Opcional)</Label>
                    <Input
                      id="palavra_referencia"
                      value={formData.palavra_referencia}
                      onChange={(e) =>
                        setFormData({ ...formData, palavra_referencia: e.target.value })
                      }
                      placeholder="Ex: Salmos 23:1"
                      list="livros-biblia"
                    />
                    <datalist id="livros-biblia">
                      {Object.keys(bibliaLivros).map((livro) => (
                        <option key={livro} value={`${livro} `} />
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      Formato: Livro Capítulo:Versículo
                    </p>
                  </div>

                  {/* Input de oração removido: agora é marcado diretamente na lista de presença */}
                </CardContent>
              </Card>
            </div>

            <div className="md:flex-[1.1] md:min-h-0">
              <Card className="h-full shadow-[var(--shadow-soft)] border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className={isMobile ? "text-base" : ""}>Presenças</CardTitle>
                  </div>

                  {isMobile ? (
                    <p className="text-xs font-normal text-muted-foreground mt-1">
                      Presentes:{" "}
                      <span className="font-semibold text-foreground tabular-nums">{presenceCounts.presentes}</span>
                      {" "}• Total:{" "}
                      <span className="font-semibold text-foreground tabular-nums">{presenceCounts.total}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedMembros.length} membros + {formData.numero_visitas} visitas ={" "}
                      {selectedMembros.length + formData.numero_visitas} total
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {isMobile && (
                    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/40 bg-card p-3">
                      <div className="space-y-2">
                        <Label htmlFor="numero_visitas">Número de visitas</Label>
                        <Input
                          id="numero_visitas"
                          type="number"
                          min="0"
                          value={formData.numero_visitas}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              numero_visitas: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="Visitantes"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recitativos_individuais">Recitativos individuais</Label>
                        <Input
                          id="recitativos_individuais"
                          type="number"
                          min="0"
                          value={formData.recitativos_individuais}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recitativos_individuais: parseInt(e.target.value) || 0,
                            })
                          }
                          placeholder="Recitativos"
                        />
                      </div>
                    </div>
                  )}

                  {/* Search and Filters */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar membro..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="relative flex-shrink-0"
                            aria-label="Filtros"
                          >
                            <Filter className="h-4 w-4" />
                            {(selectedCargos.length > 0 || selectedFaixas.length > 0) && (
                              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium leading-none text-primary-foreground">
                                {selectedCargos.length + selectedFaixas.length}
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
                                  variant="ghost"
                                  size="sm"
                                  onClick={clearFilters}
                                  className="h-auto p-1 text-xs"
                                >
                                  Limpar
                                </Button>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Cargos</Label>
                              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-none">
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
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Selected Filters Display */}
                    {(selectedCargos.length > 0 || selectedFaixas.length > 0) && (
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
                      </div>
                    )}
                  </div>

                  {/* Members List */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-none">
                    {filteredMembros.map((membro) => {
                      const isSelected = selectedMembros.includes(membro.id);
                      const isOrou = membrosQueOraramSet.has(membro.id);
                      return (
                        <div
                          key={membro.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-card cursor-pointer transition hover:bg-accent/40",
                            isSelected && "border-primary bg-primary/5",
                          )}
                          onClick={() => toggleMembro(membro.id)}
                        >
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage src={membro.foto_url || undefined} alt={membro.nome} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {membro.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{membro.nome}</p>
                          </div>

                          {isSelected && isOrou && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                              Orou
                            </Badge>
                          )}

                          <div className="flex-shrink-0 h-4 w-4 rounded-full border border-border flex items-center justify-center bg-background">
                            {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                        </div>
                      );
                    })}
                    {filteredMembros.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum membro encontrado
                      </p>
                    )}
                  </div>

                  <PrayerMemberPicker
                    members={membros}
                    presentMemberIds={selectedMembros}
                    prayingMemberIds={membrosQueOraram}
                    onChange={setMembrosQueOraram}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          {/* Espaçador para não esconder o fim do formulário atrás da barra fixa */}
          <div className="h-24 md:hidden" aria-hidden="true" />

          {/* Ações movidas para a barra inferior no mobile */}
        </form>
      </div>
      <MobileActionBar>
        <Button type="button" variant="outline" onClick={() => navigate("/reunioes")} disabled={loading}>
          Cancelar
        </Button>
        <Button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </MobileActionBar>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta reunião? Esta ação não pode
              ser desfeita e todos os registros de presença serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DetalhesReuniao;
