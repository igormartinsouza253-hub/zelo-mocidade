import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type PrayerPickerMember = {
  id: string;
  nome: string;
};

export function PrayerMemberPicker({
  members,
  presentMemberIds,
  prayingMemberIds,
  onChange,
  className,
}: {
  members: PrayerPickerMember[];
  presentMemberIds: string[];
  prayingMemberIds: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");

  const presentMembers = useMemo(() => {
    const present = new Set(presentMemberIds);
    return members.filter((m) => present.has(m.id));
  }, [members, presentMemberIds]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return presentMembers
      .filter((m) => m.nome.toLowerCase().includes(q))
      .slice(0, 6);
  }, [presentMembers, query]);

  const addMember = (id: string) => {
    if (!presentMemberIds.includes(id)) return;
    if (prayingMemberIds.includes(id)) return;
    onChange([...prayingMemberIds, id]);
    setQuery("");
  };

  const removeMember = (id: string) => {
    onChange(prayingMemberIds.filter((x) => x !== id));
  };

  const prayingById = useMemo(() => {
    const map = new Map<string, PrayerPickerMember>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="quem-orou">Quem orou</Label>
      <div className="space-y-2">
        <Input
          id="quem-orou"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={presentMemberIds.length ? "Digite para buscar entre os presentes" : "Marque presenças para escolher"}
          disabled={presentMemberIds.length === 0}
        />

        {suggestions.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
            <div className="space-y-1">
              {suggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2 text-sm hover:bg-accent/40 transition-colors"
                  onClick={() => addMember(m.id)}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {prayingMemberIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prayingMemberIds.map((id) => {
              const m = prayingById.get(id);
              return (
                <Badge key={id} variant="secondary" className="gap-1">
                  {m?.nome ?? "Membro"}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeMember(id)}
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: marque os membros presentes primeiro; depois selecione quem orou.
      </p>
    </div>
  );
}
