import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, RefreshCw, Search, ShieldAlert, Trash2, UserX, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type SuperAdminGroup = {
  id: string;
  group_id: string;
  group_name: string;
  role: "admin" | "member";
  created_at: string | null;
};

type SuperAdminUser = {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  created_at: string | null;
  last_seen_at: string | null;
  online: boolean;
  groups: SuperAdminGroup[];
};

function displayName(user: SuperAdminUser) {
  if (user.username) return user.username;
  const local = user.email?.split("@")[0] ?? "Usuário";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Sem registro";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SuperAdminUsuariosProps = {
  embedded?: boolean;
};

export default function SuperAdminUsuarios({ embedded = false }: SuperAdminUsuariosProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ user: SuperAdminUser; group: SuperAdminGroup } | null>(null);
  const isAllowed = user?.app_metadata?.super_admin === true;

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) => {
      const name = displayName(item).toLowerCase();
      const email = (item.email ?? "").toLowerCase();
      const groups = item.groups.map((group) => group.group_name.toLowerCase()).join(" ");
      return name.includes(query) || email.includes(query) || groups.includes(query);
    });
  }, [search, users]);

  const loadUsers = async () => {
    if (!isAllowed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-access", {
        body: { action: "super_admin_list" },
      });
      if (error) throw error;
      const response = data as { error?: string; users?: SuperAdminUser[] } | null;
      if (response?.error) throw new Error(response.error);
      setUsers(response?.users ?? []);
    } catch (error) {
      console.error("[SuperAdminUsuarios] load", error);
      toast.error("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!isAllowed && !embedded) {
      toast.error("Acesso restrito ao super administrador.");
      navigate("/configuracoes", { replace: true });
      return;
    }
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAllowed, embedded, navigate]);

  const removeFromGroup = async () => {
    if (!removeTarget) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-access", {
        body: {
          action: "super_admin_remove_from_group",
          user_id: removeTarget.user.id,
          group_id: removeTarget.group.group_id,
        },
      });
      if (error) throw error;
      const response = data as { error?: string } | null;
      if (response?.error) throw new Error(response.error);
      toast.success("Usuário removido do grupo.");
      setRemoveTarget(null);
      void loadUsers();
    } catch (error) {
      console.error("[SuperAdminUsuarios] remove group", error);
      toast.error("Não foi possível remover do grupo.");
    }
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-access", {
        body: { action: "super_admin_delete_user", user_id: deleteTarget.id },
      });
      if (error) throw error;
      const response = data as { error?: string } | null;
      if (response?.error) throw new Error(response.error);
      toast.success("Usuário excluído do app.");
      setDeleteTarget(null);
      void loadUsers();
    } catch (error) {
      console.error("[SuperAdminUsuarios] delete user", error);
      toast.error("Não foi possível excluir o usuário.");
    }
  };

  if (!isAllowed) return null;

  return (
    <div className={embedded ? "w-full" : "settings-mobile min-h-screen bg-background px-3 pb-28 pt-3"}>
      <div className={embedded ? "w-full space-y-3" : "mx-auto max-w-md space-y-3"}>
        <Card className="rounded-2xl border-primary/35 bg-primary/5 shadow-none">
          <CardHeader className="px-4 pb-3 pt-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Crown className="h-4 w-4 text-primary" />
              Super administração
            </CardTitle>
            <CardDescription className="text-xs">
              Acesso exclusivo para contas autorizadas pelo administrador da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-3 px-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar usuário ou grupo"
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={loadUsers} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/50 bg-background/60 p-2">
                <p className="text-lg font-bold">{users.length}</p>
                <p className="text-[10px] text-muted-foreground">Usuários</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-2">
                <p className="text-lg font-bold">{users.filter((item) => item.online).length}</p>
                <p className="text-[10px] text-muted-foreground">Online</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/60 p-2">
                <p className="text-lg font-bold">{users.reduce((sum, item) => sum + item.groups.length, 0)}</p>
                <p className="text-[10px] text-muted-foreground">Vínculos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={embedded ? "grid gap-3 xl:grid-cols-2" : "space-y-2"}>
          {loading ? (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">Carregando usuários...</CardContent>
            </Card>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</CardContent>
            </Card>
          ) : (
            filteredUsers.map((item) => {
              const name = displayName(item);
              const isSelf = item.id === user?.id;
              return (
                <Card key={item.id} className="rounded-2xl border-border/60 shadow-none">
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 rounded-2xl">
                        {item.avatar_url ? (
                          <AvatarImage src={item.avatar_url} alt={name} className="rounded-2xl object-cover" />
                        ) : (
                          <AvatarFallback className="rounded-2xl">{name.charAt(0).toUpperCase()}</AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{name}</p>
                          {item.role === "admin" && <Badge className="h-5 text-[10px]">Admin</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{item.email ?? "Sem e-mail"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.online ? "Online agora" : `Visto por último: ${formatDate(item.last_seen_at)}`}
                        </p>
                      </div>
                      <span className={item.online ? "h-3 w-3 rounded-full bg-emerald-500" : "h-3 w-3 rounded-full bg-muted-foreground/30"} />
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/10 p-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Users className="h-3.5 w-3.5" />
                        Grupos
                      </div>
                      {item.groups.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Não participa de nenhum grupo.</p>
                      ) : (
                        item.groups.map((group) => (
                          <div key={group.group_id} className="flex items-center justify-between gap-2 rounded-xl bg-background/70 p-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{group.group_name}</p>
                              <p className="text-[10px] text-muted-foreground">{group.role === "admin" ? "Administrador" : "Membro"}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              disabled={isSelf}
                              onClick={() => setRemoveTarget({ user: item, group })}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full gap-2"
                      disabled={isSelf}
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir usuário do app
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget ? `${displayName(removeTarget.user)} será removido de ${removeTarget.group.group_name}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeFromGroup}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Excluir usuário do app?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o acesso, vínculos de grupo e a conta de autenticação de {deleteTarget ? displayName(deleteTarget) : "usuário"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteUser}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
