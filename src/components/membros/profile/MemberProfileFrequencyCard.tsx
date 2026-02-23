import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

type Props = {
  presencas: number;
  totalReunioes: number;
  taxaGeralPorcentagem: number;
  taxaMensalPorcentagem: number;
  ultimasPresencas: string[];
  alertaAusencias: boolean;
  formatarData: (isoDate: string) => string;
};

export function MemberProfileFrequencyCard({
  presencas,
  totalReunioes,
  taxaGeralPorcentagem,
  taxaMensalPorcentagem,
  ultimasPresencas,
  alertaAusencias,
  formatarData,
}: Props) {
  return (
    <Card className="shadow-[var(--shadow-soft)] border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Estatísticas de Frequência</CardTitle>
          {alertaAusencias ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Presenças</p>
            <p className="text-2xl font-bold text-primary">{presencas}</p>
            <p className="text-xs text-muted-foreground">de {totalReunioes} reuniões</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Taxa Geral</p>
            <p className="text-2xl font-bold text-primary">{taxaGeralPorcentagem}%</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-1">Taxa Mensal</p>
          <p className="text-xl font-bold text-primary">{taxaMensalPorcentagem}%</p>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>

        {ultimasPresencas.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Últimas Presenças</p>
            <div className="space-y-1">
              {ultimasPresencas.map((data, idx) => (
                <div key={idx} className="text-sm text-muted-foreground">
                  • {formatarData(data)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
