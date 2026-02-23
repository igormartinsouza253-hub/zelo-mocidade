import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Membro {
  id: string;
  nome: string;
  data_nascimento: string | null;
  cargos: string[];
  faixa_etaria: string;
  foto_url: string | null;
  presencas?: number;
}

const MembrosGrupo = () => {
  const { faixa } = useParams<{ faixa: string }>();
  const navigate = useNavigate();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (faixa) {
      loadMembros();
    }
  }, [faixa]);

  const loadMembros = async () => {
    try {
      setLoading(true);
      const { data: membrosData, error } = await supabase
        .from("membros")
        .select("*")
        .eq("faixa_etaria", faixa)
        .order("nome");

      if (error) throw error;

      const membrosComPresencas = await Promise.all(
        (membrosData || []).map(async (membro) => {
          const { count } = await supabase
            .from("presencas")
            .select("*", { count: "exact", head: true })
            .eq("membro_id", membro.id);

          return {
            ...membro,
            presencas: count || 0,
          };
        })
      );

      setMembros(membrosComPresencas);
    } catch (error) {
      console.error("Erro ao carregar membros:", error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8 max-w-4xl w-full">
        <div className="flex items-center gap-2 md:gap-4 mb-4 md:mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="h-8 w-8 md:h-10 md:w-10"
          >
            <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
          <h1 className="text-xl md:text-3xl font-bold text-foreground capitalize">{faixa}</h1>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {membros.map((membro) => (
              <Card
                key={membro.id}
                className="shadow-[var(--shadow-soft)] border-border/50 hover:shadow-[var(--shadow-elevated)] transition-all cursor-pointer"
                onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
              >
                <CardContent className="flex items-center gap-2 md:gap-4 p-2 md:p-4">
                  <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                    <AvatarImage src={membro.foto_url || ""} alt={membro.nome} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm md:text-base">
                      {membro.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
                      {membro.nome}
                    </h3>
                    <div className="flex gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground flex-wrap">
                      {calcularIdade(membro.data_nascimento) && (
                        <>
                          <span>{calcularIdade(membro.data_nascimento)} anos</span>
                          <span>•</span>
                        </>
                      )}
                      <span className="truncate">{membro.cargos.join(", ")}</span>
                      {membro.presencas !== undefined && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-primary">
                            {membro.presencas} pres.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {membros.length === 0 && (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum membro encontrado nesta faixa etária
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MembrosGrupo;
