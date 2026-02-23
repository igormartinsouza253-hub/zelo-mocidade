import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Shield, Users, Trash2, Crown, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

type GroupMember = {
  id: string;
  user_id: string;
  role: "admin" | "member";
  created_at: string;
  profiles?: {
    username: string;
    email: string | null;
  };
};

type PresenceRow = {
  user_id: string;
  last_seen_at: string;
};

export default function ConfiguracoesGrupoAdmin() {
  const navigate = useNavigate();
  const { activeGroupId, activeGroup, isAdmin, refresh } = useActiveGroup();
  const { setConfig } = usePageHeader();

  const [tab, setTab] = useState<"info" | "senha" | "membros" | "ownership">("info");

  // Info do grupo
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [updatingInfo, setUpdatingInfo] = useState(false);

  // Foto do grupo
  const [groupPhotoPath, setGroupPhotoPath] = useState<string | null>(null);
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoImageSrc, setPhotoImageSrc] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  // Senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Membros
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  // Presença (heartbeat)
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceRow>>({});

  // Ownership transfer
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [confirmTransferOpen, setConfirmTransferOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setConfig({
      title: "Administração do Grupo",
      icon: Shield,
      breadcrumbs: [
        { label: "Início", href: "/" },
        { label: "Configurações", href: "/configuracoes" },
        { label: "Admin do Grupo" },
      ],
      showBackButton: true,
      backTo: "/configuracoes",
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    supabase.auth.getUser().then((u) => setCurrentUserId(u.data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!activeGroupId || !isAdmin) {
      navigate("/configuracoes");
      return;
    }
    loadGroupData();
    loadMembers();
    loadGroupOwner();
    void loadPresence();
  }, [activeGroupId, isAdmin]);

  useEffect(() => {
    if (!activeGroupId || !isAdmin) return;
    const id = window.setInterval(() => void loadPresence(), 30000);
    return () => window.clearInterval(id);
  }, [activeGroupId, isAdmin]);

  const loadGroupData = async () => {
    if (!activeGroupId) return;
    try {
      const { data, error } = await supabase
        .from("management_groups")
        .select("name, description, photo_url")
        .eq("id", activeGroupId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setGroupName(data.name || "");
        setGroupDesc(data.description || "");
        setGroupPhotoPath((data as any).photo_url ?? null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados do grupo");
    }
  };

  const refreshGroupPhotoUrl = async (path: string | null) => {
    if (!path) {
      setGroupPhotoUrl(null);
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("group-photos")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      setGroupPhotoUrl(data.signedUrl);
    } catch (e) {
      console.error(e);
      setGroupPhotoUrl(null);
    }
  };

  useEffect(() => {
    void refreshGroupPhotoUrl(groupPhotoPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupPhotoPath]);

  const handleGroupPhotoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setPhotoImageSrc(result);
        setPhotoDialogOpen(true);
      }
    };
    reader.readAsDataURL(file);
    // permite re-selecionar o mesmo arquivo
    event.target.value = "";
  };

  const handleGroupPhotoCropped = async (blob: Blob) => {
    if (!activeGroupId) return;
    setPhotoSaving(true);
    try {
      const filePath = `${activeGroupId}/group-photo.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("group-photos")
        .upload(filePath, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("management_groups")
        .update({ photo_url: filePath } as any)
        .eq("id", activeGroupId);
      if (updateError) throw updateError;

      setGroupPhotoPath(filePath);
      toast.success("Foto do grupo atualizada");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar foto do grupo");
    } finally {
      setPhotoSaving(false);
      setPhotoDialogOpen(false);
      setPhotoImageSrc(null);
    }
  };

  const loadPresence = async () => {
    if (!activeGroupId) return;
    try {
      const { data, error } = await supabase
        .from("group_user_presence")
        .select("user_id, last_seen_at")
        .eq("group_id", activeGroupId);
      if (error) throw error;

      const next: Record<string, PresenceRow> = {};
      (data as any[] | null)?.forEach((row) => {
        if (row?.user_id) next[row.user_id] = row as PresenceRow;
      });
      setPresenceByUserId(next);
    } catch (e) {
      console.error(e);
    }
  };

  const loadGroupOwner = async () => {
    if (!activeGroupId) return;
    try {
      const { data, error } = await supabase
        .from("management_groups")
        .select("created_by")
        .eq("id", activeGroupId)
        .maybeSingle();
      if (error) throw error;
      setCreatedBy((data?.created_by as string) ?? null);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMembers = async () => {
    if (!activeGroupId) return;
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from("group_members")
        .select("id, user_id, role, created_at, profiles!inner(username, email)")
        .eq("group_id", activeGroupId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMembers((data as any) ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdateInfo = async () => {
    if (!activeGroupId) return;
    if (!groupName.trim()) {
      toast.error("Nome do grupo é obrigatório");
      return;
    }
    setUpdatingInfo(true);
    try {
      const { error } = await supabase.rpc("update_management_group_info", {
        _group_id: activeGroupId,
        _name: groupName.trim(),
        _description: groupDesc.trim(),
      });
      if (error) {
        if (error.message?.includes("not_admin")) {
          toast.error("Você não tem permissão para alterar o grupo");
        } else if (error.message?.includes("invalid_name")) {
          toast.error("Nome inválido");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Informações do grupo atualizadas com sucesso");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar grupo");
    } finally {
      setUpdatingInfo(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!activeGroupId) return;
    if (newPassword.length < 4) {
      toast.error("A senha deve ter pelo menos 4 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.rpc("update_management_group_password", {
        _group_id: activeGroupId,
        _new_password: newPassword,
      });
      if (error) {
        if (error.message?.includes("not_admin")) {
          toast.error("Você não tem permissão para alterar a senha");
        } else if (error.message?.includes("invalid_password")) {
          toast.error("Senha inválida (mín. 4 caracteres)");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Senha do grupo atualizada com sucesso");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar senha");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !activeGroupId) return;
    setRemovingMember(true);
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberToRemove.id);
      if (error) throw error;
      toast.success("Membro removido do grupo");
      await loadMembers();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover membro");
    } finally {
      setRemovingMember(false);
      setMemberToRemove(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    if (!activeGroupId) return;
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      toast.success(`Papel alterado para ${newRole === "admin" ? "Admin" : "Membro"}`);
      await loadMembers();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao alterar papel");
    }
  };

  const handleTransferOwnership = async () => {
    if (!activeGroupId || !newOwnerId) return;
    setTransferring(true);
    try {
      const { error } = await supabase.rpc("transfer_group_ownership", {
        _group_id: activeGroupId,
        _new_owner_id: newOwnerId,
      });
      if (error) {
        if (error.message?.includes("not_creator")) {
          toast.error("Apenas o criador do grupo pode transferir ownership");
        } else if (error.message?.includes("new_owner_not_member")) {
          toast.error("O novo dono deve ser membro do grupo");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Ownership transferido com sucesso");
      await loadGroupOwner();
      await loadMembers();
      setNewOwnerId("");
      setConfirmTransferOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao transferir ownership");
    } finally {
      setTransferring(false);
    }
  };

  if (!activeGroupId || !isAdmin) {
    return null;
  }

  const isCreator = createdBy === currentUserId;

  return (
    <div className="h-full w-full bg-background">
      <div className="mx-auto w-full max-w-4xl px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administração: {activeGroup?.name}
            </CardTitle>
            <CardDescription>Gerencie as configurações do grupo gestor</CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="senha">Senha</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
            <TabsTrigger value="ownership">Ownership</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Grupo</CardTitle>
                <CardDescription>Altere o nome e a descrição do grupo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-12 w-12 border border-border">
                      <AvatarImage src={groupPhotoUrl || undefined} />
                      <AvatarFallback className="bg-accent text-foreground font-semibold">
                        {(activeGroup?.name || "G").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">Foto do grupo</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Visível para membros do grupo
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleGroupPhotoFileChange}
                        disabled={photoSaving}
                      />
                      <Button variant="outline" size="sm" disabled={photoSaving} className="gap-2" asChild>
                        <span>
                          <Camera className="h-4 w-4" />
                          {photoSaving ? "Salvando..." : "Alterar"}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nome do grupo</Label>
                  <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
                </div>
                <Button disabled={updatingInfo} onClick={handleUpdateInfo}>
                  {updatingInfo ? "Salvando..." : "Salvar alterações"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="senha">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha do Grupo</CardTitle>
                <CardDescription>Defina uma nova senha para o grupo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button disabled={updatingPassword} onClick={handleUpdatePassword}>
                  {updatingPassword ? "Atualizando..." : "Atualizar senha"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="membros">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Membros do Grupo ({members.length})
                </CardTitle>
                <CardDescription>Veja e gerencie os membros do grupo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingMembers ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum membro</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{m.profiles?.username || "Usuário"}</p>
                          {m.role === "admin" && <Badge variant="default">Admin</Badge>}
                          {m.user_id === createdBy && <Crown className="h-4 w-4 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{m.profiles?.email || "—"}</p>

                        {(() => {
                          const presence = presenceByUserId[m.user_id];
                          if (!presence?.last_seen_at) {
                            return (
                              <p className="mt-1 text-xs text-muted-foreground">Sem atividade registrada</p>
                            );
                          }

                          const last = new Date(presence.last_seen_at);
                          const diffMs = Date.now() - last.getTime();
                          const isOnlineNow = diffMs <= 2 * 60 * 1000;

                          return (
                            <p className="mt-1 text-xs">
                              <span
                                className={
                                  isOnlineNow
                                    ? "font-medium text-primary"
                                    : "text-muted-foreground"
                                }
                              >
                                {isOnlineNow ? "Online agora" : "Offline"}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}• Última atividade {formatDistanceToNowStrict(last, { addSuffix: true, locale: ptBR })}
                              </span>
                            </p>
                          );
                        })()}
                      </div>
                      <div className="flex gap-2">
                        {m.role === "member" ? (
                          <Button size="sm" variant="outline" onClick={() => handleChangeRole(m.id, "admin")}>
                            Tornar Admin
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleChangeRole(m.id, "member")}>
                            Tornar Membro
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => setMemberToRemove(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ownership">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Transferir Ownership
                </CardTitle>
                <CardDescription>
                  Transfira a propriedade do grupo para outro membro. Apenas o criador pode fazer isso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Novo dono (selecione um membro)</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newOwnerId}
                    onChange={(e) => setNewOwnerId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {members
                      .filter((m) => m.user_id !== createdBy)
                      .map((m) => (
                        <option key={m.id} value={m.user_id}>
                          {m.profiles?.username || "Usuário"} ({m.profiles?.email || "—"})
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  disabled={!newOwnerId || transferring}
                  variant="destructive"
                  onClick={() => setConfirmTransferOpen(true)}
                >
                  Transferir ownership
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{memberToRemove?.profiles?.username}</strong> do grupo? Essa ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={removingMember}>
              {removingMember ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmTransferOpen} onOpenChange={setConfirmTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir ownership do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a transferir a propriedade do grupo. Você deixará de ser o criador e o novo dono terá
              controle total sobre o grupo. Essa ação não pode ser desfeita. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransferOwnership} disabled={transferring}>
              {transferring ? "Transferindo..." : "Sim, transferir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoImageSrc && (
        <ImageCropDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          imageSrc={photoImageSrc}
          onCropComplete={handleGroupPhotoCropped}
        />
      )}
    </div>
  );
}