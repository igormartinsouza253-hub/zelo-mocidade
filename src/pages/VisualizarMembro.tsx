import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit, AlertTriangle, Users, MoreVertical, Trash2, ArrowLeft, CalendarDays, Phone, Briefcase, MessageSquare, BarChart3, Percent, CheckCircle2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { MobileActionBar } from "@/components/mobile/MobileActionBar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Membro {
  id: string;
  nome: string;
  data_nascimento: string | null;
  data_aniversario: string | null;
  cargos: string[] | null;
  faixa_etaria: string;
  foto_url: string | null;
  observacoes: string | null;
  telefone: string | null;
  status_telefone: string | null;
  ativo?: boolean;
  inativado_em?: string | null;
  inativado_motivo?: string | null;
  inativado_observacao?: string | null;
  created_by_user_id?: string | null;
}

interface Estatisticas {
  totalReunioes: number;
  presencas: number;
  taxaGeralPorcentagem: number;
  taxaMensalPorcentagem: number;
  ultimasPresencas: string[];
  alertaAusencias: boolean;
}

const getFirstName = (nome: string) => nome.trim().split(/\s+/)[0] || "Membro";

const getNameSizeClass = (nome: string) => {
  if (nome.length > 34) return "text-lg";
  if (nome.length > 24) return "text-xl";
  return "text-2xl";
};

const formatPhoneBR = (telefone: string | null) => {
  if (!telefone) return "Não informado";
  let digits = telefone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return telefone;
};

const normalizePhoneOwner = (status: string | null) => {
  if (!status) return null;
  const value = status.toLocaleLowerCase("pt-BR");
  if (value.includes("pr")) return "Próprio";
  if (value.includes("m")) return "Mãe";
  if (value.includes("p")) return "Pai";
  return status;
};

const getFrequencyStatus = (alertaAusencias: boolean, taxaMensalPorcentagem: number) => {
  if (alertaAusencias) {
    return {
      label: "Alerta",
      badgeClassName: "",
      variant: "destructive" as const,
    };
  }

  if (taxaMensalPorcentagem >= 100) {
    return {
      label: "Frequente",
      badgeClassName: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10",
      variant: "outline" as const,
    };
  }

  return {
    label: "Regular",
    badgeClassName: "border-border/60 bg-background/70 text-foreground",
    variant: "outline" as const,
  };
};

