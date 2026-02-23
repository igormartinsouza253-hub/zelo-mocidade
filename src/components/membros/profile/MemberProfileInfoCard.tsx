import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";

type Props = {
  telefone?: string | null;
  statusTelefone?: string | null;
  dataAniversarioTexto?: string | null;
  observacoes?: string | null;
};

export function MemberProfileInfoCard({
  telefone,
  statusTelefone,
  dataAniversarioTexto,
  observacoes,
}: Props) {
  const hasContato = Boolean(telefone) || Boolean(dataAniversarioTexto);
  const hasObs = Boolean(observacoes);

  if (!hasContato && !hasObs) return null;

  return (
    <Card className="shadow-[var(--shadow-soft)] border-border/50">
      <CardHeader className="pb-3">
        <CardTitle>Informações</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasContato && (
          <div className="grid gap-3">
            {telefone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{telefone}</p>
                  {statusTelefone ? (
                    <p className="text-xs text-muted-foreground capitalize">{statusTelefone}</p>
                  ) : null}
                </div>
              </div>
            )}

            {dataAniversarioTexto && (
              <div>
                <p className="text-sm text-muted-foreground">Data de aniversário</p>
                <p className="font-medium">{dataAniversarioTexto}</p>
              </div>
            )}
          </div>
        )}

        {observacoes && (
          <div className="pt-1 border-t border-border/40">
            <p className="text-sm text-muted-foreground">Observações</p>
            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
