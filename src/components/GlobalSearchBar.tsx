import { Calendar, Search, Settings, StickyNote, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const RECENT_SEARCHES_KEY = "globalSearchRecent";
const MAX_RECENT_SEARCHES = 10;

type SuggestionType = "recent" | "membro" | "reuniao" | "nota" | "config";

interface SearchSuggestion {
  id: string;
  label: string;
  subtitle?: string;
  type: SuggestionType;
  action: "search" | "navigate";
  href?: string;
  query?: string;
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  const value = query.trim();
  if (!value) return;

  const current = getRecentSearches();
  const without = current.filter((q) => q.toLowerCase() !== value.toLowerCase());
  const next = [value, ...without].slice(0, MAX_RECENT_SEARCHES);

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function buildRecentSuggestions(filter?: string): SearchSuggestion[] {
  const recents = getRecentSearches();
  const source = filter
    ? recents.filter((item) => item.toLowerCase().includes(filter.toLowerCase()))
    : recents;

  return source.map((value, index) => ({
    id: `recent-${index}-${value}`,
    label: value,
    type: "recent",
    action: "search",
    query: value,
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const navigate = useNavigate();

  useEffect(() => {
    const initial = buildRecentSuggestions();
    setSuggestions(initial);
  }, []);

  const loadSuggestions = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      const recents = buildRecentSuggestions();
      setSuggestions(recents);
      setIsOpen(recents.length > 0);
      setHighlightedIndex(-1);
      return;
    }

    const pattern = `%${trimmed}%`;

    try {
      const [membrosResp, reunioesResp, notasResp] = await Promise.all([
        supabase
          .from("membros")
          .select("id, nome")
          .ilike("nome", pattern)
          .limit(5),
        supabase
          .from("reunioes")
          .select("id, data, tema")
          .or(`tema.ilike.${pattern}`)
          .order("data", { ascending: false })
          .limit(5),
        supabase
          .from("notas")
          .select("id, conteudo, created_at")
          .ilike("conteudo", pattern)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const dbSuggestions: SearchSuggestion[] = [];

      if (!membrosResp.error && membrosResp.data) {
        membrosResp.data.forEach((m: { id: string; nome: string }) => {
          dbSuggestions.push({
            id: `membro-${m.id}`,
            label: m.nome,
            subtitle: "Membro",
            type: "membro",
            action: "navigate",
            href: `/membros/visualizar/${m.id}`,
          });
        });
      }

      if (!reunioesResp.error && reunioesResp.data) {
        reunioesResp.data.forEach((r: { id: string; data: string; tema: string | null }) => {
          const date = new Date(r.data).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          dbSuggestions.push({
            id: `reuniao-${r.id}`,
            label: r.tema || "Reunião",
            subtitle: date,
            type: "reuniao",
            action: "navigate",
            href: `/reunioes/visualizar/${r.id}`,
          });
        });
      }

      if (!notasResp.error && notasResp.data) {
        notasResp.data.forEach((n: { id: string; conteudo: string }) => {
          const cleaned = stripHtml(n.conteudo);
          if (!cleaned) return;
          const preview = cleaned.length > 80 ? `${cleaned.slice(0, 80)}…` : cleaned;
          dbSuggestions.push({
            id: `nota-${n.id}`,
            label: preview,
            subtitle: "Nota",
            type: "nota",
            action: "navigate",
            href: `/notas/editar/${n.id}`,
          });
        });
      }

      const lower = trimmed.toLowerCase();
      const staticSuggestions: SearchSuggestion[] = [];

      if (lower.includes("config")) {
        staticSuggestions.push({
          id: "configuracoes",
          label: "Abrir configurações do app",
          subtitle: "Configurações",
          type: "config",
          action: "navigate",
          href: "/configuracoes",
        });
      }

      if (lower.includes("aniver")) {
        staticSuggestions.push({
          id: "aniversariantes",
          label: "Ver Agenda (aniversários)",
          subtitle: "Agenda",
          type: "config",
          action: "navigate",
          href: "/calendario",
        });
      }

      const recentSuggestions = buildRecentSuggestions(trimmed);
      const combined = [...dbSuggestions, ...staticSuggestions, ...recentSuggestions];

      setSuggestions(combined);
      setIsOpen(combined.length > 0);
      setHighlightedIndex(combined.length > 0 ? 0 : -1);
    } catch (error) {
      console.error("Erro ao carregar sugestões de busca:", error);
      const recents = buildRecentSuggestions(trimmed);
      setSuggestions(recents);
      setIsOpen(recents.length > 0);
      setHighlightedIndex(recents.length > 0 ? 0 : -1);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      const recents = buildRecentSuggestions();
      setSuggestions(recents);
      setIsOpen(recents.length > 0);
      setHighlightedIndex(-1);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadSuggestions(trimmed);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const performSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    navigate(`/busca?q=${encodeURIComponent(trimmed)}`);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.action === "search" && suggestion.query) {
      performSearch(suggestion.query);
      return;
    }

    if (suggestion.action === "navigate" && suggestion.href) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      navigate(suggestion.href);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpen && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
      handleSuggestionSelect(suggestions[highlightedIndex]);
      return;
    }
    performSearch(query);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= suggestions.length ? 0 : next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? suggestions.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleBlur = () => {
    // delay to allow click on suggestion
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 100);
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    handleSuggestionSelect(suggestion);
  };

  const getSuggestionIcon = (type: SuggestionType) => {
    switch (type) {
      case "membro":
        return <Users className="mr-1.5 h-3 w-3 text-muted-foreground" />;
      case "reuniao":
        return <Calendar className="mr-1.5 h-3 w-3 text-muted-foreground" />;
      case "nota":
        return <StickyNote className="mr-1.5 h-3 w-3 text-muted-foreground" />;
      case "config":
        return <Settings className="mr-1.5 h-3 w-3 text-muted-foreground" />;
      case "recent":
      default:
        return <Search className="mr-1.5 h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      role="search"
      aria-label="Busca global"
    >
      {/* Cápsula externa maior */}
      <div className="relative flex w-full items-center rounded-lg border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-[var(--shadow-card)]">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-2.5 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Buscar em membros, reuniões e notas..."
              className="h-8 md:h-9 border-0 bg-transparent px-0 text-xs md:text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls="global-search-suggestions"
            />
            {isOpen && suggestions.length > 0 && (
              <div
                id="global-search-suggestions"
                className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg z-50 overflow-hidden"
                role="listbox"
              >
                {suggestions.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`flex w-full items-center px-2.5 py-1.5 text-xs md:text-sm text-left hover:bg-accent hover:text-accent-foreground focus-visible:outline-none ${
                      index === highlightedIndex ? "bg-accent text-accent-foreground" : ""
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSuggestionClick(item)}
                    role="option"
                    aria-selected={index === highlightedIndex}
                  >
                    {getSuggestionIcon(item.type)}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.subtitle && (
                        <span className="truncate text-[10px] text-muted-foreground">{item.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </form>
  );
}
