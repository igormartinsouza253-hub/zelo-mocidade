import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useGroupMembers } from "@/hooks/groups/useGroupMembers";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Users } from "lucide-react";

export function GroupSettingsSection() {
  const navigate = useNavigate();
  const { activeGroupId, activeGroup } = useActiveGroup();
  const { loading, members, count } = useGroupMembers(activeGroupId);

  const title = useMemo(() => {
    if (activeGroup?.name) return `Grupo: ${activeGroup.name}`;
    return "Grupo";
  }, [activeGroup?.name]);

  if (!activeGroupId) {
    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
          <CardTitle className="text-sm md:text-lg flex items-center gap-2">
            <Users className="h-4 w-4 md:h-5 md:w-5" />
            Grupo
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Você ainda não está em um grupo. Para usar o app, escolha um grupo gestor.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-3 md:pb-6 px-3 md:px-6">
          <Button type="button" onClick={() => navigate("/grupo")}>Escolher grupo</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
        <CardTitle className="text-sm md:text-lg flex items-center gap-2">
          <Users className="h-4 w-4 md:h-5 md:w-5" />
          {title}
          <Badge variant="secondary" className="ml-auto">{count}</Badge>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Usuários no grupo (usernames) e acesso para trocar de grupo.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-3 md:pb-6 px-3 md:px-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/grupo?change=1")}
            className="h-8 md:h-10 text-xs md:text-sm"
          >
            Trocar grupo
          </Button>
        </div>

        <div className="rounded-md border border-border p-3">
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando membros...</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum membro encontrado.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground truncate">{m.username}</span>
                  {m.role === "admin" && <Badge variant="outline">Admin</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
