import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useGroupMembers } from "@/hooks/groups/useGroupMembers";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { Shield, Users } from "lucide-react";
import { toast } from "sonner";

type PendingJoinRequest = {
  id: string;
  userId: string;
  username: string;
  createdAt: string;
};

export function GroupSettingsSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGroupId, activeGroup, isAdmin, refresh } = useActiveGroup();
  const { loading, members, count, refresh: refreshMembers } = useGroupMembers(activeGroupId);

  const [groupName, setGroupName] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; username: string } | null>(null);

  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [joinRequests, setJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [joinActionId, setJoinActionId] = useState<string | null>(null);

  useEffect(() => {
    setGroupName(activeGroup?.name ?? "");
  }, [activeGroup?.name]);

  const loadJoinRequests = async () => {
    if (!activeGroupId || !isAdmin) {
      setJoinRequests([]);
      return;
    }

    setLoadingJoinRequests(true);
    try {
      const { data, error } = await supabase
        .from("group_join_requests")
        .select("id, user_id, created_at")
        .eq("group_id", activeGroupId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = (data as any[] | null) ?? [];
      const userIds = rows.map((row) => row.user_id as string).filter(Boolean);
      if (userIds.length === 0) {
        setJoinRequests([]);
        return;
      }

      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      if (profileError) throw profileError;

      const usernameById = new Map<string, string>();
      (profileRows as any[] | null)?.forEach((profile) => {
        if (profile?.id) {
          usernameById.set(profile.id as string, (profile.username as string) ?? "Usuário");
        }
      });

      const pending = rows.map((row) => ({
        id: row.id as string,
        userId: row.user_id as string,
        username: usernameById.get(row.user_id as string) ?? "Usuário",
        createdAt: row.created_at as string,
      }));

      setJoinRequests(pending);
    } catch (error) {
      console.error("[GroupSettingsSection] load join requests", error);
      toast.error("Não foi possível carregar as solicitações de entrada.");
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  useEffect(() => {
    void loadJoinRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId, isAdmin]);

  const title = useMemo(() => {
    if (activeGroup?.name) return `Grupo: ${activeGroup.name}`;
    return "Grupo";
  }, [activeGroup?.name]);

  const handleUpdateGroupInfo = async () => {
    if (!activeGroupId) return;

    const trimmedName = groupName.trim();
    if (!trimmedName) {
      toast.error("Informe um nome de grupo válido.");
      return;
    }

    setSavingInfo(true);
    try {
      const { error } = await supabase.rpc("update_management_group_info", {
        _group_id: activeGroupId,
        _name: trimmedName,
        _description: activeGroup?.description ?? "",
      });
      if (error) throw error;

      await refresh();
      toast.success("Nome do grupo atualizado.");
    } catch (error) {
      console.error("[GroupSettingsSection] update group info", error);
      toast.error("Não foi possível atualizar o nome do grupo.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleUpdateGroupPassword = async () => {
    if (!activeGroupId) return;

    if (newPassword.length < 4) {
      toast.error("A senha do grupo precisa ter pelo menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.rpc("update_management_group_password", {
        _group_id: activeGroupId,
        _new_password: newPassword,
      });
      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha do grupo atualizada.");
    } catch (error) {
      console.error("[GroupSettingsSection] update group password", error);
      toast.error("Não foi possível atualizar a senha do grupo.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleChangeMemberRole = async (memberUserId: string, role: "admin" | "member") => {
    if (!activeGroupId) return;

    setSavingMemberId(memberUserId);
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ role })
        .eq("group_id", activeGroupId)
        .eq("user_id", memberUserId);
      if (error) throw error;

      await refreshMembers();
      toast.success("Permissão do membro atualizada.");
    } catch (error) {
      console.error("[GroupSettingsSection] change member role", error);
      toast.error("Não foi possível atualizar a permissão do membro.");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!activeGroupId || !memberToRemove) return;

    setSavingMemberId(memberToRemove.userId);
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", activeGroupId)
        .eq("user_id", memberToRemove.userId);
      if (error) throw error;

      if (memberToRemove.userId === user?.id) {
        navigate("/grupo?change=1");
      }

      await refreshMembers();
      await refresh();
      toast.success("Membro removido do grupo.");
    } catch (error) {
      console.error("[GroupSettingsSection] remove member", error);
      toast.error("Não foi possível remover este membro.");
    } finally {
      setSavingMemberId(null);
      setMemberToRemove(null);
    }
  };

  const decideJoinRequest = async (requestId: string, requestUserId: string, action: "approve" | "reject") => {
    if (!activeGroupId || !isAdmin) return;

    setJoinActionId(requestId);
    try {
      const { error } = await supabase.rpc("decide_group_join_request" as any, {
        _request_id: requestId,
        _action: action,
      });

      if (error) throw error;

      toast.success(action === "approve" ? "Solicitação aprovada." : "Solicitação rejeitada.");
      await Promise.all([loadJoinRequests(), refreshMembers()]);
    } catch (error) {
      console.error("[GroupSettingsSection] decide join request", error);
      toast.error("Não foi possível concluir a ação da solicitação.");
    } finally {
      setJoinActionId(null);
    }
  };

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
    <>
      <Card>
        <CardHeader className="pb-3 md:pb-6 pt-3 md:pt-6 px-3 md:px-6">
          <CardTitle className="text-sm md:text-lg flex items-center gap-2">
            <Users className="h-4 w-4 md:h-5 md:w-5" />
            {title}
            <Badge variant="secondary" className="ml-auto">{count}</Badge>
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Gerencie nome, senha e membros do grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-3 md:pb-6 px-3 md:px-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/grupo?change=1")}
              className="h-8 md:h-10 text-xs md:text-sm"
            >
              Trocar grupo
            </Button>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Nome do grupo</Label>
              <Input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Nome do grupo"
                className="h-8 md:h-10 text-xs md:text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={handleUpdateGroupInfo}
              disabled={savingInfo}
              className="h-8 md:h-10 text-xs md:text-sm"
            >
              {savingInfo ? "Salvando..." : "Salvar nome do grupo"}
            </Button>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <p className="text-sm font-medium">Senha do grupo</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="h-8 md:h-10 text-xs md:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs md:text-sm">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a senha"
                className="h-8 md:h-10 text-xs md:text-sm"
              />
            </div>
            <Button
              type="button"
              onClick={handleUpdateGroupPassword}
              disabled={savingPassword}
              className="h-8 md:h-10 text-xs md:text-sm"
            >
              {savingPassword ? "Salvando..." : "Atualizar senha"}
            </Button>
          </div>

          <div className="rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium">Membros do grupo</p>
            {loading ? (
              <p className="text-xs text-muted-foreground">Carregando membros...</p>
            ) : members.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum membro encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => {
                  const isCurrentUser = member.userId === user?.id;
                  const isSaving = savingMemberId === member.userId;

                  return (
                    <li key={member.userId} className="rounded-md border border-border p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground truncate">{member.username}</span>
                        <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                          {member.role === "admin" ? "Admin" : "Membro"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {member.role === "admin" ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isCurrentUser || isSaving}
                            onClick={() => handleChangeMemberRole(member.userId, "member")}
                          >
                            Tornar membro
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isSaving}
                            onClick={() => handleChangeMemberRole(member.userId, "admin")}
                          >
                            Tornar admin
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={isSaving}
                          onClick={() => setMemberToRemove({ userId: member.userId, username: member.username })}
                        >
                          Expulsar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isAdmin && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">Solicitações para entrar no grupo</p>

              {loadingJoinRequests ? (
                <p className="text-xs text-muted-foreground">Carregando solicitações...</p>
              ) : joinRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma solicitação pendente.</p>
              ) : (
                <ul className="space-y-2">
                  {joinRequests.map((request) => {
                    const isProcessing = joinActionId === request.id;

                    return (
                      <li key={request.id} className="rounded-md border border-border p-2 space-y-2">
                        <div className="space-y-0.5">
                          <p className="text-sm text-foreground truncate">{request.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Solicitação em {new Date(request.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="h-7 text-xs"
                            disabled={isProcessing}
                            onClick={() => decideJoinRequest(request.id, request.userId, "approve")}
                          >
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isProcessing}
                            onClick={() => decideJoinRequest(request.id, request.userId, "reject")}
                          >
                            Rejeitar
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {memberToRemove?.username ?? "este membro"} do grupo?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
