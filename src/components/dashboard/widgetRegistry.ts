import { WidgetData } from "./types";

export const WIDGET_REGISTRY: Record<string, WidgetData> = {
  stats: {
    id: "stats",
    type: "stats",
    title: "Resumo de Frequência",
    description: "Total de membros, reuniões e média de presença",
    icon: "BarChart3",
    defaultLayout: {
      desktop: { w: 3, h: 2 }, // 3x2
      tablet: { w: 3, h: 2 },
      mobile: { w: 2, h: 2 },
    },
  },
  nextMeeting: {
    id: "nextMeeting",
    type: "nextMeeting",
    title: "Próxima Reunião",
    description: "Informações sobre a próxima reunião agendada",
    icon: "Calendar",
    defaultLayout: {
      desktop: { w: 3, h: 2 }, // 3x2
      tablet: { w: 3, h: 2 },
      mobile: { w: 2, h: 2 },
    },
  },
  frequencySummary: {
    id: "frequencySummary",
    type: "frequencySummary",
    title: "Frequência Geral",
    description: "Percentual geral de frequência",
    icon: "TrendingUp",
    defaultLayout: {
      desktop: { w: 3, h: 2 }, // 3x2
      tablet: { w: 3, h: 2 },
      mobile: { w: 2, h: 2 },
    },
  },
  faixaEtariaChart: {
    id: "faixaEtariaChart",
    type: "faixaEtariaChart",
    title: "Presença por Faixa Etária",
    description: "Distribuição de membros por faixa etária",
    icon: "PieChart",
    defaultLayout: {
      desktop: { w: 3, h: 3 }, // 3x3
      tablet: { w: 6, h: 3 },
      mobile: { w: 2, h: 3 },
    },
  },
  reunioesChart: {
    id: "reunioesChart",
    type: "reunioesChart",
    title: "Gráfico das Últimas Reuniões",
    description: "Presença nas últimas 5 reuniões",
    icon: "BarChart2",
    defaultLayout: {
      desktop: { w: 6, h: 3 }, // 6x3
      tablet: { w: 6, h: 3 },
      mobile: { w: 2, h: 3 },
    },
  },
  topMembros: {
    id: "topMembros",
    type: "topMembros",
    title: "Top Frequência",
    description: "Membros mais e menos frequentes",
    icon: "Users",
    defaultLayout: {
      desktop: { w: 3, h: 3 }, // 3x3
      tablet: { w: 6, h: 3 },
      mobile: { w: 2, h: 3 },
    },
  },
  notas: {
    id: "notas",
    type: "notas",
    title: "Notas Rápidas",
    description: "Anotações e lembretes",
    icon: "StickyNote",
    defaultLayout: {
      desktop: { w: 6, h: 3 }, // 6x3
      tablet: { w: 6, h: 4 },
      mobile: { w: 2, h: 4 },
    },
  },
  quickActions: {
    id: "quickActions",
    type: "quickActions",
    title: "Ações Rápidas",
    description: "Atalhos para cadastros e navegação",
    icon: "Zap",
    defaultLayout: {
      desktop: { w: 3, h: 2 }, // 3x2
      tablet: { w: 3, h: 2 },
      mobile: { w: 2, h: 2 },
    },
  },
  birthdays: {
    id: "birthdays",
    type: "birthdays",
    title: "Aniversariantes",
    description: "Próximos aniversários dos membros",
    icon: "Gift",
    defaultLayout: {
      desktop: { w: 3, h: 3 }, // 3x3
      tablet: { w: 3, h: 3 },
      mobile: { w: 2, h: 3 },
    },
  },
};
