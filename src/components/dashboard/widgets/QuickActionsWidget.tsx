import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, CalendarPlus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface QuickActionsWidgetProps {
  size: WidgetSize;
}

export const QuickActionsWidget = ({ size }: QuickActionsWidgetProps) => {
  const navigate = useNavigate();

  const actions = [
    { icon: UserPlus, label: "Novo Membro", path: "/membros/novo" },
    { icon: CalendarPlus, label: "Nova Reunião", path: "/reunioes/nova" },
    { icon: Settings, label: "Configurações", path: "/configuracoes" },
  ];

  if (size === "sm") {
    return (
      <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col justify-center md:rounded-xl overflow-hidden">
        <CardContent className="grid grid-cols-1 gap-2 px-2 pb-2 pt-1.5">
          {actions.slice(0, 2).map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={() => navigate(action.path)}
              className="flex items-center gap-2 rounded-2xl bg-accent px-3 py-2 text-[11px] font-medium text-foreground shadow-sm hover:bg-accent/80 transition-colors"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <action.icon className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (size === "md") {
    return (
      <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
      <CardHeader className={WIDGET_HEADER_PADDING["md"]}>
        <CardTitle className={widgetTitleClass("md")}>
          Ações rápidas
        </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 grid grid-cols-1 gap-1.5 px-3 pb-3 pt-0">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant="secondary"
              className="justify-start gap-2.5 h-9 text-sm rounded-full px-3"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="h-4 w-4 text-primary" />
              <span className="truncate font-medium">{action.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-card text-card-foreground border-border/40 shadow-[var(--shadow-card)] flex flex-col md:rounded-xl overflow-hidden">
      <CardHeader className={WIDGET_HEADER_PADDING["lg"]}>
        <CardTitle className={widgetTitleClass("lg")}>
          Ações rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 grid grid-cols-3 gap-2 px-3 pb-3 pt-0.5">
        {actions.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-accent px-3 py-3 text-[11px] md:text-xs font-medium text-foreground shadow-sm hover:bg-accent/80 transition-colors"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="truncate text-center leading-tight">{action.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
