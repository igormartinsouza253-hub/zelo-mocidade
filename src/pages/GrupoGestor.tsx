import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ImageCropDialog } from "@/components/ImageCropDialog";
import { PasswordInput } from "@/components/PasswordInput";
import { ZeloLogo } from "@/components/ZeloLogo";
import { usePageHeader } from "@/components/layout/PageHeaderContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  photo_url?: string | null;
  member_count?: number | null;
};

type JoinRequestRow = {
  id: string;
  user_id: string;
  group_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function getGroupErrorMessage(error: unknown, fallback: string) {
  const details = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : null;
  const code = String(details?.code ?? "");
  const message = String(details?.message ?? error ?? "").toLowerCase();

  if (message.includes("not_authenticated") || code === "401") return "Sua sessão expirou. Faça login novamente.";
  if (message.includes("invalid_password")) return "Senha do grupo incorreta.";
  if (message.includes("already_member")) return "Você já faz parte deste grupo.";
  if (message.includes("group_not_found") || code === "PGRST116") return "Grupo não encontrado. Atualize a lista e tente novamente.";
  if (message.includes("duplicate") || code === "23505") return "Já existe uma solicitação para este grupo.";
  if (code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "Sua conta ainda não tem permissão para concluir esta ação. Saia e entre novamente; se continuar, peça ao admin para verificar seu acesso.";
  }
  if (message.includes("network") || message.includes("failed to fetch")) return "Falha de conexão. Verifique a internet e tente novamente.";

  return fallback;
}

export default function GrupoGestor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changeMode = searchParams.get("change") === "1";

  const { user, signOut } = useAuth();
  const { profile } = useCurrentProfile();
  const { activeGroupId, activeGroup, groups: userGroups, refresh, setActiveGroupById } = useActiveGroup();
  const { setConfig } = usePageHeader();

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupPhotoUrls, setGroupPhotoUrls] = useState<Record<string, string>>({});
  const [groupSearch, setGroupSearch] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [mobileGroupPage, setMobileGroupPage] = useState<"join" | "create">("join");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [groupPhotoBlob, setGroupPhotoBlob] = useState<Blob | null>(null);
  const [groupPhotoPreview, setGroupPhotoPreview] = useState<string | null>(null);
  const [photoImageSrc, setPhotoImageSrc] = useState<string | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(1);

  const [myJoinRequests, setMyJoinRequests] = useState<Record<string, JoinRequestRow>>({});
  const joinFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConfig({
      title: "Grupo gestor",
      icon: Users,
      breadcrumbs: [{ label: "Início", href: "/" }, { label: "Grupo gestor" }],
      showBackButton: true,
      backTo: "/",
    });
    return () => setConfig(null);
  }, [setConfig]);

  const canContinueToApp = !!activeGroupId;
  const selectedGroup = useMemo(() => groups.find((group) => group.id === selectedGroupId) ?? null, [groups, selectedGroupId]);
  const userGroupIds = useMemo(() => new Set(userGroups.map((group) => group.id)), [userGroups]);
  const filteredGroups = useMemo(() => {
    const term = groupSearch.trim().toLowerCase();
    return groups
      .filter((group) => {
        if (!term) return true;
        return `${group.name} ${group.description ?? ""}`.toLowerCase().includes(term);
      })
      .sort((a, b) => {
        const aActive = a.id === activeGroupId ? 1 : 0;
        const bActive = b.id === activeGroupId ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const aMine = userGroupIds.has(a.id) ? 1 : 0;
        const bMine = userGroupIds.has(b.id) ? 1 : 0;
        if (aMine !== bMine) return bMine - aMine;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [activeGroupId, groupSearch, groups, userGroupIds]);
  const profileName = profile?.username || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Conta";
  const profileInitial = (profileName || user?.email || "U").charAt(0).toUpperCase();

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase
        .from("management_groups")
        .select("id, name, description, photo_url, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const nextGroups = (data ?? []).filter((group) => Boolean(group.id && group.name));
      const groupIds = nextGroups.map((group: GroupRow) => group.id);
      let counts: Record<string, number> = {};
      if (groupIds.length > 0) {
        const { data: memberRows } = await supabase.from("group_members").select("group_id").in("group_id", groupIds);
        counts = (memberRows ?? []).reduce<Record<string, number>>((acc, row) => {
          acc[row.group_id] = (acc[row.group_id] ?? 0) + 1;
          return acc;
        }, {});
      }
      setGroups(nextGroups.map((group: GroupRow) => ({ ...group, member_count: counts[group.id] ?? null })));

      const photoEntries = await Promise.all(
        nextGroups.map(async (group: GroupRow) => {
          if (!group.photo_url) return [group.id, ""] as const;
          const { data: signed } = await supabase.storage.from("group-photos").createSignedUrl(group.photo_url, 60 * 60);
          return [group.id, signed?.signedUrl ?? ""] as const;
        }),
      );
      setGroupPhotoUrls(Object.fromEntries(photoEntries.filter(([, url]) => Boolean(url))));
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const loadMyJoinRequests = useCallback(async () => {
    if (!user) {
      setMyJoinRequests({});
      return;
    }

    const { data, error } = await supabase
      .from("group_join_requests")
      .select("id, user_id, group_id, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const latestByGroup = (data ?? []).reduce<Record<string, JoinRequestRow>>((acc, request) => {
      if (!acc[request.group_id]) acc[request.group_id] = request;
      return acc;
    }, {});
    setMyJoinRequests(latestByGroup);
  }, [user]);

  useEffect(() => {
    void loadGroups().catch((error) => {
      console.error(error);
      toast.error("Não foi possível carregar os grupos.");
    });
  }, [loadGroups]);

  useEffect(() => {
    void loadMyJoinRequests().catch((error) => {
      console.error(error);
    });
  }, [loadMyJoinRequests]);

  useEffect(() => {
    if (!user || activeGroupId || changeMode) return;

    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const hasGroup = await refresh();
        if (!cancelled && hasGroup) toast.success("Grupo confirmado! Toque em Ir para o app.");
      } catch (error) {
        console.error("[GrupoGestor] Erro ao atualizar grupos do usuário", error);
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeGroupId, changeMode, refresh, user]);

  useEffect(() => {
    return () => {
      if (groupPhotoPreview) URL.revokeObjectURL(groupPhotoPreview);
    };
  }, [groupPhotoPreview]);

  const handleCreatePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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

  const handleCreatePhotoCropped = (blob: Blob) => {
    if (groupPhotoPreview) URL.revokeObjectURL(groupPhotoPreview);
    setGroupPhotoBlob(blob);
    setGroupPhotoPreview(URL.createObjectURL(blob));
  };

  const uploadCreatedGroupPhoto = async (groupId: string) => {
    if (!groupPhotoBlob) return;

    const filePath = `${groupId}/group-photo.jpg`;
    const { error: uploadError } = await supabase.storage.from("group-photos").upload(filePath, groupPhotoBlob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase.from("management_groups").update({ photo_url: filePath }).eq("id", groupId);
    if (updateError) throw updateError;
  };

  const handleCreateGroup = async () => {
    if (!user) return;
    if (!groupName.trim()) return toast.error("Informe o nome do grupo");
    if (groupPassword.trim().length < 4) return toast.error("A senha do grupo deve ter pelo menos 4 caracteres");

    setCreating(true);
    try {
      const { data: groupId, error } = await supabase.rpc("create_management_group", {
        _name: groupName.trim(),
        _description: groupDesc.trim() || "",
        _password: groupPassword.trim(),
      });

      if (error) {
        let msgErro = "Não foi possível criar o grupo.";
        if (error.message?.includes("not_authenticated")) msgErro = "Sua sessão expirou. Faça login novamente.";
        else if (error.message?.includes("duplicate") || error.code === "23505") msgErro = "Já existe um grupo com esse nome.";
        else if (error.message?.includes("invalid_name")) msgErro = "Nome do grupo inválido.";
        else if (error.message?.includes("invalid_password")) msgErro = "Senha inválida ou muito curta (mín. 4 caracteres).";
        else if (error.code === "42501") msgErro = "Você não tem permissão para criar um grupo.";
        toast.error(msgErro);
        return;
      }

      const createdGroupId = groupId as string;
      await setActiveGroupById(createdGroupId);
      try {
        await uploadCreatedGroupPhoto(createdGroupId);
      } catch (photoError) {
        console.error("[GrupoGestor] Erro ao salvar foto do grupo", photoError);
        toast.warning("Grupo criado, mas não foi possível salvar a foto agora.");
      }
      toast.success("Grupo criado! Você é admin do grupo.");
      navigate("/grupo/info");
    } catch (error) {
      console.error("[GrupoGestor] Erro inesperado ao criar grupo", error);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setCreating(false);
      await refresh();
    }
  };

  const handleRequestJoin = async () => {
    if (!user) return;
    if (!selectedGroupId) return toast.error("Selecione um grupo");
    if (userGroupIds.has(selectedGroupId)) {
      await setActiveGroupById(selectedGroupId);
      toast.success("Grupo alternado com sucesso.");
      navigate("/", { replace: true });
      return;
    }
    if (!joinPassword.trim()) return toast.error("Informe a senha do grupo");

    setJoining(true);
    try {
      const { data: requestStatus, error } = await supabase.rpc("request_group_join", {
        _group_id: selectedGroupId,
        _password: joinPassword.trim(),
      });
      if (error) throw error;

      if (requestStatus === "already_member") {
        await setActiveGroupById(selectedGroupId);
        toast.success("Grupo ativado com sucesso.");
        navigate("/", { replace: true });
        return;
      }

      if (requestStatus === "already_pending") toast.info("Sua solicitação já está pendente. Aguarde a aprovação do admin.");
      else toast.success("Solicitação enviada! Aguarde aprovação do admin.");
      setJoinPassword("");
      await loadMyJoinRequests();
    } catch (error) {
      console.error(error);
      toast.error(getGroupErrorMessage(error, "Não foi possível solicitar entrada no grupo."));
    } finally {
      setJoining(false);
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    window.setTimeout(() => {
      joinFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleCreateNextStep = () => {
    if (createStep === 1 && !groupName.trim()) return toast.error("Informe o nome do grupo");
    if (createStep === 3 && groupPassword.trim().length < 4) return toast.error("A senha do grupo deve ter pelo menos 4 caracteres");
    setCreateStep((current) => Math.min(current + 1, 3));
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logout realizado com sucesso.");
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível sair da conta.");
    }
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <div className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2" aria-label="Ir para início">
          <ZeloLogo compact className="h-10 w-10 rounded-xl p-1" />
        </button>

        <p className="max-w-[48vw] truncate text-xs font-extrabold uppercase tracking-[0.12em] text-foreground">Grupo gestor</p>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card" aria-label="Conta">
              <Avatar className="h-8 w-8 rounded-xl">
                <AvatarImage className="rounded-xl" src={profile?.avatar_url || undefined} />
                <AvatarFallback className="rounded-xl bg-accent text-sm font-semibold text-foreground">{profileInitial}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium text-foreground">{profileName}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email || user?.email || ""}</p>
            </div>
            <DropdownMenuSeparator />
            {activeGroupId ? (
              <DropdownMenuItem onClick={() => navigate("/grupo/info")} className="cursor-pointer">
                <UserRound className="mr-2 h-4 w-4" />
                Visualizar grupo
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
        <div className="mx-auto w-full max-w-5xl space-y-3 px-2 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-3 md:space-y-4 md:px-6 md:py-8 lg:px-8">
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
          <CardContent className="p-3 md:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary md:h-12 md:w-12">
                {canContinueToApp ? <Shield className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {canContinueToApp ? "Grupo ativo" : "Primeiro acesso"}
                </p>
                <h1 className="mt-1 text-base font-bold leading-tight text-foreground md:text-2xl">
                  {canContinueToApp ? activeGroup?.name ?? "-" : "Entre em um grupo gestor"}
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">
                  {canContinueToApp
                    ? changeMode
                      ? "Você pode solicitar entrada em outro grupo sem sair do atual."
                      : "Sua conta já está vinculada a um grupo gestor."
                    : "Escolha um grupo existente para entrar ou avance para criar um grupo novo."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 md:hidden">
          <div className="sticky top-2 z-20 grid grid-cols-2 gap-2 rounded-3xl border border-border bg-card/95 p-1 shadow-[var(--shadow-card)] backdrop-blur">
            <button
              type="button"
              onClick={() => setMobileGroupPage("join")}
              className={`flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors ${
                mobileGroupPage === "join" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Users className="h-4 w-4" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMobileGroupPage("create")}
              className={`flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors ${
                mobileGroupPage === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              <Plus className="h-4 w-4" />
              Criar
            </button>
          </div>

          {mobileGroupPage === "join" ? (
            <div className="space-y-3">
              <EnhancedGroupListCard
                groups={filteredGroups}
                totalGroups={groups.length}
                activeGroupId={activeGroupId}
                userGroupIds={userGroupIds}
                selectedGroupId={selectedGroupId}
                groupPhotoUrls={groupPhotoUrls}
                myJoinRequests={myJoinRequests}
                groupSearch={groupSearch}
                setGroupSearch={setGroupSearch}
                loadingGroups={loadingGroups}
                onSelect={handleSelectGroup}
                onRefresh={() => void loadGroups()}
              />
              <EnhancedJoinGroupCard
                refTarget={joinFormRef}
                selectedGroup={selectedGroup}
                activeGroupId={activeGroupId}
                isMember={selectedGroup ? userGroupIds.has(selectedGroup.id) : false}
                request={selectedGroup ? myJoinRequests[selectedGroup.id] : undefined}
                joinPassword={joinPassword}
                setJoinPassword={setJoinPassword}
                joining={joining}
                canSubmit={!!selectedGroupId}
                onSubmit={handleRequestJoin}
              />
              <Button type="button" variant="outline" className="h-11 w-full rounded-2xl" onClick={() => setMobileGroupPage("create")}>
                Criar um novo grupo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <EnhancedCreateGroupCard
                groupName={groupName}
                setGroupName={setGroupName}
                groupDesc={groupDesc}
                setGroupDesc={setGroupDesc}
                groupPassword={groupPassword}
                setGroupPassword={setGroupPassword}
                groupPhotoPreview={groupPhotoPreview}
                creating={creating}
                createStep={createStep}
                setCreateStep={setCreateStep}
                onNextStep={handleCreateNextStep}
                onPhotoChange={handleCreatePhotoFileChange}
                onCreate={handleCreateGroup}
              />
              <Button type="button" variant="outline" className="h-11 w-full rounded-2xl" onClick={() => setMobileGroupPage("join")}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar para grupos
              </Button>
            </div>
          )}
        </div>

        <div className="hidden gap-3 md:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-4">
          <div className="order-1 space-y-3 lg:order-2 lg:space-y-4">
            <EnhancedCreateGroupCard
              groupName={groupName}
              setGroupName={setGroupName}
              groupDesc={groupDesc}
              setGroupDesc={setGroupDesc}
              groupPassword={groupPassword}
              setGroupPassword={setGroupPassword}
              groupPhotoPreview={groupPhotoPreview}
              creating={creating}
              createStep={createStep}
              setCreateStep={setCreateStep}
              onNextStep={handleCreateNextStep}
              onPhotoChange={handleCreatePhotoFileChange}
              onCreate={handleCreateGroup}
            />
            <EnhancedJoinGroupCard
              refTarget={joinFormRef}
              selectedGroup={selectedGroup}
              activeGroupId={activeGroupId}
              isMember={selectedGroup ? userGroupIds.has(selectedGroup.id) : false}
              request={selectedGroup ? myJoinRequests[selectedGroup.id] : undefined}
              joinPassword={joinPassword}
              setJoinPassword={setJoinPassword}
              joining={joining}
              canSubmit={!!selectedGroupId}
              onSubmit={handleRequestJoin}
            />
          </div>
          <EnhancedGroupListCard
            groups={filteredGroups}
            totalGroups={groups.length}
            activeGroupId={activeGroupId}
            userGroupIds={userGroupIds}
            selectedGroupId={selectedGroupId}
            groupPhotoUrls={groupPhotoUrls}
            myJoinRequests={myJoinRequests}
            groupSearch={groupSearch}
            setGroupSearch={setGroupSearch}
            loadingGroups={loadingGroups}
            onSelect={handleSelectGroup}
            onRefresh={() => void loadGroups()}
          />
        </div>

        </div>
      </main>

      {photoImageSrc ? (
        <ImageCropDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          imageSrc={photoImageSrc}
          onCropComplete={handleCreatePhotoCropped}
        />
      ) : null}
    </div>
  );
}

function GroupListCard({
  groups,
  activeGroupId,
  selectedGroupId,
  groupPhotoUrls,
  loadingGroups,
  onSelect,
  onRefresh,
}: {
  groups: GroupRow[];
  activeGroupId: string | null;
  selectedGroupId: string;
  groupPhotoUrls: Record<string, string>;
  loadingGroups: boolean;
  onSelect: (groupId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg leading-tight md:text-2xl">Grupos disponíveis</CardTitle>
            <CardDescription>{loadingGroups ? "Carregando grupos..." : `${groups.length} grupo(s) encontrado(s)`}</CardDescription>
          </div>
          <Button size="icon" variant="outline" disabled={loadingGroups} onClick={onRefresh} className="h-10 w-10 rounded-2xl md:rounded-md" aria-label="Atualizar lista">
            {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        {!loadingGroups && groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
            Nenhum grupo disponível no momento.
          </div>
        ) : null}

        {groups.map((group) => {
          const selected = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`flex min-h-[5.25rem] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors md:rounded-lg ${
                selected ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-background/65 hover:bg-accent/45"
              }`}
            >
              <Avatar className="h-12 w-12 rounded-2xl border border-border/60">
                <AvatarImage className="rounded-2xl object-cover" src={groupPhotoUrls[group.id] || undefined} />
                <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">{group.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
                  {activeGroupId === group.id ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{group.description || "Sem descrição"}</p>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function JoinGroupCard({
  selectedGroup,
  joinPassword,
  setJoinPassword,
  joining,
  canSubmit,
  onSubmit,
}: {
  selectedGroup: GroupRow | null;
  joinPassword: string;
  setJoinPassword: (value: string) => void;
  joining: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
        <CardTitle className="text-lg leading-tight md:text-2xl">Entrar no grupo</CardTitle>
        <CardDescription>Selecione um grupo na lista e informe a senha.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        <div className="rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
          <p className="text-xs font-medium text-muted-foreground">Grupo selecionado</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedGroup?.name ?? "Nenhum grupo selecionado"}</p>
        </div>
        <div className="space-y-2">
          <Label>Senha do grupo</Label>
          <PasswordInput value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} />
        </div>
        <Button variant="outline" disabled={joining || !canSubmit} onClick={onSubmit} className="h-11 w-full rounded-2xl md:rounded-md">
          {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          Solicitar entrada
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateGroupCard({
  groupName,
  setGroupName,
  groupDesc,
  setGroupDesc,
  groupPassword,
  setGroupPassword,
  groupPhotoPreview,
  creating,
  onPhotoChange,
  onCreate,
}: {
  groupName: string;
  setGroupName: (value: string) => void;
  groupDesc: string;
  setGroupDesc: (value: string) => void;
  groupPassword: string;
  setGroupPassword: (value: string) => void;
  groupPhotoPreview: string | null;
  creating: boolean;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
        <CardTitle className="text-lg leading-tight md:text-2xl">Criar novo grupo</CardTitle>
        <CardDescription>O criador vira admin automaticamente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        <div className="space-y-2">
          <Label>Nome do grupo</Label>
          <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="h-11 rounded-2xl md:rounded-md" />
        </div>
        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Textarea value={groupDesc} onChange={(event) => setGroupDesc(event.target.value)} className="rounded-2xl md:rounded-md" />
        </div>
        <div className="space-y-2">
          <Label>Senha do grupo</Label>
          <PasswordInput value={groupPassword} onChange={(event) => setGroupPassword(event.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 rounded-2xl border border-border/60">
              <AvatarImage className="rounded-2xl object-cover" src={groupPhotoPreview || undefined} />
              <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">{(groupName || "G").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">Foto do grupo</p>
              <p className="truncate text-xs text-muted-foreground">Ajuda a identificar na lista</p>
            </div>
          </div>
          <label className="shrink-0">
            <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
            <Button type="button" size="sm" variant="outline" className="rounded-2xl md:rounded-md" asChild>
              <span>
                <Camera className="mr-2 h-4 w-4" />
                Foto
              </span>
            </Button>
          </label>
        </div>
        <Button disabled={creating} onClick={onCreate} className="h-11 w-full rounded-2xl md:rounded-md">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Criar grupo
        </Button>
      </CardContent>
    </Card>
  );
}

function EnhancedGroupListCard({
  groups,
  totalGroups,
  activeGroupId,
  userGroupIds,
  selectedGroupId,
  groupPhotoUrls,
  myJoinRequests,
  groupSearch,
  setGroupSearch,
  loadingGroups,
  onSelect,
  onRefresh,
}: {
  groups: GroupRow[];
  totalGroups: number;
  activeGroupId: string | null;
  userGroupIds: Set<string>;
  selectedGroupId: string;
  groupPhotoUrls: Record<string, string>;
  myJoinRequests: Record<string, JoinRequestRow>;
  groupSearch: string;
  setGroupSearch: (value: string) => void;
  loadingGroups: boolean;
  onSelect: (groupId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-3 pt-4 md:px-6 md:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight md:text-2xl">Grupos disponiveis</CardTitle>
            <CardDescription>{loadingGroups ? "Carregando grupos..." : `${groups.length} de ${totalGroups} grupo(s)`}</CardDescription>
          </div>
          <Button size="icon" variant="outline" disabled={loadingGroups} onClick={onRefresh} className="h-10 w-10 rounded-2xl md:rounded-md" aria-label="Atualizar lista">
            {loadingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
            placeholder="Buscar grupo"
            className="h-10 rounded-2xl pl-9 text-sm md:rounded-md"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 px-4 pb-4 md:px-6 md:pb-6">
        {!loadingGroups && groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {groupSearch.trim() ? "Nenhum grupo encontrado nessa busca." : "Nenhum grupo disponivel no momento."}
          </div>
        ) : null}

        {groups.map((group) => {
          const selected = selectedGroupId === group.id;
          const isActive = activeGroupId === group.id;
          const isMine = userGroupIds.has(group.id);
          const request = myJoinRequests[group.id];
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              className={`flex min-h-[4.8rem] w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors md:rounded-lg ${
                selected ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-background/65 hover:bg-accent/45"
              }`}
            >
              <Avatar className="h-11 w-11 rounded-2xl border border-border/60">
                <AvatarImage className="rounded-2xl object-cover" src={groupPhotoUrls[group.id] || undefined} />
                <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">{group.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
                  {isActive ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{group.description || "Sem descricao"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {isActive ? <Badge className="rounded-full px-2 py-0 text-[0.65rem]">Grupo atual</Badge> : null}
                  {!isActive && isMine ? <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.65rem]">Voce participa</Badge> : null}
                  {typeof group.member_count === "number" ? (
                    <Badge variant="outline" className="rounded-full px-2 py-0 text-[0.65rem]">{group.member_count} membro(s)</Badge>
                  ) : null}
                  {request ? <RequestStatusBadge status={request.status} /> : null}
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EnhancedJoinGroupCard({
  refTarget,
  selectedGroup,
  activeGroupId,
  isMember,
  request,
  joinPassword,
  setJoinPassword,
  joining,
  canSubmit,
  onSubmit,
}: {
  refTarget: RefObject<HTMLDivElement>;
  selectedGroup: GroupRow | null;
  activeGroupId: string | null;
  isMember: boolean;
  request?: JoinRequestRow;
  joinPassword: string;
  setJoinPassword: (value: string) => void;
  joining: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  const isCurrentGroup = !!selectedGroup && selectedGroup.id === activeGroupId;
  const isPending = request?.status === "pending";
  const canSwitchGroup = !!selectedGroup && isMember && !isCurrentGroup;
  const buttonLabel = isCurrentGroup ? "Grupo atual" : canSwitchGroup ? "Alternar para este grupo" : isPending ? "Solicitacao enviada" : "Solicitar entrada";

  return (
    <Card ref={refTarget} className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
        <CardTitle className="text-base leading-tight md:text-2xl">Entrar no grupo</CardTitle>
        <CardDescription>{selectedGroup ? "Confirme o grupo escolhido e informe a senha." : "Selecione um grupo na lista."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        <div className="rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
          <p className="text-xs font-medium text-muted-foreground">Grupo selecionado</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedGroup?.name ?? "Nenhum grupo selecionado"}</p>
          {request ? (
            <div className="mt-2">
              <RequestStatusBadge status={request.status} />
            </div>
          ) : null}
        </div>
        {!isCurrentGroup && !isPending && !canSwitchGroup ? (
          <div className="space-y-2">
            <Label>Senha do grupo</Label>
            <PasswordInput value={joinPassword} onChange={(event) => setJoinPassword(event.target.value)} />
          </div>
        ) : null}
        <Button variant={isCurrentGroup || isPending ? "secondary" : "default"} disabled={joining || !canSubmit || isCurrentGroup || isPending} onClick={onSubmit} className="h-11 w-full rounded-2xl md:rounded-md">
          {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function EnhancedCreateGroupCard({
  groupName,
  setGroupName,
  groupDesc,
  setGroupDesc,
  groupPassword,
  setGroupPassword,
  groupPhotoPreview,
  creating,
  createStep,
  setCreateStep,
  onNextStep,
  onPhotoChange,
  onCreate,
}: {
  groupName: string;
  setGroupName: (value: string) => void;
  groupDesc: string;
  setGroupDesc: (value: string) => void;
  groupPassword: string;
  setGroupPassword: (value: string) => void;
  groupPhotoPreview: string | null;
  creating: boolean;
  createStep: number;
  setCreateStep: (value: number) => void;
  onNextStep: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
}) {
  const showIdentity = createStep === 1;
  const showPhoto = createStep === 2;
  const showPassword = createStep === 3;

  return (
    <Card className="overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-[var(--shadow-card)] md:rounded-xl">
      <CardHeader className="px-4 pb-2 pt-4 md:px-6 md:pt-6">
        <CardTitle className="text-base leading-tight md:text-2xl">Criar novo grupo</CardTitle>
        <CardDescription>O criador vira admin automaticamente.</CardDescription>
        <CreateStepIndicator step={createStep} />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 md:px-6 md:pb-6">
        <GroupPreview name={groupName} description={groupDesc} photoUrl={groupPhotoPreview} />

        {showIdentity ? (
          <>
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="h-11 rounded-2xl md:rounded-md" />
            </div>
            <div className="space-y-2">
              <Label>Descricao (opcional)</Label>
              <Textarea value={groupDesc} onChange={(event) => setGroupDesc(event.target.value)} className="rounded-2xl md:rounded-md" />
            </div>
          </>
        ) : null}

        {showPhoto ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 rounded-2xl border border-border/60">
                <AvatarImage className="rounded-2xl object-cover" src={groupPhotoPreview || undefined} />
                <AvatarFallback className="rounded-2xl bg-primary/10 text-primary">{(groupName || "G").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">Foto do grupo</p>
                <p className="truncate text-xs text-muted-foreground">Ajuda a identificar na lista</p>
              </div>
            </div>
            <label className="shrink-0">
              <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} />
              <Button type="button" size="sm" variant="outline" className="rounded-2xl md:rounded-md" asChild>
                <span>
                  <Camera className="mr-2 h-4 w-4" />
                  Foto
                </span>
              </Button>
            </label>
          </div>
        ) : null}

        {showPassword ? (
          <div className="space-y-2">
            <Label>Senha do grupo</Label>
            <PasswordInput value={groupPassword} onChange={(event) => setGroupPassword(event.target.value)} />
            <p className="text-xs leading-relaxed text-muted-foreground">Essa senha sera usada somente para entrada manual. Convites por link continuam temporarios.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={createStep === 1 || creating} onClick={() => setCreateStep(Math.max(createStep - 1, 1))} className="h-11 rounded-2xl md:rounded-md">
            Voltar
          </Button>
          {createStep < 3 ? (
            <Button type="button" onClick={onNextStep} className="h-11 rounded-2xl md:rounded-md">
              Proximo
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={creating} onClick={onCreate} className="h-11 rounded-2xl md:rounded-md">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RequestStatusBadge({ status }: { status: JoinRequestRow["status"] }) {
  if (status === "pending") return <Badge variant="secondary" className="rounded-full px-2 py-0 text-[0.65rem]">Pendente</Badge>;
  if (status === "approved") return <Badge className="rounded-full px-2 py-0 text-[0.65rem]">Aprovado</Badge>;
  return <Badge variant="outline" className="rounded-full px-2 py-0 text-[0.65rem]">Recusado</Badge>;
}

function CreateStepIndicator({ step }: { step: number }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {["Dados", "Foto", "Senha"].map((label, index) => {
        const current = step === index + 1;
        const done = step > index + 1;
        return (
          <div key={label} className={`rounded-full px-2 py-1 text-center text-[0.65rem] font-semibold ${current || done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {label}
          </div>
        );
      })}
    </div>
  );
}

function GroupPreview({ name, description, photoUrl }: { name: string; description: string; photoUrl: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3 md:rounded-lg">
      <Avatar className="h-12 w-12 rounded-2xl border border-border/60">
        <AvatarImage className="rounded-2xl object-cover" src={photoUrl || undefined} />
        <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">{(name || "G").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name.trim() || "Nome do grupo"}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description.trim() || "Sem descricao"}</p>
      </div>
    </div>
  );
}
