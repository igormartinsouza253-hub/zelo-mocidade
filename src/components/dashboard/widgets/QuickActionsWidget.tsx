import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarPlus, Handshake, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { WidgetSize } from "../types";
import { WIDGET_HEADER_PADDING, widgetTitleClass } from "../widgetHeaderStyles";

interface QuickActionsWidgetProps {
  size: WidgetSize;
}

export const QuickActionsWidget = ({ size }: QuickActionsWidgetProps) => {
  const navigate = useNavigate();

  const actions = [
    { icon: CalendarPlus, label: "Nova reunião", path: "/reunioes/nova", primary: true },
    { icon: UserPlus, label: "Novo membro", path: "/membros/novo" },
    { icon: Handshake, label: "Nova visita", path: "/visitas/nova" },
  ];

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden border-border/40 bg-card text-card-foreground shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className={WIDGET_HEADER_PADDING[size]}>
        <CardTitle className={widgetTitleClass(size)}>Ações rápidas</CardTitle>
      </CardHeader>

      <CardContent className="grid min-h-0 flex-1 grid-cols-3 gap-2 px-3 pb-2 pt-0">
        {actions.map((action) => (
          <button
            key={action.path}
            type="button"
            onClick={() => navigate(action.path)}
            className={`flex min-h-[38px] items-center justify-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              action.primary
                ? "border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border/60 bg-background hover:bg-accent/70"
            }`}
          >
            <action.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
