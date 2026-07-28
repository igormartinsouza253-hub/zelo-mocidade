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
import { MemberInformationCard } from "@/components/membros/MemberInformationCard";
import { MemberFrequencyCard } from "@/components/membros/MemberFrequencyCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { MemberInsightsCarousel } from "@/components/membros/MemberInsightsCarousel";

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
  tendenciaMensal: { label: string; taxa: number }[];
  sequenciaRecente: { data: string; presente: boolean }[];
  maiorSequencia: number;
  primeiraPresenca: string | null;
}

const getFirstName = (nome: string) => nome.trim().split(/\s+/)[0] || "Membro";

const getNameSizeClass = (nome: string) => {
  if (nome.length > 34) return "text-lg md:text-2xl";
  if (nome.length > 24) return "text-xl md:text-3xl";
  return "text-2xl md:text-4xl";
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
  const { activeGroupId, isAdmin } = useActiveGroup();
  const [membro, setMembro] = useState<Membro | null>(null);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalReunioes: 0,
    presencas: 0,
    taxaGeralPorcentagem: 0,
    taxaMensalPorcentagem: 0,
    ultimasPresencas: [],
    alertaAusencias: false,
    tendenciaMensal: [],
    sequenciaRecente: [],
    maiorSequencia: 0,
    primeiraPresenca: null,
  });
  const { setConfig } = usePageHeader();
  const isMobile = useIsMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [profilePhotoOpen, setProfilePhotoOpen] = useState(false);

  useEffect(() => {
    if (!activeGroupId) return;
    loadMembro();
  }, [activeGroupId, id]);

  useEffect(() => {
    if (!membro) return;
    if (membro.ativo === false) return;
    if (!activeGroupId) return;
    loadEstatisticas();
  }, [activeGroupId, membro?.id, membro?.ativo]);

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
        .eq("id", membro.id)
        .eq("group_id", activeGroupId);

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
        supabase.from("presencas").delete().eq("membro_id", memberId).eq("group_id", activeGroupId),
        supabase.from("eventos").delete().eq("membro_visitado_id", memberId).eq("group_id", activeGroupId),
        supabase.from("visitas").delete().eq("membro_visitado_id", memberId).eq("group_id", activeGroupId),
        supabase.from("notas").delete().eq("membro_id", memberId).eq("group_id", activeGroupId),
      ]);

      const cleanupError =
        presencasResult.error ?? eventosResult.error ?? visitasResult.error ?? notasResult.error;
      if (cleanupError) throw cleanupError;

      const { error: membroError } = await supabase.from("membros").delete().eq("id", memberId).eq("group_id", activeGroupId);
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
  }, [activeGroupId, isAdmin, membro, navigate]);

  useEffect(() => {
    if (!membro) return;
    const firstName = getFirstName(membro.nome);
    setConfig({
      title: isMobile ? firstName : "Informações do membro",
      icon: Users,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Membros", href: "/membros" },
        { label: membro.nome },
      ],
      showBackButton: true,
      backTo: "/membros",
      primaryActions: !isMobile ? (
        <Button type="button" onClick={() => navigate(`/membros/editar/${membro.id}`)} className="gap-2">
          <Edit className="h-4 w-4" />
          Editar informações
        </Button>
      ) : undefined,
      secondaryActions: !isMobile ? (
        <>
          <Button type="button" variant="outline" onClick={() => navigate("/membros")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar aos membros
          </Button>
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
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir ou inativar membro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent/60"
              aria-label="Ações do membro"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/membros/editar/${membro.id}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover membro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return () => setConfig(null);
  }, [membro, navigate, setConfig, handleDelete, isMobile]);

  const loadMembro = async () => {
    try {
      const { data, error } = await supabase
        .from("membros")
        .select("*")
        .eq("id", id)
        .eq("group_id", activeGroupId)
        .single();

      if (error) throw error;
      setMembro(data);
      await resolveCreatorName(data?.created_by_user_id ?? null);
    } catch (error) {
      console.error("Erro ao carregar membro:", error);
      toast.error("Erro ao carregar dados do membro");
      navigate("/membros");
    }
  };

  const resolveCreatorName = async (creatorId: string | null) => {
    if (!activeGroupId) {
      setCreatedByName(null);
      return;
    }

    const idsToResolve = new Set<string>();
    if (creatorId) idsToResolve.add(creatorId);

    const { data: groupData } = await supabase
      .from("management_groups")
      .select("created_by")
      .eq("id", activeGroupId)
      .maybeSingle();

    const groupOwnerId = (groupData as { created_by?: string | null } | null)?.created_by ?? null;
    if (!creatorId && groupOwnerId) idsToResolve.add(groupOwnerId);

    if (!creatorId && !groupOwnerId) {
      const { data: adminRows } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", activeGroupId)
        .eq("role", "admin")
        .limit(1);

      const adminId = (adminRows as Array<{ user_id?: string | null }> | null)?.[0]?.user_id ?? null;
      if (adminId) idsToResolve.add(adminId);
    }

    if (!idsToResolve.size) {
      setCreatedByName("Administrador do grupo");
      return;
    }

    const ids = Array.from(idsToResolve);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, email")
      .in("id", ids);

    const profileById = new Map((profiles as Array<{ id: string; username?: string | null; email?: string | null }> | null ?? []).map((profile) => [profile.id, profile]));
    const preferredId = creatorId ?? groupOwnerId ?? ids[0];
    const profile = preferredId ? profileById.get(preferredId) : null;
    const fallbackProfile = profile ?? profileById.values().next().value;
    const label = fallbackProfile?.username || fallbackProfile?.email || "Administrador do grupo";

    setCreatedByName(label);
  };

  const loadEstatisticas = async () => {
    if (!activeGroupId) {
      setEstatisticas({
        totalReunioes: 0,
        presencas: 0,
        taxaGeralPorcentagem: 0,
        taxaMensalPorcentagem: 0,
        ultimasPresencas: [],
        alertaAusencias: false,
        tendenciaMensal: [],
        sequenciaRecente: [],
        maiorSequencia: 0,
        primeiraPresenca: null,
      });
      return;
    }

    try {
      const { count: totalReunioes } = await supabase
        .from("reunioes")
        .select("*", { count: "exact", head: true })
        .eq("group_id", activeGroupId);

      const { data: presencasData, error: presencasError } = await supabase
        .from("presencas")
        .select("reuniao_id, reunioes(data)")
        .eq("membro_id", id)
        .eq("group_id", activeGroupId)
        .order("created_at", { ascending: false });

      if (presencasError) throw presencasError;

      const presencas = presencasData?.length || 0;
      const taxaGeral = totalReunioes ? (presencas / totalReunioes) * 100 : 0;

      const umMesAtras = new Date();
      umMesAtras.setDate(umMesAtras.getDate() - 30);

      const { count: reunioesMes } = await supabase
        .from("reunioes")
        .select("*", { count: "exact", head: true })
        .eq("group_id", activeGroupId)
        .gte("data", umMesAtras.toISOString().split("T")[0]);

      const { count: presencasMes } = await supabase
        .from("presencas")
        .select("reuniao_id, reunioes!inner(data)", { count: "exact", head: true })
        .eq("membro_id", id)
        .eq("group_id", activeGroupId)
        .gte("reunioes.data", umMesAtras.toISOString().split("T")[0]);

      const taxaMensal = reunioesMes ? ((presencasMes || 0) / reunioesMes) * 100 : 0;

      const ultimasPresencas = (presencasData || [])
        .slice(0, 3)
        .map((p: any) => p.reunioes?.data)
        .filter(Boolean);

      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 5, 1);
      const { data: reunioesPeriodo } = await supabase
        .from("reunioes")
        .select("id, data")
        .eq("group_id", activeGroupId)
        .gte("data", seisMesesAtras.toISOString().split("T")[0])
        .order("data", { ascending: true });

      const presencasDatas = new Set(
        (presencasData || []).map((presenca: any) => presenca.reunioes?.data).filter(Boolean),
      );
      const reunioesOrdenadas = reunioesPeriodo || [];
      const sequenciaRecente = reunioesOrdenadas
        .slice(-8)
        .reverse()
        .map((reuniao) => ({ data: reuniao.data, presente: presencasDatas.has(reuniao.data) }));
      let ausenciasConsecutivas = 0;
      for (const reuniao of sequenciaRecente) {
        if (!reuniao.presente) ausenciasConsecutivas++;
        else break;
      }

      let maiorSequencia = 0;
      let sequenciaAtual = 0;
      for (const reuniao of reunioesOrdenadas) {
        if (presencasDatas.has(reuniao.data)) {
          sequenciaAtual++;
          maiorSequencia = Math.max(maiorSequencia, sequenciaAtual);
        } else {
          sequenciaAtual = 0;
        }
      }

      const tendenciaMensal = Array.from({ length: 6 }, (_, indice) => {
        const dataMes = new Date();
        dataMes.setDate(1);
        dataMes.setMonth(dataMes.getMonth() - (5 - indice));
        const ano = dataMes.getFullYear();
        const mes = dataMes.getMonth();
        const reunioesDoMes = reunioesOrdenadas.filter((reuniao) => {
          const data = parseISO(reuniao.data);
          return data.getFullYear() === ano && data.getMonth() === mes;
        });
        const presencasDoMes = reunioesDoMes.filter((reuniao) => presencasDatas.has(reuniao.data)).length;
        return {
          label: format(dataMes, "MMM", { locale: ptBR }).replace(".", ""),
          taxa: reunioesDoMes.length ? Math.round((presencasDoMes / reunioesDoMes.length) * 100) : 0,
        };
      });

      const primeiraPresenca = (presencasData || []).at(-1)?.reunioes?.data || null;

      setEstatisticas({
        totalReunioes: totalReunioes || 0,
        presencas,
        taxaGeralPorcentagem: Math.round(taxaGeral),
        taxaMensalPorcentagem: Math.round(taxaMensal),
        ultimasPresencas,
        alertaAusencias: ausenciasConsecutivas > 3,
        tendenciaMensal,
        sequenciaRecente,
        maiorSequencia,
        primeiraPresenca,
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
      <div className="h-full w-full overflow-y-auto bg-background pb-[calc(env(safe-area-inset-bottom)+12rem)] scrollbar-none md:overflow-hidden md:pb-0">
        <div className="member-dashboard mx-auto w-full max-w-2xl space-y-4 px-3 py-3 md:grid md:h-full md:max-w-none md:grid-cols-[minmax(280px,0.92fr)_minmax(320px,1fr)] md:items-stretch md:gap-4 md:space-y-0 md:px-5 md:py-5 xl:grid-cols-[minmax(380px,1.12fr)_minmax(360px,1fr)_minmax(420px,1.18fr)] xl:gap-5">
          <section className="flex min-h-0 flex-col gap-4">
            <Card className="member-dashboard-profile h-full min-h-0 overflow-hidden rounded-[20px] border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
              <CardContent className="member-dashboard-profile-content p-4 md:flex md:h-full md:min-h-0 md:flex-col md:justify-between md:gap-5">
                <div className="flex items-center gap-3 md:block md:min-h-0">
                  <Avatar
                    data-member-dashboard-avatar
                    className={`h-[5.875rem] w-[5.875rem] shrink-0 rounded-2xl border border-border/60 bg-primary/10 md:aspect-square md:rounded-[18px] ${membro.foto_url ? "cursor-zoom-in" : ""}`}
                    onClick={() => membro.foto_url && setProfilePhotoOpen(true)}
                  >
                    <AvatarImage className="rounded-2xl object-cover md:rounded-[18px]" src={membro.foto_url || ""} alt={membro.nome} />
                    <AvatarFallback className="rounded-2xl bg-primary/10 text-2xl font-semibold text-primary md:rounded-[18px] md:text-5xl">
                      {membro.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 md:mt-5 md:flex-none">
                    <h1 className={`${getNameSizeClass(membro.nome)} max-w-[12ch] break-words font-bold leading-[1.04] text-foreground md:max-w-[13ch]`}>
                      {membro.nome}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-2 md:mt-3">
                      <Badge className="rounded-full bg-primary/15 px-2.5 py-1 text-primary hover:bg-primary/15">
                        {membro.faixa_etaria}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/60 px-2.5 py-1">
                        {idade !== null ? `${idade} anos` : "Idade não informada"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p className="hidden rounded-2xl border border-border/45 bg-background/45 px-3 py-2 text-xs text-muted-foreground md:block">
                  Criado por <span className="font-semibold text-foreground">{creatorLabel}</span>
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="flex min-h-0 flex-col gap-4">
            <MemberInformationCard
              className="flex min-h-0 flex-[1.08] flex-col rounded-[20px]"
              telefone={membro.telefone}
              phoneOwner={phoneOwner}
              cargos={cargos}
              aniversario={dataAniversarioTexto}
              observacoes={membro.observacoes}
            />

            <MemberFrequencyCard
              className="flex min-h-0 flex-[0.92] flex-col rounded-[20px]"
              presencas={estatisticas.presencas}
              totalReunioes={estatisticas.totalReunioes}
              taxaGeralPorcentagem={estatisticas.taxaGeralPorcentagem}
              taxaMensalPorcentagem={estatisticas.taxaMensalPorcentagem}
              ultimasPresencas={estatisticas.ultimasPresencas}
              alertaAusencias={estatisticas.alertaAusencias}
              formatarData={formatarData}
            />
          </section>

          <section className="flex min-h-0 flex-col md:col-span-2 xl:col-span-1">
            <MemberInsightsCarousel
              className="hidden min-h-0 rounded-[20px] md:flex md:h-full md:flex-1 md:flex-col"
              nome={membro.nome}
              presencas={estatisticas.presencas}
              taxaMensal={estatisticas.taxaMensalPorcentagem}
              tendenciaMensal={estatisticas.tendenciaMensal}
              sequenciaRecente={estatisticas.sequenciaRecente}
              maiorSequencia={estatisticas.maiorSequencia}
              primeiraPresenca={estatisticas.primeiraPresenca}
              alertaAusencias={estatisticas.alertaAusencias}
              formatarData={formatarData}
            />
          </section>

          <p className="px-1 text-xs text-muted-foreground md:hidden">
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
