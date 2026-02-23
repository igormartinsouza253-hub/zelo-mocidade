import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Calendar, StickyNote, ArrowLeft } from "lucide-react";

interface MembroResult {
  id: string;
  nome: string;
  faixa_etaria: string;
  telefone: string | null;
}

interface ReuniaoResult {
  id: string;
  data: string;
  tema: string | null;
}

interface NotaResult {
  id: string;
  conteudo: string;
  created_at: string;
}

export default function Busca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [membros, setMembros] = useState<MembroResult[]>([]);
  const [reunioes, setReunioes] = useState<ReuniaoResult[]>([]);
  const [notas, setNotas] = useState<NotaResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  useEffect(() => {
    if (initialQuery) {
      void performSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = async (term: string) => {
    const value = term.trim();
    if (!value) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const pattern = `%${value}%`;

      const [membrosResp, reunioesResp, notasResp] = await Promise.all([
        supabase
          .from("membros")
          .select("id, nome, faixa_etaria, telefone")
          .or(
            `nome.ilike.${pattern},telefone.ilike.${pattern},faixa_etaria.ilike.${pattern}`,
          )
          .limit(30),
        supabase
          .from("reunioes")
          .select("id, data, tema")
          .or(`tema.ilike.${pattern}`)
          .order("data", { ascending: false })
          .limit(30),
        supabase
          .from("notas")
          .select("id, conteudo, created_at")
          .or(`conteudo.ilike.${pattern}`)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (membrosResp.error) throw membrosResp.error;
      if (reunioesResp.error) throw reunioesResp.error;
      if (notasResp.error) throw notasResp.error;

      setMembros((membrosResp.data as MembroResult[]) ?? []);
      setReunioes((reunioesResp.data as ReuniaoResult[]) ?? []);
      setNotas((notasResp.data as NotaResult[]) ?? []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      return params;
    });
    void performSearch(query);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getNotaPreview = (html: string) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const text = (temp.textContent || temp.innerText || "").trim();
    return text.length > 140 ? text.slice(0, 140) + "…" : text || "(Sem conteúdo)";
  };

  const totalResultados = membros.length + reunioes.length + notas.length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 md:gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground">
            <Search className="h-5 w-5" />
          </div>
          <div>
            {/* Título já é exibido na barra superior */}
            <p className="text-lg md:text-2xl font-semibold text-foreground">Busca global</p>
            <p className="text-xs md:text-sm text-muted-foreground">
              Encontre rapidamente membros, reuniões e notas pelo termo digitado.
            </p>
          </div>
        </div>
      </header>

      <Card className="border-border/70">
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite um nome, tema de reunião ou termo da nota..."
                className="pl-8"
              />
            </div>
            <Button type="submit" disabled={isLoading || !query.trim()} className="w-full md:w-auto">
              {isLoading ? "Buscando..." : "Buscar"}
            </Button>
          </form>
          {hasSearched && !isLoading && (
            <div className="mt-3 text-xs md:text-sm text-muted-foreground">
              {totalResultados === 0 ? (
                <span>Nenhum resultado encontrado para "{searchParams.get("q")}".</span>
              ) : (
                <span>
                  Encontrados {totalResultados} resultado{totalResultados > 1 && "s"} para "{searchParams.get("q")}".
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ScrollArea className="flex-1 rounded-md border border-border/60 bg-muted/30">
        <div className="p-4 space-y-6">
          <section aria-label="Resultados em membros" className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Membros</h2>
              {membros.length > 0 && (
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  {membros.length}
                </Badge>
              )}
            </div>
            {membros.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground">Nenhum membro encontrado.</p>
            ) : (
              <div className="space-y-2">
                {membros.map((membro) => (
                  <button
                    key={membro.id}
                    type="button"
                    onClick={() => navigate(`/membros/visualizar/${membro.id}`)}
                    className="w-full text-left rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{membro.nome}</p>
                      <p className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                        <span>{membro.faixa_etaria}</span>
                        {membro.telefone && <span>• {membro.telefone}</span>}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] md:text-xs">
                      Ver membro
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Resultados em reuniões" className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Reuniões</h2>
              {reunioes.length > 0 && (
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  {reunioes.length}
                </Badge>
              )}
            </div>
            {reunioes.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground">Nenhuma reunião encontrada.</p>
            ) : (
              <div className="space-y-2">
                {reunioes.map((reuniao) => (
                  <button
                    key={reuniao.id}
                    type="button"
                    onClick={() => navigate(`/reunioes/visualizar/${reuniao.id}`)}
                    className="w-full text-left rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {reuniao.tema || "Reunião sem tema"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(reuniao.data)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] md:text-xs">
                      Ver reunião
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Resultados em notas" className="space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Notas</h2>
              {notas.length > 0 && (
                <Badge variant="outline" className="text-[10px] md:text-xs">
                  {notas.length}
                </Badge>
              )}
            </div>
            {notas.length === 0 ? (
              <p className="text-xs md:text-sm text-muted-foreground">Nenhuma nota encontrada.</p>
            ) : (
              <div className="space-y-2">
                {notas.map((nota) => (
                  <button
                    key={nota.id}
                    type="button"
                    onClick={() => navigate(`/notas/editar/${nota.id}`)}
                    className="w-full text-left rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-muted/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {getNotaPreview(nota.conteudo)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(nota.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] md:text-xs">
                      Abrir nota
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
