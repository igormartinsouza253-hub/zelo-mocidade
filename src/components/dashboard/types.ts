export type WidgetSize = "sm" | "md" | "lg";

export type WidgetType =
  | "stats"
  | "nextMeeting"
  | "frequencySummary"
  | "faixaEtariaChart"
  | "reunioesChart"
  | "topMembros"
  | "notas"
  | "quickActions"
  | "birthdays";

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetData {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  icon: string;
  defaultLayout: {
    desktop: { w: number; h: number };
    tablet: { w: number; h: number };
    mobile: { w: number; h: number };
  };
  settings?: Record<string, any>;
}

export interface DashboardLayout {
  layouts: {
    lg: WidgetLayout[];
    md: WidgetLayout[];
    sm: WidgetLayout[];
  };
  activeWidgets: string[];
}
