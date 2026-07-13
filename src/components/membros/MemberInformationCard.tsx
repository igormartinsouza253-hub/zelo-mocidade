import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, CalendarDays, MessageSquare, Phone } from "lucide-react";

interface MemberInformationCardProps {
  telefone?: string | null;
  statusTelefone?: string | null;
  phoneOwner?: string | null;
  cargos?: string[] | null;
  aniversario?: string | null;
  observacoes?: string | null;
  className?: string;
}

export function MemberInformationCard({
  telefone,
  statusTelefone,
  phoneOwner = normalizePhoneOwner(statusTelefone),
  cargos = [],
  aniversario,
  observacoes,
  className = "",
}: MemberInformationCardProps) {
  return (
    <Card className={`member-information-card overflow-hidden rounded-3xl border-border/55 bg-card/90 shadow-[var(--shadow-card)] ${className}`}>
      <CardHeader className="member-information-header px-4 pb-2 pt-4">
        <CardTitle className="text-base">Informações</CardTitle>
      </CardHeader>
      <CardContent className="member-information-content flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4">
        <InformationRow icon={Phone} label="Telefone">
          <p className="mt-1 break-words text-sm font-semibold text-foreground">{formatPhoneBR(telefone)}</p>
          {phoneOwner && <p className="text-xs text-muted-foreground">Telefone de {phoneOwner}</p>}
        </InformationRow>

        <InformationRow icon={Briefcase} label="Cargo">
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cargos.length ? (
              cargos.map((cargo) => (
                <Badge key={cargo} variant="outline" className="rounded-full border-border/60 bg-background/70">
                  {cargo}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum cargo informado</span>
            )}
          </div>
        </InformationRow>

        <InformationRow icon={CalendarDays} label="Aniversário">
          <p className="mt-1 text-sm font-semibold text-foreground">{aniversario || "Não informado"}</p>
        </InformationRow>

        <InformationRow icon={MessageSquare} label="Observações" className="min-h-0 flex-1">
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">
            {observacoes?.trim() || "Sem observações"}
          </p>
        </InformationRow>
      </CardContent>
    </Card>
  );
}

function formatPhoneBR(telefone?: string | null) {
  if (!telefone) return "Não informado";
  let digits = telefone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return telefone;
}

function normalizePhoneOwner(status?: string | null) {
  if (!status) return null;
  const value = status.toLocaleLowerCase("pt-BR");
  if (value.includes("pr")) return "Próprio";
  if (value.includes("m")) return "Mãe";
  if (value.includes("p")) return "Pai";
  return status;
}

function InformationRow({
  icon: Icon,
  label,
  children,
  className = "",
}: {
  icon: typeof Phone;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`member-information-row rounded-2xl border border-border/55 bg-background/55 p-3 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
