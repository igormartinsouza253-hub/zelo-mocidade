import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, AlertTriangle, Users, MoreVertical, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { MemberProfileTopCard } from "@/components/membros/profile/MemberProfileTopCard";
import { MemberProfileInfoCard } from "@/components/membros/profile/MemberProfileInfoCard";
import { MemberProfileFrequencyCard } from "@/components/membros/profile/MemberProfileFrequencyCard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InactivateMemberDialog } from "@/components/membros/InactivateMemberDialog";

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
}

interface Estatisticas {
  totalReunioes: number;
  presencas: number;
  taxaGeralPorcentagem: number;
  taxaMensalPorcentagem: number;
  ultimasPresencas: string[];
  alertaAusencias: boolean;
}

const VisualizarMembro = () => {
  const navigate = useNavigate();
  const { id } = useParams();
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
  const [inactivateOpen, setInactivateOpen] = useState(false);
  const [inactivating, setInactivating] = useState(false);

  useEffect(() => {
    loadMembro();
    loadEstatisticas();
  }, [id]);

  const handleDelete = useCallback(() => {
    if (!membro) return;
    setInactivateOpen(true);
  }, [membro]);

  const handleConfirmInactivate = useCallback(
    async ({ reason, note }: { reason: string; note: string | null }) => {
      if (!membro) return;

      try {
        setInactivating(true);
        const { error: membroError } = await supabase
          .from("membros")
          .update({
            ativo: false,
            inativado_em: new Date().toISOString(),
            inativado_motivo: reason,
            inativado_observacao: note,
          })
          .eq("id", membro.id);
        if (membroError) throw membroError;

        toast.success("Membro inativado com sucesso.");
        navigate("/membros");
      } catch (error) {
        console.error("Erro ao inativar membro:", error);
        toast.error("Erro ao inativar membro");
      } finally {
        setInactivating(false);
        setInactivateOpen(false);
      }
    },
    [membro, navigate],
  );

  useEffect(() => {
    if (!membro) return;

    setConfig({
      title: membro.nome,
      icon: Users,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Membros", href: "/membros" },
        { label: membro.nome },
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
              Excluir
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
        .limit(3);

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
        alertaAusencias: ausenciasConsecutivas >= 3,
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

    if (raw.includes("-")) {
      try {
        return parseISO(raw);
      } catch {
        // segue para outros formatos
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

  return (
    <>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-2xl md:pb-8">
          {/* Cabeçalho principal agora é controlado pelo layout */}

          {/* Topo: Nome (esq) + Foto (dir) */}
          <div className="mb-4 md:mb-6">
            <MemberProfileTopCard
              nome={membro.nome}
              fotoUrl={membro.foto_url}
              cargos={membro.cargos}
              faixaEtaria={membro.faixa_etaria}
              idade={calcularIdade(membro.data_nascimento)}
            />
          </div>

          {/* Alerta de Ausências */}
          {estatisticas.alertaAusencias && (
            <Card className="shadow-[var(--shadow-soft)] border-destructive/50 bg-destructive/5 mb-4 md:mb-6">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive font-medium">
                  Atenção: Faltou 3 ou mais reuniões consecutivas
                </p>
              </CardContent>
            </Card>
          )}

          {/* Bloco abaixo: informações do membro */}
          <div className="mb-4 md:mb-6">
            <MemberProfileInfoCard
              telefone={membro.telefone}
              statusTelefone={membro.status_telefone}
              dataAniversarioTexto={dataAniversarioTexto}
              observacoes={membro.observacoes}
            />
          </div>

          {/* Logo abaixo: estatísticas de frequência */}
          <MemberProfileFrequencyCard
            presencas={estatisticas.presencas}
            totalReunioes={estatisticas.totalReunioes}
            taxaGeralPorcentagem={estatisticas.taxaGeralPorcentagem}
            taxaMensalPorcentagem={estatisticas.taxaMensalPorcentagem}
            ultimasPresencas={estatisticas.ultimasPresencas}
            alertaAusencias={estatisticas.alertaAusencias}
            formatarData={formatarData}
          />
        </div>
      </div>

      <InactivateMemberDialog
        open={inactivateOpen}
        onOpenChange={(open) => {
          if (!open && !inactivating) setInactivateOpen(false);
        }}
        title="Inativar membro"
        confirmLabel="Inativar"
        loading={inactivating}
        onConfirm={handleConfirmInactivate}
      />
    </>
  );
};

export default VisualizarMembro;
