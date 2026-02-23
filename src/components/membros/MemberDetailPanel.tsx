import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, BarChart3, Calendar, IdCard, Pencil, Phone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  };
  onEdit?: (id: string) => void;
  onDeleted?: (id: string) => void;
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

export function MemberDetailPanel({ membro, onEdit, onDeleted }: MemberDetailProps) {
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadEstatisticas = async () => {
      try {
        const { count: totalReunioes } = await supabase
          .from("reunioes")
          .select("*", { count: "exact", head: true });

        const { data: presencasData, error: presencasError } = await supabase
          .from("presencas")
          .select("reuniao_id, reunioes(data)")
          .eq("membro_id", membro.id)
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
          .eq("membro_id", membro.id)
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
          .limit(5);

        let ausenciasConsecutivas = 0;
        const historicoReunioes: { data: string; presente: boolean }[] = [];

        if (ultimasReunioes) {
          for (const reuniao of ultimasReunioes) {
            const { count } = await supabase
              .from("presencas")
              .select("*", { count: "exact", head: true })
              .eq("membro_id", membro.id)
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
  }, [membro.id]);

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

  const handleEdit = () => {
    if (onEdit) {
      onEdit(membro.id);
    } else {
      toast.info("Em breve: editar membro diretamente daqui.");
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const confirmed = window.confirm("Tem certeza que deseja excluir este membro?");
    if (!confirmed) return;

    try {
      setDeleting(true);

      const { error: presencasError } = await supabase
        .from("presencas")
        .delete()
        .eq("membro_id", membro.id);

      if (presencasError) throw presencasError;

      const { error: membroError } = await supabase
        .from("membros")
        .delete()
        .eq("id", membro.id);

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
  return (
    <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 lg:gap-5 animate-slide-in-right member-detail-panel overflow-hidden">
      <div className="flex items-center justify-between text-[11px] md:text-xs text-muted-foreground mb-0.5 md:mb-1">
        <p>
          <span>Membros</span>
          <span className="mx-1">›</span>
          <span className="font-medium text-foreground truncate inline-block max-w-[180px] sm:max-w-xs">
            {membro.nome}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={handleEdit}
            aria-label="Editar membro"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={handleDelete}
            aria-label="Excluir membro"
            disabled={deleting}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Card className="shadow-[var(--shadow-soft)] border-border/60 bg-card/90 backdrop-blur-sm flex-shrink-0">
        <CardContent className="pt-3.5 md:pt-4 pb-3.5 md:pb-4 flex items-center gap-3 md:gap-4">
          <div className="relative">
            <div className="rounded-full p-1.5 bg-accent/60 border border-border/80">
              <Avatar className="h-16 w-16 md:h-20 md:w-20">
                <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl md:text-2xl">
                  {membro.nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-semibold truncate">{membro.nome}</h2>
            {idade && (
              <p className="text-muted-foreground mt-0.5 md:mt-1 text-sm md:text-base">{idade} anos</p>
            )}
            <div className="mt-2.5 md:mt-3 flex flex-wrap gap-1.5 md:gap-2">
              {(membro.cargos ?? []).map((cargo) => (
                <Badge key={cargo} variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] md:px-3 md:py-1 md:text-xs">
                  {cargo}
                </Badge>
              ))}
              <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] md:px-3 md:py-1 md:text-xs">
                {membro.faixa_etaria}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-rows-2 gap-3 md:gap-4 xl:gap-5 flex-1 min-h-0 auto-rows-fr overflow-y-auto pr-1 md:pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
        <Card className="shadow-[var(--shadow-soft)] border-border/60 bg-card/90 order-1">
          <CardHeader className="pb-1.5 md:pb-2 flex items-center gap-1.5">
            <IdCard className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-xs md:text-sm">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 md:space-y-2 text-[11px] md:text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Faixa etária</span>
              <span className="font-medium text-right">{membro.faixa_etaria}</span>
            </div>
            {dataAniversarioTexto && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Data de aniversário</span>
                <span className="font-medium text-right">{dataAniversarioTexto}</span>
              </div>
            )}
            {membro.telefone && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone
                </span>
                <span className="font-medium text-right break-all max-w-[9rem] md:max-w-none">{membro.telefone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)] border-border/60 bg-card/90 md:row-span-2 order-2">
          <CardHeader className="pb-1.5 md:pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs md:text-sm">Estatísticas de Frequência</CardTitle>
            </div>
            {estatisticas?.alertaAusencias && (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent className="space-y-2.5 md:space-y-3">
            {estatisticas ? (
              <div className="space-y-2.5 md:space-y-3 text-[11px] md:text-xs">
                <div>
                  <div className="flex items-center justify-between mb-0.5 md:mb-1">
                    <p className="text-muted-foreground">Taxa geral</p>
                    <span className="font-semibold text-foreground">
                      {estatisticas.taxaGeralPorcentagem}%
                    </span>
                  </div>
                  <Progress value={estatisticas.taxaGeralPorcentagem} className="h-2" />
                  {(() => {
                    const status = getFrequenciaStatus(estatisticas.taxaGeralPorcentagem, "geral");
                    return (
                      <>
                        <p className={cn("mt-0.5 md:mt-1 text-[10px] md:text-[11px]", status.toneClass)}>
                          {status.label}
                        </p>
                        <p className="text-[10px] md:text-[11px] text-muted-foreground mt-0.5">
                          {status.message}
                        </p>
                      </>
                    );
                  })()}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5 md:mb-1">
                    <p className="text-muted-foreground">Últimos 30 dias</p>
                    <span className="font-semibold text-foreground">
                      {estatisticas.taxaMensalPorcentagem}%
                    </span>
                  </div>
                  <Progress value={estatisticas.taxaMensalPorcentagem} className="h-2" />
                  {(() => {
                    const status = getFrequenciaStatus(estatisticas.taxaMensalPorcentagem, "mensal");
                    return (
                      <>
                        <p className={cn("mt-0.5 md:mt-1 text-[10px] md:text-[11px]", status.toneClass)}>
                          {status.label}
                        </p>
                        <p className="text-[10px] md:text-[11px] text-muted-foreground mt-0.5">
                          {status.message}
                        </p>
                      </>
                    );
                  })()}
                </div>

                <div className="rounded-lg bg-secondary/60 px-2.5 md:px-3 py-1.5 md:py-2 flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground">Presenças registradas</p>
                    <p className="text-base md:text-lg font-semibold text-primary">
                      {estatisticas.presencas}
                    </p>
                  </div>
                  <p className="text-[10px] md:text-[11px] text-muted-foreground text-right">
                    em {estatisticas.totalReunioes} reuniões
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-3 w-3/4 rounded-full" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <Skeleton className="h-2.5 w-5/6 rounded-full" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)] border-border/60 bg-card/90 order-3">
          <CardHeader className="pb-1.5 md:pb-2 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-xs md:text-sm">Histórico de Presença</CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] md:text-xs">
            {estatisticas?.historicoReunioes?.length ? (
              <div className="space-y-2 max-h-48 md:max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                {estatisticas.historicoReunioes.map((item, index) => (
                  <div
                    key={`${item.data}-${index}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 bg-secondary/60 border-l-2",
                      item.presente ? "border-primary" : "border-destructive/70",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Reunião</span>
                      <span className="font-medium">{formatarData(item.data)}</span>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] md:text-[11px] font-medium",
                        item.presente ? "text-primary" : "text-destructive",
                      )}
                    >
                      {item.presente ? "Presente" : "Ausente"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-3 md:py-4 gap-1.5 md:gap-2">
                <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-secondary flex items-center justify-center">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <p className="text-[11px] md:text-xs text-muted-foreground max-w-xs">
                  Este membro ainda não possui registros de presença.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-0.5 md:mt-1"
                  onClick={() => toast.info("Em breve: registrar primeira presença.")}
                >
                  Registrar primeira presença
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

