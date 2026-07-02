import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightLeft, Camera, CheckCircle2, Copy, Crown, Link2, Loader2, LogIn, Pencil, Shield, Trash2, UserPlus, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ImageCropDialog } from "@/components/ImageCropDialog";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";

type GroupDetails = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  created_by: string | null;
};

type GroupMember = {
  id: string;
  user_id: string;
  role: "admin" | "member";
  created_at: string;
  username: string;
  email: string | null;
};

type PresenceRow = {
  user_id: string;
  last_seen_at: string;
};

type JoinRequestRow = {
  id: string;
  user_id: string;
  group_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  username: string;
  email: string | null;
};

function createInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function memberActivityLabel(presence?: PresenceRow) {
  if (!presence?.last_seen_at) {
    return { online: false, label: "Sem atividade registrada" };
  }

  const last = new Date(presence.last_seen_at);
  const online = Date.now() - last.getTime() <= 2 * 60 * 1000;

  return {
    online,
    label: online
      ? `Online agora • última atividade ${formatDistanceToNowStrict(last, { addSuffix: true, locale: ptBR })}`
      : `Offline • última atividade ${formatDistanceToNowStrict(last, { addSuffix: true, locale: ptBR })}`,
  };
}

export default function GrupoInfo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGroupId, groups, isAdmin, loading: loadingActiveGroup, refresh, setActiveGroupById } = useActiveGroup();
  const { setConfig } = usePageHeader();

  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceRow>>({});
  const [pendingRequests, setPendingRequests] = useState<JoinRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoImageSrc, setPhotoImageSrc] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);

  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [switchingGroupId, setSwitchingGroupId] = useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [memberToPromote, setMemberToPromote] = useState<GroupMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);

  useEffect(() => {
    setConfig({
      title: "Grupo",
      icon: Users,
      showBackButton: true,
      backTo: "/",
    });
    return () => setConfig(null);
  }, [setConfig]);

  useEffect(() => {
    if (loadingActiveGroup) return;
    if (!activeGroupId) {
      navigate("/grupo", { replace: true });
      return;
    }

    void loadAll();
  }, [activeGroupId, loadingActiveGroup, navigate]);

  useEffect(() => {
    if (!activeGroupId) return;
    const id = window.setInterval(() => void loadPresence(), 30000);
    return () => window.clearInterval(id);
  }, [activeGroupId]);

  useEffect(() => {
    if (!activeGroupId || !isAdmin) return;

    const channel = supabase
      .channel(`group-join-requests:${activeGroupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_join_requests", filter: `group_id=eq.${activeGroupId}` },
        (payload) => {
          const row = payload.new as { status?: string } | null;
          if (payload.eventType === "INSERT" && row?.status === "pending") {
            toast("Nova solicitacao de acesso", { description: "Um usuario solicitou entrada no grupo." });
          }
          void loadPendingRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeGroupId, isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const loadedGroup = await loadGroup();
      await Promise.all([loadMembers(loadedGroup?.created_by ?? null), loadPresence(), loadPendingRequests()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    if (!activeGroupId || !isAdmin) {
      setPendingRequests([]);
      return;
    }

    setLoadingRequests(true);
    try {
      const { data, error } = await supabase
        .from("group_join_requests")
        .select("id, user_id, group_id, status, created_at")
        .eq("group_id", activeGroupId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = ((data as any[]) ?? []).filter((row) => row.user_id);
      const userIds = rows.map((row) => row.user_id as string);
      const profileById = new Map<string, { username: string; email: string | null }>();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username, email")
          .in("id", userIds);

        if (!profilesError) {
          (profiles as any[] | null)?.forEach((profile) => {
            if (!profile?.id) return;
            profileById.set(profile.id, {
              username: profile.username || profile.email?.split("@")[0] || "Usuario",
              email: profile.email ?? null,
            });
          });
        }
      }

      setPendingRequests(
        rows.map((row) => {
          const profile = profileById.get(row.user_id);
          return {
            id: row.id,
            user_id: row.user_id,
            group_id: row.group_id,
            status: row.status ?? "pending",
            created_at: row.created_at,
            username: profile?.username ?? "Usuario",
            email: profile?.email ?? null,
          } satisfies JoinRequestRow;
        }),
      );
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel carregar solicitacoes.");
    } finally {
      setLoadingRequests(false);
    }
  };

  const refreshGroupPhotoUrl = async (path: string | null) => {
    if (!path) {
      setGroupPhotoUrl(null);
      return;
    }

    const { data, error } = await supabase.storage.from("group-photos").createSignedUrl(path, 60 * 60);
    if (error) {
      setGroupPhotoUrl(null);
      return;
    }
    setGroupPhotoUrl(data.signedUrl);
  };

  const loadGroup = async () => {
    if (!activeGroupId) return null;

    const { data, error } = await supabase
      .from("management_groups")
      .select("id, name, description, photo_url, created_by")
      .eq("id", activeGroupId)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar as informações do grupo.");
      return null;
    }

    const nextGroup = (data as any) ?? null;
    setGroup(nextGroup);
    setDraftName(nextGroup?.name ?? "");
    setDraftDescription(nextGroup?.description ?? "");
    await refreshGroupPhotoUrl(nextGroup?.photo_url ?? null);
    return nextGroup as GroupDetails | null;
  };

  const loadMembers = async (ownerId = group?.created_by ?? null) => {
    if (!activeGroupId) return;

    const { data: groupMembers, error: membersError } = await supabase
      .from("group_members")
      .select("id, user_id, role, created_at")
      .eq("group_id", activeGroupId)
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error(membersError);
      toast.error("Não foi possível carregar os membros do grupo.");
      return;
    }

    const rows = ((groupMembers as any[]) ?? []).filter((row) => row.user_id);
    const userIds = rows.map((row) => row.user_id as string);

    const profileById = new Map<string, { username: string; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds);

      if (!profilesError) {
        (profiles as any[] | null)?.forEach((profile) => {
          if (!profile?.id) return;
          profileById.set(profile.id, {
            username: profile.username || profile.email?.split("@")[0] || "Usuário",
            email: profile.email ?? null,
          });
        });
      }
    }

    setMembers(
      rows
        .map((row) => {
          const profile = profileById.get(row.user_id);
          return {
            id: row.id,
            user_id: row.user_id,
            role: row.role ?? "member",
            created_at: row.created_at,
            username: profile?.username ?? "Usuário",
            email: profile?.email ?? null,
          } satisfies GroupMember;
        })
        .sort((a, b) => {
          if (a.user_id === ownerId) return -1;
          if (b.user_id === ownerId) return 1;
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.username.localeCompare(b.username, "pt-BR");
        }),
    );
  };

  const loadPresence = async () => {
    if (!activeGroupId) return;

    const { data, error } = await supabase
      .from("group_user_presence")
      .select("user_id, last_seen_at")
      .eq("group_id", activeGroupId);

    if (error) {
      console.error(error);
      return;
    }

    const nextPresence: Record<string, PresenceRow> = {};
    (data as any[] | null)?.forEach((row) => {
      if (row?.user_id) nextPresence[row.user_id] = row as PresenceRow;
    });
    setPresenceByUserId(nextPresence);
  };

  const handleSaveInfo = async () => {
    if (!activeGroupId) return;
    if (!draftName.trim()) return toast.error("Informe o nome do grupo.");

    setSavingInfo(true);
    try {
      const { error } = await supabase.rpc("update_management_group_info", {
        _group_id: activeGroupId,
        _name: draftName.trim(),
        _description: draftDescription.trim(),
      });
      if (error) throw error;

      toast.success("Informações do grupo atualizadas.");
      setEditOpen(false);
      await Promise.all([loadGroup(), refresh()]);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o grupo.");
    } finally {
      setSavingInfo(false);
    }
  };

  const handleGroupPhotoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoImageSrc(reader.result);
        setPhotoDialogOpen(true);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleGroupPhotoCropped = async (blob: Blob) => {
    if (!activeGroupId) return;

    setPhotoSaving(true);
    try {
      const filePath = `${activeGroupId}/group-photo.jpg`;
      const { error: uploadError } = await supabase.storage.from("group-photos").upload(filePath, blob, {
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

      toast.success("Foto do grupo atualizada.");
      await Promise.all([loadGroup(), refresh()]);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível atualizar a foto.");
    } finally {
      setPhotoSaving(false);
      setPhotoDialogOpen(false);
      setPhotoImageSrc(null);
    }
  };

  const handleCreateInvite = async () => {
    if (!activeGroupId || !isAdmin) return;

    setCreatingInvite(true);
    try {
      const token = createInviteToken();
      let { error } = await supabase.rpc("create_group_invite" as any, {
        _group_id: activeGroupId,
        _token: token,
        _expires_in_minutes: 10,
      });

      if (error && String(error.message ?? "").toLowerCase().includes("_expires_in_minutes")) {
        const fallback = await supabase.rpc("create_group_invite" as any, {
          _group_id: activeGroupId,
          _token: token,
          _expires_in_hours: 1,
        });
        error = fallback.error;
        if (!error) {
          toast.warning("Seu banco local ainda precisa da migration nova; este link expira pelo limite antigo.");
        }
      }

      if (error) throw error;

      const link = `${window.location.origin}/convite/${encodeURIComponent(token)}`;
      setInviteLink(link);

      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link criado e copiado. Ele expira em 10 minutos.");
      } catch {
        toast.success("Link criado. Ele expira em 10 minutos.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível gerar o link de convite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setRemovingMember(true);
    try {
      const { error } = await supabase.from("group_members").delete().eq("id", memberToRemove.id);
      if (error) throw error;

      toast.success("Membro removido do grupo.");
      await loadMembers(group?.created_by ?? null);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível remover o membro.");
    } finally {
      setRemovingMember(false);
      setMemberToRemove(null);
    }
  };

  const handlePromoteMember = async () => {
    if (!activeGroupId || !isAdmin || !memberToPromote) return;

    setChangingRoleMemberId(memberToPromote.id);
    try {
      const { error } = await supabase.from("group_members").update({ role: "admin" }).eq("id", memberToPromote.id);
      if (error) throw error;

      toast.success(`${memberToPromote.username} agora é admin do grupo.`);
      await loadMembers(group?.created_by ?? null);
      setMemberToPromote(null);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível tornar este usuário admin.");
    } finally {
      setChangingRoleMemberId(null);
    }
  };

  const handleDecideRequest = async (requestId: string, action: "approve" | "reject") => {
    if (!activeGroupId || !isAdmin) return;

    setRequestActionId(requestId);
    try {
      const { error } = await supabase.rpc("decide_group_join_request" as any, {
        _request_id: requestId,
        _action: action,
      });
      if (error) throw error;

      toast.success(action === "approve" ? "Usuario aprovado." : "Solicitacao rejeitada.");
      await Promise.all([loadPendingRequests(), loadMembers(group?.created_by ?? null), refresh()]);
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel concluir a acao.");
    } finally {
      setRequestActionId(null);
    }
  };

  const handleSwitchGroup = async (groupId: string) => {
    if (groupId === activeGroupId) return;

    setSwitchingGroupId(groupId);
    try {
      await setActiveGroupById(groupId);
      toast.success("Grupo alternado com sucesso.");
      await loadAll();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível alternar o grupo.");
    } finally {
      setSwitchingGroupId(null);
    }
  };

  const adminName = useMemo(() => {
    const ownerId = group?.created_by;
    return members.find((member) => member.user_id === ownerId)?.username ?? "Administrador";
  }, [group?.created_by, members]);

  if (loadingActiveGroup || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeGroupId || !group) return null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-1 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-0 md:pb-6">
      <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 rounded-3xl border border-border/60 md:h-24 md:w-24">
              <AvatarImage className="rounded-3xl object-cover" src={groupPhotoUrl || undefined} />
              <AvatarFallback className="rounded-3xl bg-primary/10 text-3xl font-semibold text-primary">
                {group.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-foreground">{group.name}</h1>
                {isAdmin ? <Badge>Admin</Badge> : <Badge variant="outline">Membro</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{group.description || "Sem descrição do grupo."}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-1">
                  <Users className="h-3.5 w-3.5" />
                  {members.length} membro(s)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-1">
                  <Crown className="h-3.5 w-3.5 text-primary" />
                  {adminName}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
          <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administração
            </CardTitle>
            <CardDescription>Gerencie informações e convites temporários.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 pb-4 md:grid-cols-2 md:px-6 md:pb-6">
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)} className="h-12 rounded-2xl md:rounded-md">
              <Pencil className="mr-2 h-4 w-4" />
              Editar grupo
            </Button>
            <Button type="button" onClick={handleCreateInvite} disabled={creatingInvite} className="h-12 rounded-2xl md:rounded-md">
              {creatingInvite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Gerar convite
            </Button>
            {inviteLink ? (
              <div className="md:col-span-2 flex flex-col gap-2 rounded-2xl border border-border bg-background/60 p-2 md:flex-row md:rounded-lg">
                <Input value={inviteLink} readOnly className="h-10 text-xs" />
                <Button type="button" variant="outline" onClick={handleCopyInvite} className="rounded-2xl md:rounded-md">
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
          <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <UserPlus className="h-5 w-5" />
                  Solicitacoes de entrada
                </CardTitle>
                <CardDescription>Aprove ou rejeite usuarios que pediram acesso ao grupo.</CardDescription>
              </div>
              {pendingRequests.length > 0 ? (
                <Badge className="shrink-0 rounded-full">{pendingRequests.length}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4 md:px-6 md:pb-6">
            {loadingRequests ? (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground md:rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando solicitacoes...
              </div>
            ) : pendingRequests.length === 0 ? (
              <p className="rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground md:rounded-lg">
                Nenhuma solicitacao pendente.
              </p>
            ) : (
              pendingRequests.map((request) => {
                const processing = requestActionId === request.id;
                return (
                  <div key={request.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
                    <Avatar className="h-11 w-11 rounded-2xl border border-border/60">
                      <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">
                        {request.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{request.username}</p>
                      <p className="truncate text-xs text-muted-foreground">{request.email || "E-mail nao informado"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Solicitou {formatDistanceToNowStrict(new Date(request.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="icon"
                        className="h-10 w-10 rounded-2xl md:rounded-md"
                        disabled={processing}
                        onClick={() => void handleDecideRequest(request.id, "approve")}
                        aria-label="Aprovar solicitacao"
                      >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 rounded-2xl text-destructive hover:text-destructive md:rounded-md"
                        disabled={processing}
                        onClick={() => void handleDecideRequest(request.id, "reject")}
                        aria-label="Rejeitar solicitacao"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
        <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <ArrowRightLeft className="h-5 w-5" />
            Acesso a grupos
          </CardTitle>
          <CardDescription>Alterne entre grupos vinculados ou solicite entrada em outro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 md:px-6 md:pb-6">
          {groups.length > 1 ? (
            <div className="space-y-2">
              {groups.map((availableGroup) => {
                const current = availableGroup.id === activeGroupId;
                return (
                  <button
                    key={availableGroup.id}
                    type="button"
                    onClick={() => void handleSwitchGroup(availableGroup.id)}
                    disabled={current || switchingGroupId === availableGroup.id}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-colors md:rounded-lg ${
                      current ? "border-primary bg-primary/10" : "border-border bg-background/60 hover:bg-accent/45"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{availableGroup.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {current ? "Grupo ativo" : availableGroup.description || "Alternar para este grupo"}
                      </p>
                    </div>
                    {switchingGroupId === availableGroup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-background/60 p-3 text-sm text-muted-foreground md:rounded-lg">
              Você participa apenas deste grupo no momento.
            </p>
          )}

          <Button type="button" variant="outline" className="h-11 w-full rounded-2xl md:rounded-md" onClick={() => navigate("/grupo?change=1")}>
            <LogIn className="mr-2 h-4 w-4" />
            Entrar em outro grupo
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
        <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
          <CardTitle>Membros do grupo</CardTitle>
          <CardDescription>Atividade e status dos usuários vinculados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
          {members.map((member) => {
            const activity = memberActivityLabel(presenceByUserId[member.user_id]);
            const isOwner = member.user_id === group.created_by;
            const canRemove = isAdmin && !isOwner && member.user_id !== user?.id;
            const canPromote = isAdmin && !isOwner && member.role !== "admin";

            return (
              <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
                <div className="relative">
                  <Avatar className="h-12 w-12 rounded-2xl border border-border/60">
                    <AvatarFallback className="rounded-2xl bg-accent font-semibold text-foreground">
                      {member.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                      activity.online ? "bg-emerald-500" : "bg-muted-foreground/35"
                    }`}
                    aria-label={activity.online ? "Online" : "Offline"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{member.username}</p>
                    {isOwner ? (
                      <Badge className="gap-1">
                        <Crown className="h-3 w-3" />
                        Administrador
                      </Badge>
                    ) : member.role === "admin" ? (
                      <Badge variant="secondary">Admin</Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.email || "E-mail não informado"}</p>
                  <p className={activity.online ? "mt-1 text-xs font-medium text-emerald-600" : "mt-1 text-xs text-muted-foreground"}>
                    {activity.label}
                  </p>
                </div>
                {canPromote || canRemove ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    {canPromote ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-2xl text-primary md:rounded-md"
                        disabled={changingRoleMemberId === member.id}
                        onClick={() => setMemberToPromote(member)}
                        aria-label="Tornar administrador"
                        title="Tornar administrador"
                      >
                        {changingRoleMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                      </Button>
                    ) : null}
                    {canRemove ? (
                      <Button type="button" variant="destructive" size="icon" className="h-10 w-10 rounded-2xl md:rounded-md" onClick={() => setMemberToRemove(member)} aria-label="Expulsar usuário">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
            <DialogDescription>Altere nome, descrição e foto do grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-12 w-12 rounded-2xl border border-border/60">
                  <AvatarImage className="rounded-2xl object-cover" src={groupPhotoUrl || undefined} />
                  <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">
                    {group.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">Foto do grupo</p>
                  <p className="truncate text-xs text-muted-foreground">Visível para os membros</p>
                </div>
              </div>
              <label className="shrink-0">
                <input type="file" accept="image/*" className="hidden" onChange={handleGroupPhotoFileChange} disabled={photoSaving} />
                <Button type="button" variant="outline" size="sm" disabled={photoSaving} asChild>
                  <span>
                    {photoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Alterar
                  </span>
                </Button>
              </label>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveInfo} disabled={savingInfo}>
              {savingInfo ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Expulsar usuário do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToRemove?.username} perderá o acesso aos dados deste grupo. Essa ação pode ser revertida com um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} disabled={removingMember}>
              {removingMember ? "Removendo..." : "Expulsar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToPromote} onOpenChange={(open) => !open && setMemberToPromote(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja tornar esse usuário administrador do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToPromote?.username} poderá gerenciar membros, convites e informações do grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteMember} disabled={!!changingRoleMemberId}>
              {changingRoleMemberId ? "Salvando..." : "Tornar administrador"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoImageSrc ? (
        <ImageCropDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          imageSrc={photoImageSrc}
          onCropComplete={handleGroupPhotoCropped}
        />
      ) : null}
    </div>
  );
}
