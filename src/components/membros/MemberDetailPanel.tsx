import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IdCard, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { MemberInformationCard } from "@/components/membros/MemberInformationCard";
import { MemberFrequencyCard } from "@/components/membros/MemberFrequencyCard";

interface MemberDetailProps {
  membro: {
    id: string;
    nome: string;
    data_nascimento: string | null;
    data_aniversario?: string | null;
    cargos: string[] | null;
    faixa_etaria: string;
    foto_url: string | null;
    telefone?: string | null;
    status_telefone?: string | null;
    ativo?: boolean;
    inativado_em?: string | null;
    inativado_motivo?: string | null;
    inativado_observacao?: string | null;
    observacoes?: string | null;
  };
  onDeleted?: (id: string) => void;
  onEdit?: (id: string) => void;
  onViewHistory?: (id: string) => void;
}

interface Estatisticas {
  totalReunioes: number;
  presencas: number;
  taxaGeralPorcentagem: number;
  taxaMensalPorcentagem: number;
  ultimasPresencas: string[];
  alertaAusencias: boolean;
  historicoReunioes: { data: string; presente: boolean }[];
}

export function MemberDetailPanel({ membro, onDeleted, onEdit, onViewHistory }: MemberDetailProps) {
  const { activeGroupId } = useActiveGroup();
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (membro.ativo === false) return;
    if (!activeGroupId) {
      setEstatisticas({
        totalReunioes: 0,
        presencas: 0,
        taxaGeralPorcentagem: 0,
        taxaMensalPorcentagem: 0,
        ultimasPresencas: [],
        alertaAusencias: false,
        historicoReunioes: [],
      });
      return;
    }

    let isMounted = true;

    const loadEstatisticas = async () => {
      try {
        const { count: totalReunioes } = await supabase
          .from("reunioes")
          .select("*", { count: "exact", head: true })
          .eq("group_id", activeGroupId);

        const { data: presencasData, error: presencasError } = await supabase
          .from("presencas")
          .select("reuniao_id, reunioes(data)")
          .eq("membro_id", membro.id)
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
          .eq("membro_id", membro.id)
          .eq("group_id", activeGroupId)
          .gte("reunioes.data", umMesAtras.toISOString().split("T")[0]);

        const taxaMensal = reunioesMes ? ((presencasMes || 0) / reunioesMes) * 100 : 0;

        const ultimasPresencas = (presencasData || [])
          .slice(0, 3)
          .map((p: any) => p.reunioes?.data)
          .filter(Boolean);

        const { data: ultimasReunioes } = await supabase
          .from("reunioes")
          .select("id, data")
          .eq("group_id", activeGroupId)
          .order("data", { ascending: false })
          .limit(5);

        let ausenciasConsecutivas = 0;
        const historicoReunioes: { data: string; presente: boolean }[] = [];

        if (ultimasReunioes) {
          for (const reuniao of ultimasReunioes) {
            const { count } = await supabase
              .from("presencas")
              .select("*", { count: "exact", head: true })
              .eq("membro_id", membro.id)
              .eq("group_id", activeGroupId)
              .eq("reuniao_id", reuniao.id);

            const presente = (count || 0) > 0;
            historicoReunioes.push({ data: reuniao.data, presente });

            if (!presente) {
              ausenciasConsecutivas++;
            } else {
              break;
            }
          }
        }

        if (!isMounted) return;

        setEstatisticas({
          totalReunioes: totalReunioes || 0,
          presencas,
          taxaGeralPorcentagem: Math.round(taxaGeral),
          taxaMensalPorcentagem: Math.round(taxaMensal),
          ultimasPresencas,
          alertaAusencias: ausenciasConsecutivas >= 3,
          historicoReunioes,
        });
      } catch (error) {
        console.error("Erro ao carregar estatísticas do painel de membro:", error);
      }
    };

    loadEstatisticas();
    return () => {
      isMounted = false;
    };
  }, [activeGroupId, membro.id, membro.ativo]);

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

    // Tenta formatos baseados em hífen (ex: ISO 2024-02-12)
    if (raw.includes("-")) {
      try {
        return parseISO(raw);
      } catch {
        // segue para outros formatos
      }
    }

    // Tenta formatos brasileiros com barra: dd/MM ou dd/MM/yyyy
    const partes = raw.split("/");
    if (partes.length === 2 || partes.length === 3) {
      const [diaStr, mesStr, anoStr] = partes;
      const dia = Number(diaStr);
      const mes = Number(mesStr) - 1; // mês inicia em 0
      const ano = anoStr ? Number(anoStr) : 2000; // ano qualquer, usamos só dia/mês

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

  const getDataAniversarioTexto = () => {
    const dataPreferencial = parseDataAniversario(membro.data_aniversario);
    const fallbackNascimento = parseDataAniversario(membro.data_nascimento);
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
const getFrequenciaStatus = (percentual: number, contexto: "geral" | "mensal" = "geral") => {
  if (!percentual || percentual <= 0) {
    return {
      label: "Sem dados",
      toneClass: "text-muted-foreground",
      message: "Ainda não há presenças registradas para calcular a frequência.",
    };
  }

  if (percentual >= 80) {
    return {
      label: "Frequência excelente",
      toneClass: "text-primary",
      message:
        contexto === "geral"
          ? "Frequência excelente, acima de 80% no período geral."
          : "Frequência excelente, acima de 80% nas últimas 4 semanas.",
    };
  }

  if (percentual < 60) {
    return {
      label: "Frequência baixa",
      toneClass: "text-accent-foreground",
      message:
        contexto === "geral"
          ? "Atenção: frequência geral abaixo de 60%."
          : "Atenção: abaixo de 60% nas últimas 4 semanas.",
    };
  }

  return {
    label: "Frequência estável",
    toneClass: "text-muted-foreground",
    message:
      contexto === "geral"
        ? "Frequência estável entre 60% e 80% no período geral."
        : "Frequência estável entre 60% e 80% nas últimas 4 semanas.",
  };
};

  const handleDelete = async () => {
    if (deleting) return;
    if (!activeGroupId) {
      toast.error("Selecione/entre em um grupo antes de excluir membros.");
      return;
    }

    const confirmed = window.confirm("Tem certeza que deseja excluir este membro?");
    if (!confirmed) return;

    try {
      setDeleting(true);

      const { error: presencasError } = await supabase
        .from("presencas")
        .delete()
        .eq("membro_id", membro.id)
        .eq("group_id", activeGroupId);

      if (presencasError) throw presencasError;

      const { error: membroError } = await supabase
        .from("membros")
        .delete()
        .eq("id", membro.id)
        .eq("group_id", activeGroupId);

      if (membroError) throw membroError;

      toast.success("Membro excluído com sucesso.");
      onDeleted?.(membro.id);
    } catch (error) {
      console.error("Erro ao excluir membro:", error);
      toast.error("Erro ao excluir membro");
    } finally {
      setDeleting(false);
    }
  };

  const idade = calcularIdade(membro.data_nascimento);
  const dataAniversarioTexto = getDataAniversarioTexto();

  if (membro.ativo === false) {
    const formatarDataInativacao = (valor?: string | null) => {
      if (!valor) return "—";
      try {
        return format(parseISO(valor), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        return valor;
      }
    };

    return (
      <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 lg:gap-5 animate-slide-in-right member-detail-panel overflow-hidden">
        <Card className="flex-shrink-0 rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <CardContent className="pt-3.5 md:pt-4 pb-3.5 md:pb-4 flex items-center gap-3 md:gap-4">
            <div className="relative">
              <div className="rounded-2xl border border-border/70 bg-accent/50 p-1">
                <Avatar className="h-16 w-16 rounded-xl md:h-20 md:w-20">
                  <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || ""} alt={membro.nome} />
                  <AvatarFallback className="rounded-xl bg-primary/10 text-xl text-primary md:text-2xl">
                    {membro.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-semibold truncate">{membro.nome}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Este membro foi inativado e não exibe mais detalhes.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 flex-1 min-h-0 overflow-y-auto pr-1 md:pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
          <Card className="rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs md:text-sm">Motivo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-medium">
              {membro.inativado_motivo || "—"}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs md:text-sm">Observação</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-medium whitespace-pre-wrap">
              {membro.inativado_observacao || "—"}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs md:text-sm">Data</CardTitle>
            </CardHeader>
            <CardContent className="text-sm font-medium">
              {formatarDataInativacao(membro.inativado_em)}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 lg:gap-5 animate-slide-in-right member-detail-panel overflow-hidden">
      <Card className="flex-shrink-0 rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <CardContent className="pt-3.5 md:pt-4 pb-3.5 md:pb-4 flex items-center gap-3 md:gap-4">
          <div className="relative">
            <div className="rounded-2xl border border-border/70 bg-accent/50 p-1">
              <Avatar className="h-20 w-20 rounded-xl md:h-24 md:w-24">
                <AvatarImage className="rounded-xl object-cover" src={membro.foto_url || ""} alt={membro.nome} />
                <AvatarFallback className="rounded-xl bg-primary/10 text-xl text-primary md:text-2xl">
                  {membro.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-semibold truncate">{membro.nome}</h2>
            <div className="mt-2.5 md:mt-3 flex flex-wrap gap-1.5 md:gap-2">
              {idade !== null && (
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] md:px-3 md:py-1 md:text-xs">
                  {idade} anos
                </Badge>
              )}
              <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] capitalize md:px-3 md:py-1 md:text-xs">
                {membro.faixa_etaria}
              </Badge>
              {(membro.cargos ?? []).map((cargo) => (
                <Badge key={cargo} variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] md:px-3 md:py-1 md:text-xs">
                  {cargo}
                </Badge>
              ))}
              <Badge variant="outline" className="rounded-full border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] text-emerald-700 md:px-3 md:py-1 md:text-xs dark:text-emerald-300">Ativo</Badge>
            </div>
          </div>
          <div className="member-card-actions flex shrink-0 items-start justify-end gap-1.5 self-start">
            <button
              type="button"
              className="member-card-action"
              aria-label="Ver perfil completo"
              title="Ver perfil completo"
              onClick={() => onViewHistory?.(membro.id)}
            >
              <IdCard className="h-4 w-4" />
              <span className="member-card-action-label">Perfil</span>
            </button>
            <button
              type="button"
              className="member-card-action"
              aria-label="Editar membro"
              title="Editar membro"
              onClick={() => onEdit?.(membro.id)}
            >
              <Pencil className="h-4 w-4" />
              <span className="member-card-action-label">Editar</span>
            </button>
            <button
              type="button"
              className="member-card-action member-card-action-danger"
              aria-label="Excluir membro"
              title="Excluir membro"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              <span className="member-card-action-label">Excluir</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4 xl:gap-5 flex-1 min-h-0 overflow-y-auto pr-1 md:pr-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
        <MemberInformationCard
          className="order-1"
          telefone={membro.telefone}
          statusTelefone={membro.status_telefone}
          cargos={membro.cargos}
          aniversario={dataAniversarioTexto}
          observacoes={membro.observacoes}
        />

        {estatisticas ? (
          <MemberFrequencyCard
            className="order-2"
            presencas={estatisticas.presencas}
            totalReunioes={estatisticas.totalReunioes}
            taxaGeralPorcentagem={estatisticas.taxaGeralPorcentagem}
            taxaMensalPorcentagem={estatisticas.taxaMensalPorcentagem}
            ultimasPresencas={estatisticas.ultimasPresencas}
            alertaAusencias={estatisticas.alertaAusencias}
            formatarData={formatarData}
          />
        ) : (
          <Card className="order-2 rounded-3xl border-border/55 bg-card/90 p-4 shadow-[var(--shadow-card)]">
            <Skeleton className="h-full min-h-64 w-full rounded-2xl" />
          </Card>
        )}
      </div>
    </div>
  );
}

