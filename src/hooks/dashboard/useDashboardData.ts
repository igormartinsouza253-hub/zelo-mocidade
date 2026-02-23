import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateShort } from "@/lib/date-utils";
import { toast } from "sonner";

export type DashboardStats = {
  totalMembros: number;
  totalReunioes: number;
  mediaPresenca: number;
  ultimaReuniao: string;
};

export type DashboardFrequenciaData = {
  reunioesRecentes: any[];
  porFaixaEtaria: { faixa: string; total: number }[];
  top5Membros: { id: string; nome: string; presencas: number; foto_url?: string | null }[];
  percentualGeral: number;
};

export type DashboardNota = {
  id: string;
  conteudo: string;
  created_at: string;
  user_id: string;
};

export type AniversarianteItem = {
  id: string;
  nome: string;
  data: string;
  idade?: number;
  foto_url?: string | null;
};

export function useDashboardData() {
  const [showLeastFrequent, setShowLeastFrequent] = useState(false);
  const [topPeriod, setTopPeriod] = useState<"1m" | "3m" | "1y">("1y");

  const [stats, setStats] = useState<DashboardStats>({
    totalMembros: 0,
    totalReunioes: 0,
    mediaPresenca: 0,
    ultimaReuniao: "-",
  });

  const [frequenciaData, setFrequenciaData] = useState<DashboardFrequenciaData>({
    reunioesRecentes: [],
    porFaixaEtaria: [],
    top5Membros: [],
    percentualGeral: 0,
  });

  const [notas, setNotas] = useState<DashboardNota[]>([]);
  const [aniversariantes, setAniversariantes] = useState<AniversarianteItem[]>([]);

  useEffect(() => {
    void loadStats();
    void loadFrequenciaData();
    void loadNotas();
    void loadAniversariantes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeastFrequent, topPeriod]);

  const loadStats = async () => {
    try {
      const { data: membros } = await supabase.from("membros").select("id");
      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, numero_visitas")
        .order("data", { ascending: false });
      const { data: presencas } = await supabase.from("presencas").select("id");

      const totalMembros = membros?.length || 0;
      const totalReunioes = reunioes?.length || 0;
      const totalPresencas = presencas?.length || 0;
      const totalVisitas =
        reunioes?.reduce((sum, r) => sum + (r.numero_visitas || 0), 0) || 0;
      const mediaPresenca =
        totalReunioes > 0 ? Math.round((totalPresencas + totalVisitas) / totalReunioes) : 0;
      const ultimaReuniao = reunioes?.[0]?.data || "-";

      setStats({ totalMembros, totalReunioes, mediaPresenca, ultimaReuniao });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const loadNotas = async () => {
    try {
      const { data, error } = await supabase
        .from("notas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNotas((data || []) as DashboardNota[]);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
    }
  };

  const loadAniversariantes = async () => {
    try {
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      const diaAtual = hoje.getDate();
      const anoAtual = hoje.getFullYear();

      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, data_aniversario, data_nascimento, foto_url")
        .order("nome");
      if (error) throw error;

      type MembroRow = {
        id: string;
        nome: string;
        data_aniversario: string | null;
        data_nascimento: string | null;
        foto_url: string | null;
      };

      const calcularDiasAteAniversario = (
        mesAtualIn: number,
        diaAtualIn: number,
        mesAniversario: number,
        diaAniversario: number,
      ) => {
        const hojeDate = new Date(anoAtual, mesAtualIn - 1, diaAtualIn);
        const aniversarioEsteAno = new Date(anoAtual, mesAniversario - 1, diaAniversario);

        if (aniversarioEsteAno < hojeDate) {
          const aniversarioProximoAno = new Date(anoAtual + 1, mesAniversario - 1, diaAniversario);
          const diffTime = aniversarioProximoAno.getTime() - hojeDate.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const diffTime = aniversarioEsteAno.getTime() - hojeDate.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      };

      const membros = (data || []) as MembroRow[];
      const aniversariantesMes: AniversarianteItem[] = [];

      membros.forEach((membro) => {
        let mesAniversario: number | null = null;
        let diaAniversario: number | null = null;
        let idade: number | undefined;

        if (membro.data_aniversario) {
          const [mesStr, diaStr] = membro.data_aniversario.split("-");
          const mes = Number(mesStr);
          const dia = Number(diaStr);
          if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
            mesAniversario = mes;
            diaAniversario = dia;
          }
        } else if (membro.data_nascimento) {
          const [anoStr, mesStr, diaStr] = membro.data_nascimento.split("-");
          const anoNasc = Number(anoStr);
          const mes = Number(mesStr);
          const dia = Number(diaStr);
          mesAniversario = mes;
          diaAniversario = dia;

          idade = anoAtual - anoNasc;
          const mesPassou = mesAtual > mes;
          const mesIgualDiaPassou = mesAtual === mes && diaAtual >= dia;
          if (!mesPassou && !mesIgualDiaPassou) {
            idade--;
          }
        }

        if (!mesAniversario || !diaAniversario) return;

        const dataIso = `${anoAtual}-${String(mesAniversario).padStart(2, "0")}-${String(diaAniversario).padStart(
          2,
          "0",
        )}`;

        aniversariantesMes.push({
          id: membro.id,
          nome: membro.nome,
          data: dataIso,
          idade,
          foto_url: membro.foto_url,
        });
      });

      const ordenados = aniversariantesMes.sort((a, b) => {
        const [, mesA, diaA] = a.data.split("-").map(Number);
        const [, mesB, diaB] = b.data.split("-").map(Number);
        return (
          calcularDiasAteAniversario(mesAtual, diaAtual, mesA, diaA) -
          calcularDiasAteAniversario(mesAtual, diaAtual, mesB, diaB)
        );
      });

      setAniversariantes(ordenados);
    } catch (error) {
      console.error("Erro ao carregar aniversariantes do dashboard:", error);
    }
  };

  const deletarNota = async (id: string) => {
    try {
      const { error } = await supabase.from("notas").delete().eq("id", id);
      if (error) throw error;
      await loadNotas();
      toast.success("Nota excluída com sucesso");
    } catch (error) {
      console.error("Erro ao deletar nota:", error);
      toast.error("Erro ao excluir nota");
    }
  };

  const loadFrequenciaData = async () => {
    try {
      const now = new Date();
      let cutoffDate: Date | null = null;

      if (topPeriod === "1m") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      } else if (topPeriod === "3m") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      } else if (topPeriod === "1y") {
        cutoffDate = null;
      }

      let reunioesPeriodoIds: string[] = [];

      if (cutoffDate) {
        const cutoffIso = cutoffDate.toISOString().slice(0, 10);
        const { data: reunioesPeriodo } = await supabase
          .from("reunioes")
          .select("id, data")
          .gte("data", cutoffIso);
        reunioesPeriodoIds = (reunioesPeriodo || []).map((r) => r.id);
      }

      const { data: reunioes } = await supabase
        .from("reunioes")
        .select("id, data, numero_visitas, recitativos_individuais")
        .order("data", { ascending: false })
        .limit(5);

      const reunioesComPresencas = await Promise.all(
        (reunioes || []).map(async (reuniao) => {
          const { data: presencas } = await supabase
            .from("presencas")
            .select("membro_id")
            .eq("reuniao_id", reuniao.id);

          const membroIds = presencas?.map((p) => p.membro_id) || [];
          const { data: membrosPresentes } = await supabase
            .from("membros")
            .select("faixa_etaria")
            .in("id", membroIds);

          const faixasCount: Record<string, number> = {};
          (membrosPresentes || []).forEach((membro) => {
            faixasCount[membro.faixa_etaria] = (faixasCount[membro.faixa_etaria] || 0) + 1;
          });

          return {
            data: formatDateShort(reuniao.data).slice(0, 5),
            total:
              (presencas?.length || 0) +
              (reuniao.numero_visitas || 0) +
              (reuniao.recitativos_individuais || 0),
            visitas: reuniao.numero_visitas || 0,
            recitativos_individuais: reuniao.recitativos_individuais || 0,
            Crianças: faixasCount["Crianças"] || 0,
            Meninos: faixasCount["Meninos"] || 0,
            Meninas: faixasCount["Meninas"] || 0,
            Moços: faixasCount["Moços"] || 0,
            Moças: faixasCount["Moças"] || 0,
          };
        }),
      );

      const { data: membros } = await supabase.from("membros").select("id, nome, faixa_etaria, foto_url");

      const faixasMap = new Map<string, number>();
      (membros || []).forEach((membro) => {
        const count = faixasMap.get(membro.faixa_etaria) || 0;
        faixasMap.set(membro.faixa_etaria, count + 1);
      });

      const porFaixaEtaria = Array.from(faixasMap.entries()).map(([faixa, total]) => ({ faixa, total }));

      const presencasPorMembro = await Promise.all(
        (membros || []).map(async (membro) => {
          if (cutoffDate && reunioesPeriodoIds.length === 0) {
            return { id: membro.id, nome: membro.nome, foto_url: membro.foto_url ?? null, presencas: 0 };
          }

          let query = supabase.from("presencas").select("id").eq("membro_id", membro.id);
          if (reunioesPeriodoIds.length > 0) {
            query = query.in("reuniao_id", reunioesPeriodoIds);
          }

          const { data: presencas } = await query;
          return {
            id: membro.id,
            nome: membro.nome,
            foto_url: membro.foto_url ?? null,
            presencas: presencas?.length || 0,
          };
        }),
      );

      const sortedMembros = [...presencasPorMembro].sort((a, b) =>
        showLeastFrequent ? a.presencas - b.presencas : b.presencas - a.presencas,
      );

      const top5Membros = showLeastFrequent ? sortedMembros.filter((m) => m.presencas >= 0) : sortedMembros.filter((m) => m.presencas > 0);

      const totalMembros = membros?.length || 0;
      const totalReunioes = reunioes?.length || 0;
      const totalParticipantesNasReunioes = reunioesComPresencas.reduce((sum, r) => sum + r.total, 0);
      const percentualGeral =
        totalMembros > 0 && totalReunioes > 0
          ? Math.max(0, Math.min(100, Math.round((totalParticipantesNasReunioes / (totalMembros * totalReunioes)) * 100)))
          : 0;

      setFrequenciaData({
        reunioesRecentes: reunioesComPresencas.reverse(),
        porFaixaEtaria,
        top5Membros,
        percentualGeral,
      });
    } catch (error) {
      console.error("Erro ao carregar dados de frequência:", error);
    }
  };

  return {
    stats,
    frequenciaData,
    notas,
    aniversariantes,
    showLeastFrequent,
    setShowLeastFrequent,
    topPeriod,
    setTopPeriod,
    deletarNota,
  };
}
