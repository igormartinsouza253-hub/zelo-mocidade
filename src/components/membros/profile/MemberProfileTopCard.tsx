import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  nome: string;
  fotoUrl?: string | null;
  cargos?: string[] | null;
  faixaEtaria?: string;
  idade?: number | null;
};

export function MemberProfileTopCard({ nome, fotoUrl, cargos, faixaEtaria, idade }: Props) {
  const inicial = (nome?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <Card className="shadow-[var(--shadow-soft)] border-border/50">
      <CardContent className="pt-5 md:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground truncate">{nome}</h1>

            <div className="mt-2 flex flex-wrap gap-2">
              {(cargos ?? []).slice(0, 6).map((cargo) => (
                <Badge key={cargo} variant="secondary">
                  {cargo}
                </Badge>
              ))}
              {faixaEtaria ? <Badge variant="outline">{faixaEtaria}</Badge> : null}
              {typeof idade === "number" ? <Badge variant="outline">{idade} anos</Badge> : null}
            </div>
          </div>

          <div className="flex-shrink-0">
            <Avatar className="h-20 w-20 md:h-24 md:w-24">
              <AvatarImage src={fotoUrl || ""} alt={nome} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">{inicial}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
