import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveGroup } from "@/hooks/useActiveGroup";
import { usePageHeader } from "@/components/layout/PageHeaderContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/PasswordInput";
import { toast } from "sonner";
import { Loader2, Shield, Users } from "lucide-react";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
};

type JoinRequestRow = {
  id: string;
  user_id: string;
  group_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function GrupoGestor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const changeMode = searchParams.get("change") === "1";

  const { user } = useAuth();
  const { activeGroupId, activeGroup, isAdmin, refresh, setActiveGroupById } = useActiveGroup();
  const { setConfig } = usePageHeader();

  const [tab, setTab] = useState<"criar" | "entrar">("criar");

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joining, setJoining] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupPassword, setGroupPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<JoinRequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

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

  // Se já existe grupo ativo, não mostrar esta página (troca de grupo acontece em Configurações)
  useEffect(() => {
    if (!activeGroupId) return;
    if (changeMode) return;
    navigate("/", { replace: true });
  }, [activeGroupId, changeMode, navigate]);

  const canContinueToApp = !!activeGroupId;

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase
        .from("management_groups")
        .select("id, name, description")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setGroups((data as any) ?? []);
    } finally {
      setLoadingGroups(false);
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
      setPendingRequests((data as any) ?? []);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    void loadGroups().catch((e) => {
      console.error(e);
      toast.error("Não foi possível carregar os grupos.");
    });
  }, []);

  // Se o usuário solicitou entrada e foi aprovado, ativar o grupo automaticamente e ir para o app.
  useEffect(() => {
    if (!user) return;
    if (activeGroupId) return;

    let cancelled = false;

    const checkApproval = async () => {
      try {
        const { data, error } = await supabase
          .from("group_join_requests")
          .select("id, group_id, status")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .order("decided_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        const approved = (data as any)?.[0] as { group_id: string } | undefined;
        if (!approved?.group_id) return;

        if (cancelled) return;
        await setActiveGroupById(approved.group_id);
        toast.success("Entrada aprovada! Redirecionando...");
        navigate("/");
      } catch (e) {
        // silencioso: o polling não pode ficar spammando toasts
        console.error("[GrupoGestor] Erro ao checar aprovação", e);
      }
    };

    // roda uma vez e depois faz polling leve
    void checkApproval();
    const id = window.setInterval(checkApproval, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeGroupId, navigate, setActiveGroupById, user]);

  useEffect(() => {
    void loadPendingRequests().catch((e) => {
      console.error(e);
      toast.error("Não foi possível carregar solicitações.");
    });
  }, [activeGroupId, isAdmin]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const handleCreateGroup = async () => {
    if (!user) return;
    if (!groupName.trim()) return toast.error("Informe o nome do grupo");
    if (groupPassword.trim().length < 4) return toast.error("A senha do grupo deve ter pelo menos 4 caracteres");
    setCreating(true);
    console.log("[GrupoGestor] Tentando criar grupo via RPC", { user_id: user.id, groupName });
    try {
      const { data: groupId, error } = await supabase.rpc("create_management_group", {
        _name: groupName.trim(),
        _description: groupDesc.trim() || "",
        _password: groupPassword.trim(),
      });

      if (error) {
        console.error("[GrupoGestor] Erro ao criar grupo (RPC)", error);
        let msgErro = "Não foi possível criar o grupo.";
        if (error.message?.includes("not_authenticated")) {
          msgErro = "Sua sessão expirou. Faça login novamente.";
        } else if (error.message?.includes("duplicate") || error.code === "23505") {
          msgErro = "Já existe um grupo com esse nome.";
        } else if (error.message?.includes("invalid_name")) {
          msgErro = "Nome do grupo inválido.";
        } else if (error.message?.includes("invalid_password")) {
          msgErro = "Senha inválida ou muito curta (mín. 4 caracteres).";
        } else if (error.code === "42501") {
          msgErro = "Você não tem permissão para criar um grupo (sessão/permissão).";
        }
        toast.error(msgErro);
        return;
      }

      console.log("[GrupoGestor] Grupo criado com sucesso!", { groupId });
      await setActiveGroupById(groupId as string);
      toast.success("Grupo criado! Você é admin do grupo.");
      navigate("/");
    } catch (e: any) {
      console.error("[GrupoGestor] Erro inesperado ao criar grupo", e);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setCreating(false);
      await refresh();
    }
  };

  const handleRequestJoin = async () => {
    if (!user) return;
    if (!selectedGroupId) return toast.error("Selecione um grupo");
    if (!joinPassword.trim()) return toast.error("Informe a senha do grupo");
    setJoining(true);
    try {
      const { data: ok, error: passErr } = await supabase.rpc("check_group_password", {
        _group_id: selectedGroupId,
        _password: joinPassword.trim(),
      });
      if (passErr) throw passErr;
      if (!ok) {
        toast.error("Senha do grupo incorreta");
        return;
      }

      const { error } = await supabase.from("group_join_requests").upsert(
        {
          group_id: selectedGroupId,
          user_id: user.id,
          status: "pending",
        } as any,
        { onConflict: "group_id,user_id" },
      );
      if (error) throw error;
      toast.success("Solicitação enviada! Aguarde aprovação do admin.");
      setJoinPassword("");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível solicitar entrada.");
    } finally {
      setJoining(false);
    }
  };

  const decideRequest = async (requestId: string, userId: string, action: "approve" | "reject") => {
    if (!activeGroupId || !isAdmin) return;
    try {
      if (action === "approve") {
        const { error: insErr } = await supabase.from("group_members").insert({
          group_id: activeGroupId,
          user_id: userId,
          role: "member",
        } as any);
        if (insErr) throw insErr;
      }

      const { error: updErr } = await supabase
        .from("group_join_requests")
        .update({
          status: action === "approve" ? "approved" : "rejected",
          decided_at: new Date().toISOString(),
          decided_by: user?.id,
        } as any)
        .eq("id", requestId);
      if (updErr) throw updErr;

      toast.success(action === "approve" ? "Usuário aprovado." : "Solicitação rejeitada.");
      await loadPendingRequests();
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível concluir a ação.");
    }
  };

  return (
    <div className="h-full w-full bg-background">
      <div className="mx-auto w-full max-w-4xl px-3 md:px-6 lg:px-8 py-4 md:py-6 space-y-4">
        {canContinueToApp ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Grupo ativo: {activeGroup?.name ?? "—"}
              </CardTitle>
              <CardDescription>
                Você já está em um grupo.
                {changeMode
                  ? " Você está no modo de troca de grupo: solicite entrada em outro grupo e aguarde aprovação."
                  : " Para trocar de grupo, vá em Configurações → Grupo."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Button variant="outline" disabled={loadingGroups} onClick={() => void loadGroups()}>
                {loadingGroups ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Atualizando...
                  </span>
                ) : (
                  "Atualizar lista"
                )}
              </Button>
              <Button onClick={() => navigate("/")}>Ir para o app</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Escolha um grupo para continuar</CardTitle>
              <CardDescription>
                Para usar o app, você precisa criar um grupo gestor ou solicitar entrada em um existente.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="criar">Criar grupo</TabsTrigger>
            <TabsTrigger value="entrar">Participar</TabsTrigger>
          </TabsList>

          <TabsContent value="criar">
            <Card>
              <CardHeader>
                <CardTitle>Criar grupo</CardTitle>
                <CardDescription>O criador vira admin automaticamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do grupo</Label>
                  <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Senha do grupo</Label>
                  <PasswordInput value={groupPassword} onChange={(e) => setGroupPassword(e.target.value)} />
                </div>
                <Button disabled={creating} onClick={handleCreateGroup}>
                  {creating ? "Criando..." : "Criar grupo"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="entrar">
            <Card>
              <CardHeader>
                <CardTitle>Participar de um grupo</CardTitle>
                <CardDescription>Selecione um grupo, digite a senha e aguarde aprovação do admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {loadingGroups ? "Carregando grupos..." : `${groups.length} grupo(s) encontrado(s)`}
                  </p>
                  <Button size="sm" variant="outline" disabled={loadingGroups} onClick={() => void loadGroups()}>
                    {loadingGroups ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Atualizando...
                      </span>
                    ) : (
                      "Atualizar lista"
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    disabled={loadingGroups || groups.length === 0}
                  >
                    <option value="">Selecione...</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  {!loadingGroups && groups.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum grupo disponível no momento. Clique em “Atualizar lista” ou peça ao admin para criar um
                      grupo.
                    </p>
                  )}
                  {selectedGroup?.description && (
                    <p className="text-xs text-muted-foreground">{selectedGroup.description}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Senha do grupo</Label>
                  <PasswordInput value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} />
                </div>
                <Button variant="outline" disabled={joining} onClick={handleRequestJoin}>
                  {joining ? "Enviando..." : "Solicitar entrada"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {isAdmin && activeGroupId && (
          <Card>
            <CardHeader>
              <CardTitle>Solicitações pendentes</CardTitle>
              <CardDescription>Aprovar ou rejeitar entradas no grupo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingRequests ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
              ) : (
                pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">Usuário: {r.user_id}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decideRequest(r.id, r.user_id, "approve")}>Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => void decideRequest(r.id, r.user_id, "reject")}>Rejeitar</Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