const VisualizarMembro = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useActiveGroup();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalReunioes: 0,
    presencas: 0,
    taxaGeralPorcentagem: 0,
    taxaMensalPorcentagem: 0,
    ultimasPresencas: [],
    alertaAusencias: false,
  });
  const { setConfig } = usePageHeader();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);

  useEffect(() => {
    loadMembro();
  }, [id]);

  useEffect(() => {
    if (!membro) return;
    if (membro.ativo === false) return;
    loadEstatisticas();
  }, [membro?.id, membro?.ativo]);

  const handleDelete = useCallback(() => {
    if (!membro) return;
    setDeleteOpen(true);
  }, [membro]);

  const handleInactivate = useCallback(async () => {
    if (!membro) return;

    try {
      setDeleting(true);

      const { error } = await supabase
        .from("membros")
        .update({
          ativo: false,
          inativado_em: new Date().toISOString(),
          inativado_motivo: "Inativado manualmente",
          inativado_observacao: null,
        })
        .eq("id", membro.id);

      if (error) throw error;

      toast.success("Membro inativado com sucesso.");
      navigate("/membros");
    } catch (error) {
      console.error("Erro ao inativar membro:", error);
      toast.error("Erro ao inativar membro");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }, [membro, navigate]);

  const handlePermanentDelete = useCallback(async () => {
    if (!membro || !isAdmin) return;

    try {
      setDeleting(true);

      const memberId = membro.id;
      const [presencasResult, eventosResult, visitasResult, notasResult] = await Promise.all([
        supabase.from("presencas").delete().eq("membro_id", memberId),
        supabase.from("eventos").delete().eq("membro_visitado_id", memberId),
        supabase.from("visitas").delete().eq("membro_visitado_id", memberId),
        supabase.from("notas").delete().eq("membro_id", memberId),
      ]);

      const cleanupError =
        presencasResult.error ?? eventosResult.error ?? visitasResult.error ?? notasResult.error;
      if (cleanupError) throw cleanupError;

      const { error: membroError } = await supabase.from("membros").delete().eq("id", memberId);
      if (membroError) throw membroError;

      toast.success("Membro excluído permanentemente.");
      navigate("/membros");
    } catch (error) {
      console.error("Erro ao excluir membro:", error);
      toast.error("Erro ao excluir membro");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }, [isAdmin, membro, navigate]);

  useEffect(() => {
    if (!membro) return;
    const firstName = getFirstName(membro.nome);

    setConfig({
      title: firstName,
      icon: Users,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Membros", href: "/membros" },
        { label: firstName },
      ],
      showBackButton: true,
      backTo: "/membros",
      secondaryActions: (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent/60 transition-colors"
              aria-label="Ações do membro"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/membros/editar/${membro.id}`)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remover membro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return () => setConfig(null);
  }, [membro, navigate, setConfig, handleDelete]);

  const loadMembro = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setMembro(data);

      if (data?.created_by_user_id) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.created_by_user_id)
          .maybeSingle();
        setCreatedByName(creatorProfile?.username ?? null);
      } else {
        setCreatedByName(null);
      }
    } catch (error) {
      console.error("Erro ao carregar membro:", error);
      toast.error("Erro ao carregar dados do membro");
      navigate("/membros");
    }
  };

  const loadEstatisticas = async () => {
    try {
      const { count: totalReunioes } = await supabase
        .from("reunioes")
        .select("*", { count: "exact", head: true });

      const { data: presencasData, error: presencasError } = await supabase
        .from("presencas")
        .select("reuniao_id, reunioes(data)")
        .eq("membro_id", id)
        .order("created_at", { ascending: false });

      if (presencasError) throw presencasError;

      const presencas = presencasData?.length || 0;
      const taxaGeral = totalReunioes ? (presencas / totalReunioes) * 100 : 0;

      const umMesAtras = new Date();
      umMesAtras.setDate(umMesAtras.getDate() - 30);

      const { count: reunioesMes } = await supabase
        .from("reunioes")
        .select("*", { count: "exact", head: true })
        .gte("data", umMesAtras.toISOString().split("T")[0]);

      const { count: presencasMes } = await supabase
        .from("presencas")
        .select("reuniao_id, reunioes!inner(data)", { count: "exact", head: true })
        .eq("membro_id", id)
        .gte("reunioes.data", umMesAtras.toISOString().split("T")[0]);

      const taxaMensal = reunioesMes ? ((presencasMes || 0) / reunioesMes) * 100 : 0;

      const ultimasPresencas = (presencasData || [])
        .slice(0, 3)
        .map((p: any) => p.reunioes?.data)
        .filter(Boolean);

      const { data: ultimasReunioes } = await supabase
        .from("reunioes")
        .select("id, data")
        .order("data", { ascending: false })
        .limit(4);

      let ausenciasConsecutivas = 0;
      if (ultimasReunioes) {
        for (const reuniao of ultimasReunioes) {
          const { count } = await supabase
            .from("presencas")
            .select("*", { count: "exact", head: true })
            .eq("membro_id", id)
            .eq("reuniao_id", reuniao.id);

          if (count === 0) {
            ausenciasConsecutivas++;
          } else {
            break;
          }
        }
      }

      setEstatisticas({
        totalReunioes: totalReunioes || 0,
        presencas,
        taxaGeralPorcentagem: Math.round(taxaGeral),
        taxaMensalPorcentagem: Math.round(taxaMensal),
        ultimasPresencas,
        alertaAusencias: ausenciasConsecutivas > 3,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
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

  const parseDataAniversario = (valor: string | null | undefined): Date | null => {
    if (!valor) return null;
    const raw = valor.trim();
    if (!raw) return null;

    if (/^\d{2}-\d{2}$/.test(raw)) {
      const [mesStr, diaStr] = raw.split("-");
      const dia = Number(diaStr);
      const mes = Number(mesStr) - 1;
      if (!Number.isNaN(dia) && !Number.isNaN(mes) && dia > 0 && mes >= 0 && mes <= 11) {
        return new Date(2000, mes, dia);
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      try {
        return parseISO(raw);
      } catch {
        return null;
      }
    }

    const partes = raw.split("/");
    if (partes.length === 2 || partes.length === 3) {
      const [diaStr, mesStr, anoStr] = partes;
      const dia = Number(diaStr);
      const mes = Number(mesStr) - 1;
      const ano = anoStr ? Number(anoStr) : 2000;

      if (
        Number.isNaN(dia) ||
        Number.isNaN(mes) ||
        Number.isNaN(ano) ||
        dia <= 0 ||
        mes < 0 ||
        mes > 11
      ) {
        return null;
      }

      return new Date(ano, mes, dia);
    }

    return null;
  };

  const getDataAniversarioTexto = (m: Membro) => {
    const dataPreferencial = parseDataAniversario(m.data_aniversario);
    const fallbackNascimento = parseDataAniversario(m.data_nascimento);
    const data = dataPreferencial || fallbackNascimento;

    if (!data) return null;

    try {
      return format(data, "d 'de' MMMM", { locale: ptBR });
    } catch {
      return null;
    }
  };

  const formatarData = (data: string) => {
    try {
      return format(parseISO(data), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return data;
    }
  };

  if (!membro) return null;

  const dataAniversarioTexto = getDataAniversarioTexto(membro);
  const creatorLabel = createdByName ?? "usuário não identificado";
  const idade = calcularIdade(membro.data_nascimento);
  const phoneOwner = normalizePhoneOwner(membro.status_telefone);
  const cargos = membro.cargos?.filter(Boolean) ?? [];
  const frequenciaCritica = estatisticas.alertaAusencias;
  const frequenciaStatus = getFrequencyStatus(frequenciaCritica, estatisticas.taxaMensalPorcentagem);

  const formatarDataInativacao = (valor?: string | null) => {
    if (!valor) return "—";
    try {
      return format(parseISO(valor), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return valor;
    }
  };

  if (membro.ativo === false) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-2xl">
          <Card className="shadow-[var(--shadow-soft)] border-border/60 bg-card/90 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base md:text-lg">Membro inativo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="rounded-full p-1.5 bg-accent/60 border border-border/80">
                  <Avatar
                    className={`h-16 w-16 rounded-2xl md:h-20 md:w-20 ${membro.foto_url ? "cursor-zoom-in" : ""}`}
                    onClick={() => membro.foto_url && setProfilePhotoOpen(true)}
                  >
                    <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl">
                      {membro.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="min-w-0">
                  <p className="text-lg md:text-xl font-semibold truncate">{membro.nome}</p>
                  <Badge variant="destructive" className="mt-1 rounded-full">Inativo</Badge>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Motivo</p>
                  <p className="font-medium">{membro.inativado_motivo || "—"}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Observação</p>
                  <p className="font-medium whitespace-pre-wrap">{membro.inativado_observacao || "—"}</p>
                </div>

                <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">{formatarDataInativacao(membro.inativado_em)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-3 text-xs text-muted-foreground">
            Criado por <span className="font-medium text-foreground">{creatorLabel}</span>
          </p>
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Como deseja remover este membro?</AlertDialogTitle>
              <AlertDialogDescription>
                Você pode inativar para manter histórico ou excluir permanentemente (somente admins).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-between gap-2">
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <div className="flex items-center gap-2">
                <AlertDialogAction
                  onClick={handleInactivate}
                  disabled={deleting}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                >
                  {deleting ? "Processando..." : "Tornar inativo"}
                </AlertDialogAction>
                {isAdmin ? (
                  <AlertDialogAction onClick={handlePermanentDelete} disabled={deleting}>
                    {deleting ? "Excluindo..." : "Excluir permanente"}
                  </AlertDialogAction>
                ) : null}
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full w-full justify-center overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom)+12rem)] scrollbar-none md:pb-32 md:scrollbar-thin">
        <div className="w-full max-w-2xl space-y-4 px-3 py-3 md:px-4 md:py-8">
          {/* Cabeçalho principal agora é controlado pelo layout */}

          {/* Topo: Nome (esq) + Foto (dir) */}
          <Card className="overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  className={`h-[5.875rem] w-[5.875rem] shrink-0 rounded-2xl border border-border/60 bg-primary/10 ${membro.foto_url ? "cursor-zoom-in" : ""}`}
                  onClick={() => membro.foto_url && setProfilePhotoOpen(true)}
                >
                  <AvatarImage className="rounded-2xl object-cover" src={membro.foto_url || ""} alt={membro.nome} />
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
                    {membro.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <h1 className={`${getNameSizeClass(membro.nome)} break-words font-bold leading-tight text-foreground`}>
                    {membro.nome}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="rounded-full bg-primary/15 px-2.5 py-1 text-primary hover:bg-primary/15">
                      {membro.faixa_etaria}
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-border/60 px-2.5 py-1">
                      {idade !== null ? `${idade} anos` : "Idade não informada"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bloco abaixo: informações do membro */}
          <Card className="overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Telefone</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatPhoneBR(membro.telefone)}</p>
                    {phoneOwner && <p className="text-xs text-muted-foreground">Telefone de {phoneOwner}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                <div className="flex items-start gap-3">
                  <Briefcase className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cargo</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cargos.length ? (
                        cargos.map((cargo) => (
                          <Badge key={cargo} variant="outline" className="rounded-full border-border/60 bg-background/70">
                            {cargo}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum cargo informado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Aniversário</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{dataAniversarioTexto || "Não informado"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Observações</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-foreground">
                      {membro.observacoes?.trim() || "Sem observações"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo abaixo: estatísticas de frequência */}
          <Card
            className={`overflow-hidden rounded-3xl shadow-[var(--shadow-card)] ${
              frequenciaCritica
                ? "border-destructive/55 bg-destructive/10"
                : "border-border/55 bg-card/90"
            }`}
          >
            <CardHeader className="px-4 pb-2 pt-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Frequência</CardTitle>
                <Badge
                  variant={frequenciaStatus.variant}
                  className={`rounded-full ${frequenciaStatus.badgeClassName}`}
                >
                  {frequenciaStatus.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {frequenciaCritica && (
                <div className="flex gap-3 rounded-2xl border border-destructive/45 bg-destructive/10 p-3 text-destructive">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm font-semibold">
                    Atenção: este jovem faltou a mais de 3 reuniões seguidas. Vale fazer um acompanhamento próximo.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                  <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold tabular-nums text-foreground">{estatisticas.presencas}</p>
                  <p className="text-xs text-muted-foreground">Presenças</p>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                  <BarChart3 className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold tabular-nums text-foreground">{estatisticas.totalReunioes}</p>
                  <p className="text-xs text-muted-foreground">Reuniões</p>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                  <Percent className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold tabular-nums text-foreground">{estatisticas.taxaGeralPorcentagem}%</p>
                  <p className="text-xs text-muted-foreground">Geral</p>
                </div>
                <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                  <Percent className="mb-2 h-4 w-4 text-primary" />
                  <p className="text-2xl font-bold tabular-nums text-foreground">{estatisticas.taxaMensalPorcentagem}%</p>
                  <p className="text-xs text-muted-foreground">30 dias</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/55 bg-background/55 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Últimas presenças</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {estatisticas.ultimasPresencas.length ? (
                    estatisticas.ultimasPresencas.map((data) => (
                      <Badge key={data} variant="outline" className="rounded-full border-border/60 bg-background/70">
                        {formatarData(data)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Nenhuma presença registrada</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="px-1 text-xs text-muted-foreground">
            Criado por <span className="font-medium text-foreground">{creatorLabel}</span>
          </p>

          <div aria-hidden="true" className="h-[calc(env(safe-area-inset-bottom)+12rem)] md:hidden" />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Como deseja remover este membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Você pode inativar para manter histórico ou excluir permanentemente (somente admins).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-between gap-2">
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <div className="flex items-center gap-2">
              <AlertDialogAction
                onClick={handleInactivate}
                disabled={deleting}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                {deleting ? "Processando..." : "Tornar inativo"}
              </AlertDialogAction>
              {isAdmin ? (
                <AlertDialogAction onClick={handlePermanentDelete} disabled={deleting}>
                  {deleting ? "Excluindo..." : "Excluir permanente"}
                </AlertDialogAction>
              ) : null}
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={profilePhotoOpen} onOpenChange={setProfilePhotoOpen}>
        <DialogContent className="max-w-sm overflow-hidden rounded-3xl border-border/60 bg-background p-0 shadow-[var(--shadow-card)]">
          <DialogHeader className="sr-only">
            <DialogTitle>{membro.nome}</DialogTitle>
          </DialogHeader>
          {membro.foto_url && (
            <div className="bg-card p-3">
              <img
                src={membro.foto_url}
                alt={membro.nome}
                className="aspect-square w-full rounded-3xl object-cover"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MobileActionBar className="md:hidden" floating>
        <Button type="button" variant="outline" className="bg-background/70" onClick={() => navigate("/membros")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
        <Button type="button" onClick={() => navigate(`/membros/editar/${membro.id}`)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </MobileActionBar>
    </>
  );
};

export default VisualizarMembro;
