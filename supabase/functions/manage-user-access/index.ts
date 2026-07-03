import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOOTSTRAP_ADMIN_EMAIL = "igor.ccb.mts@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do backend ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Client for validating JWT claims from the caller token
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    const callerEmail = typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : null;

    if (claimsError || !callerId) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const caller = { id: callerId, email: callerEmail };

    // Service role client for privileged DB/admin operations
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const requestBody = await req.json().catch(() => ({}));
    const { email, role, action = "add", user_id, group_id } = requestBody as {
      email?: string;
      role?: "admin" | "user";
      action?: string;
      user_id?: string;
      group_id?: string;
    };
    const isSuperAdminCaller = (caller.email ?? "").toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

    // Self-approve: allow any authenticated user to ensure they have the base 'user' role.
    // This is safe because it does not grant elevated privileges.
    if (action === "bootstrap_user") {
      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert({ user_id: caller.id, role: "user" });

      if (insertError && insertError.code !== "23505") {
        console.error("Error inserting bootstrap user role:", insertError);
        return new Response(
          JSON.stringify({ error: "Erro ao conceder acesso" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bootstrap: allow a pre-approved email to self-promote to admin
    if (action === "bootstrap_admin") {
      if (!isSuperAdminCaller) {
        return new Response(
          JSON.stringify({ error: "Operação não permitida" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: insertError } = await serviceClient
        .from("user_roles")
        .insert({ user_id: caller.id, role: "admin" });

      if (insertError && insertError.code !== "23505") {
        console.error("Error inserting bootstrap admin role:", insertError);
        return new Response(
          JSON.stringify({ error: "Erro ao conceder acesso" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action.startsWith("super_admin_")) {
      if (!isSuperAdminCaller) {
        return new Response(
          JSON.stringify({ error: "Operacao exclusiva do super administrador" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "super_admin_list") {
        const authUsers: any[] = [];
        let page = 1;
        const perPage = 1000;

        while (page <= 10) {
          const { data, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage });
          if (listError) {
            console.error("Erro ao listar auth users:", listError);
            return new Response(
              JSON.stringify({ error: "Erro ao carregar usuarios" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          const currentUsers = data?.users ?? [];
          authUsers.push(...currentUsers);
          if (currentUsers.length < perPage) break;
          page++;
        }

        const userIds = authUsers.map((authUser) => authUser.id).filter(Boolean);
        const emptyResult = { data: [], error: null };
        const [profilesResult, rolesResult, membershipsResult, groupsResult, presenceResult] = await Promise.all([
          userIds.length ? serviceClient.from("profiles").select("id, username, email, avatar_url").in("id", userIds) : Promise.resolve(emptyResult),
          userIds.length ? serviceClient.from("user_roles").select("user_id, role, created_at").in("user_id", userIds) : Promise.resolve(emptyResult),
          userIds.length ? serviceClient.from("group_members").select("id, user_id, group_id, role, created_at").in("user_id", userIds) : Promise.resolve(emptyResult),
          serviceClient.from("management_groups").select("id, name"),
          userIds.length ? serviceClient.from("group_user_presence").select("user_id, updated_at").in("user_id", userIds) : Promise.resolve(emptyResult),
        ]);

        if (profilesResult.error) console.error("Erro ao carregar profiles:", profilesResult.error);
        if (rolesResult.error) console.error("Erro ao carregar roles:", rolesResult.error);
        if (membershipsResult.error) console.error("Erro ao carregar memberships:", membershipsResult.error);
        if (groupsResult.error) console.error("Erro ao carregar grupos:", groupsResult.error);
        if (presenceResult.error) console.error("Erro ao carregar presenca:", presenceResult.error);

        const profileById = Object.fromEntries(((profilesResult.data as any[]) ?? []).map((profile) => [profile.id, profile]));
        const roleById = Object.fromEntries(((rolesResult.data as any[]) ?? []).map((item) => [item.user_id, item]));
        const groupById = Object.fromEntries(((groupsResult.data as any[]) ?? []).map((group) => [group.id, group]));
        const presenceById = Object.fromEntries(((presenceResult.data as any[]) ?? []).map((item) => [item.user_id, item]));
        const membershipsByUser = ((membershipsResult.data as any[]) ?? []).reduce((acc: Record<string, any[]>, membership) => {
          const list = acc[membership.user_id] ?? [];
          list.push({
            id: membership.id,
            group_id: membership.group_id,
            group_name: groupById[membership.group_id]?.name ?? "Grupo",
            role: membership.role,
            created_at: membership.created_at,
          });
          acc[membership.user_id] = list;
          return acc;
        }, {});

        const now = Date.now();
        const users = authUsers.map((authUser) => {
          const profile = profileById[authUser.id] as any | undefined;
          const presence = presenceById[authUser.id] as any | undefined;
          const lastSeen = presence?.updated_at ?? authUser.last_sign_in_at ?? null;
          return {
            id: authUser.id,
            email: authUser.email ?? profile?.email ?? null,
            username: profile?.username ?? authUser.user_metadata?.name ?? authUser.user_metadata?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture ?? null,
            role: roleById[authUser.id]?.role ?? "user",
            created_at: authUser.created_at,
            last_seen_at: lastSeen,
            online: lastSeen ? now - new Date(lastSeen).getTime() < 2 * 60 * 1000 : false,
            groups: membershipsByUser[authUser.id] ?? [],
          };
        });

        return new Response(JSON.stringify({ users }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "super_admin_remove_from_group") {
        if (!user_id || !group_id) {
          return new Response(JSON.stringify({ error: "user_id e group_id sao obrigatorios" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: removeError } = await serviceClient.from("group_members").delete().eq("user_id", user_id).eq("group_id", group_id);
        if (removeError) {
          console.error("Erro ao remover usuario do grupo:", removeError);
          return new Response(JSON.stringify({ error: "Erro ao remover usuario do grupo" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "super_admin_delete_user") {
        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id e obrigatorio" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (user_id === caller.id) {
          return new Response(JSON.stringify({ error: "Voce nao pode excluir a propria conta" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await serviceClient.from("group_members").delete().eq("user_id", user_id);
        await serviceClient.from("user_roles").delete().eq("user_id", user_id);
        const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(user_id);
        if (deleteAuthError) {
          console.error("Erro ao excluir auth user:", deleteAuthError);
          return new Response(JSON.stringify({ error: "Erro ao excluir usuario" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Acao de super admin invalida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // From here on, require caller to be:
    // - global admin OR
    // - admin/creator of their active group
    const [{ data: isAdmin, error: roleErr }, { data: activeGroupId, error: activeGroupErr }] =
      await Promise.all([
        serviceClient.rpc("has_role", {
          _user_id: caller.id,
          _role: "admin",
        }),
        serviceClient.rpc("current_group_id", { _user_id: caller.id }),
      ]);

    if (roleErr || activeGroupErr) {
      console.error("Error checking permissions:", roleErr ?? activeGroupErr);
      return new Response(
        JSON.stringify({ error: "Erro ao validar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let allowed = Boolean(isAdmin);

    if (!allowed && activeGroupId) {
      const [{ data: isGroupAdmin, error: groupAdminErr }, { data: group, error: groupErr }] =
        await Promise.all([
          serviceClient.rpc("is_group_admin", {
            _user_id: caller.id,
            _group_id: activeGroupId,
          }),
          serviceClient
            .from("management_groups")
            .select("created_by")
            .eq("id", activeGroupId)
            .maybeSingle(),
        ]);

      if (groupAdminErr || groupErr) {
        console.error("Error checking group permissions:", groupAdminErr ?? groupErr);
        return new Response(
          JSON.stringify({ error: "Erro ao validar permissões do grupo" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const isCreator = (group as any)?.created_by === caller.id;
      allowed = Boolean(isGroupAdmin) || Boolean(isCreator);
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Operação não permitida" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // List users with roles
    if (action === "list") {
      const { data: userRoles, error: rolesError } = await serviceClient
        .from("user_roles")
        .select("user_id, role, created_at");

      if (rolesError) {
        console.error("Error fetching user roles:", rolesError);
        return new Response(
          JSON.stringify({ users: [], warning: "Não foi possível carregar os usuários agora." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const userIds = (userRoles || []).map((ur) => ur.user_id);

      const { data: profiles, error: profilesError } = await serviceClient
        .from("profiles")
        .select("id, username, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      const profileById = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      const users = (userRoles || []).map((ur) => {
        const profile = profileById[ur.user_id] as any | undefined;
        return {
          id: ur.user_id,
          email: profile?.email ?? null,
          username: profile?.username ?? null,
          role: ur.role,
          created_at: ur.created_at,
        };
      });

      return new Response(
        JSON.stringify({ users }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Change role
    if (action === "change_role") {
      if (!user_id || !role) {
        return new Response(
          JSON.stringify({ error: "user_id e role são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: updateError } = await serviceClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating user role:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro ao atualizar papel do usuário" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Revoke access (remove roles)
    if (action === "revoke") {
      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: deleteError } = await serviceClient
        .from("user_roles")
        .delete()
        .eq("user_id", user_id);

      if (deleteError) {
        console.error("Error revoking user access:", deleteError);
        return new Response(
          JSON.stringify({ error: "Erro ao revogar acesso" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Add user by email
    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email e role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let foundUser: any = null;
    let page = 1;
    const perPage = 1000;

    while (!foundUser && page <= 10) {
      const { data, error: listError } = await serviceClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        console.error("Erro ao listar usuários:", listError);
        return new Response(
          JSON.stringify({ error: "Erro ao buscar usuário" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const users = data?.users ?? [];
      foundUser = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase()) ?? null;

      if (!foundUser && users.length < perPage) break;
      page++;
    }

    if (!foundUser) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado. Ele precisa criar uma conta primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: insertError } = await serviceClient
      .from("user_roles")
      .insert({ user_id: foundUser.id, role });

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Este usuário já tem acesso" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("Erro ao inserir role:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao conceder acesso" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: foundUser.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
