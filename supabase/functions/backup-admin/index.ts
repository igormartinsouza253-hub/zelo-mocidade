import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BackupPayload = {
  generatedAt?: string;
  version?: string;
  sourceGroupId?: string | null;
  data: Record<string, unknown>;
};

type GroupScopedTable =
  | "cargos"
  | "membros"
  | "reunioes"
  | "presencas"
  | "notas"
  | "visitas"
  | "eventos";

const GROUP_TABLES: GroupScopedTable[] = [
  "cargos",
  "membros",
  "reunioes",
  "presencas",
  "notas",
  "visitas",
  "eventos",
];

function chunkArray<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeGroupId(rows: any[], groupId: string) {
  return rows.map((r) => ({ ...r, group_id: groupId }));
}

async function getBackupContext(serviceClient: any, callerId: string) {
  const [{ data: isAdmin, error: roleErr }, { data: activeGroupId, error: groupErr }] =
    await Promise.all([
      serviceClient.rpc("has_role", { _user_id: callerId, _role: "admin" }),
      serviceClient.rpc("current_group_id", { _user_id: callerId }),
    ]);

  if (roleErr || groupErr) throw roleErr ?? groupErr;
  if (isAdmin) return { allowed: true as const, isAdmin: true as const, activeGroupId };

  if (!activeGroupId) return { allowed: false as const, isAdmin: false as const, activeGroupId: null };

  const [{ data: isGroupAdmin, error: groupAdminErr }, { data: group, error: groupInfoErr }] =
    await Promise.all([
      serviceClient.rpc("is_group_admin", { _user_id: callerId, _group_id: activeGroupId }),
      serviceClient
        .from("management_groups")
        .select("created_by")
        .eq("id", activeGroupId)
        .maybeSingle(),
    ]);

  if (groupAdminErr || groupInfoErr) throw groupAdminErr ?? groupInfoErr;
  const isCreator = (group as any)?.created_by === callerId;
  const allowed = Boolean(isGroupAdmin) || Boolean(isCreator);
  return { allowed, isAdmin: false as const, activeGroupId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Configuração do backend ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // validate caller
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const caller = userData.user;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const { action, backup } = body as { action?: "export" | "import"; backup?: BackupPayload };

    if (!action) {
      return new Response(JSON.stringify({ error: "action é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = await getBackupContext(serviceClient, caller.id);
    if (!ctx.allowed) {
      return new Response(JSON.stringify({ error: "Operação não permitida" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

     if (action === "export") {
       // Este endpoint exporta SOMENTE "Dados do grupo" do grupo ativo.
       // Segurança: não exporta nada que dependa de auth.users (ex: dashboards, audit_logs, profiles, user_roles etc.),
       // pois o backup pode ser importado em outro projeto/ambiente.

       if (!ctx.activeGroupId) {
         return new Response(
           JSON.stringify({ error: "Nenhum grupo ativo selecionado para exportar" }),
           {
             status: 400,
             headers: { ...corsHeaders, "Content-Type": "application/json" },
           },
         );
       }

       const activeGroupId = String(ctx.activeGroupId);
       const [cargosRes, membrosRes, reunioesRes, presencasRes, notasRes, visitasRes, eventosRes] =
         await Promise.all([
           serviceClient.from("cargos").select("*").eq("group_id", activeGroupId),
           serviceClient.from("membros").select("*").eq("group_id", activeGroupId),
           serviceClient.from("reunioes").select("*").eq("group_id", activeGroupId),
           serviceClient.from("presencas").select("*").eq("group_id", activeGroupId),
           serviceClient.from("notas").select("*").eq("group_id", activeGroupId),
           serviceClient.from("visitas").select("*").eq("group_id", activeGroupId),
           serviceClient.from("eventos").select("*").eq("group_id", activeGroupId),
         ]);

       const anyError =
         cargosRes.error ||
         membrosRes.error ||
         reunioesRes.error ||
         presencasRes.error ||
         notasRes.error ||
         visitasRes.error ||
         eventosRes.error;

       if (anyError) {
         console.error("Backup export error:", anyError);
         return new Response(JSON.stringify({ error: "Erro ao gerar backup" }), {
           status: 500,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         });
       }

       const payload: BackupPayload = {
         generatedAt: new Date().toISOString(),
         version: "2.0",
         sourceGroupId: activeGroupId,
         data: {
           cargos: cargosRes.data ?? [],
           membros: membrosRes.data ?? [],
           reunioes: reunioesRes.data ?? [],
           presencas: presencasRes.data ?? [],
           notas: notasRes.data ?? [],
           visitas: visitasRes.data ?? [],
           eventos: eventosRes.data ?? [],
         },
       };

       return new Response(JSON.stringify({ backup: payload }), {
         status: 200,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }

    // import
    if (!backup || typeof backup !== "object" || !backup.data) {
      return new Response(JSON.stringify({ error: "backup inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

     if (!ctx.activeGroupId) {
       return new Response(
         JSON.stringify({ error: "Nenhum grupo ativo selecionado para importar" }),
         {
           status: 400,
           headers: { ...corsHeaders, "Content-Type": "application/json" },
         },
       );
     }

     const stage = { name: "start" as string };
     const activeGroupId = String(ctx.activeGroupId);

     const d = backup.data as any;
     // Importamos apenas dados do grupo.
     const cargosDataRaw = Array.isArray(d.cargos) ? d.cargos : [];
     const membrosDataRaw = Array.isArray(d.membros) ? d.membros : [];
     const reunioesDataRaw = Array.isArray(d.reunioes) ? d.reunioes : [];
     const presencasDataRaw = Array.isArray(d.presencas) ? d.presencas : [];
     const notasDataRaw = Array.isArray(d.notas) ? d.notas : [];
     const visitasDataRaw = Array.isArray(d.visitas) ? d.visitas : [];
     const eventosDataRaw = Array.isArray(d.eventos) ? d.eventos : [];

     // Segurança: ignore quaisquer chaves fora do escopo (se existirem no arquivo).
     for (const key of Object.keys(d ?? {})) {
       if (!GROUP_TABLES.includes(key as GroupScopedTable)) delete d[key];
     }

     // Normaliza para o grupo ativo (destino). Essencial para importar de outro ambiente.
     const cargosData = normalizeGroupId(cargosDataRaw, activeGroupId);
     const membrosData = normalizeGroupId(membrosDataRaw, activeGroupId);
     const reunioesData = normalizeGroupId(reunioesDataRaw, activeGroupId);
     const presencasData = normalizeGroupId(presencasDataRaw, activeGroupId);
     const notasData = normalizeGroupId(notasDataRaw, activeGroupId);
     const visitasData = normalizeGroupId(visitasDataRaw, activeGroupId);
     const eventosData = normalizeGroupId(eventosDataRaw, activeGroupId);

     const deleteByGroup = async (table: GroupScopedTable) => {
       stage.name = `delete_${table}`;
       const { error } = await serviceClient.from(table).delete().eq("group_id", activeGroupId);
       if (error) throw error;
     };

     const upsertBatched = async (
       table: GroupScopedTable,
       rows: any[],
       opts?: { onConflict?: string },
     ) => {
       if (!rows.length) return;
       stage.name = `upsert_${table}`;
       const batches = chunkArray(rows, 500);
       for (const batch of batches) {
         const { error } = await serviceClient
           .from(table)
           .upsert(batch, { onConflict: opts?.onConflict ?? "id" });
         if (error) throw error;
       }
     };

     // Modo: Substituir -> limpa dados do grupo ativo e então restaura
     // Ordem de DELETE (filhos -> pais) para evitar FK
     await deleteByGroup("presencas");
     await deleteByGroup("notas");
     await deleteByGroup("eventos");
     await deleteByGroup("visitas");
     await deleteByGroup("reunioes");
     await deleteByGroup("membros");
     await deleteByGroup("cargos");

     // Ordem de INSERT/UPSERT (pais -> filhos)
     await upsertBatched("cargos", cargosData);
     await upsertBatched("membros", membrosData);
     await upsertBatched("reunioes", reunioesData);
     await upsertBatched("visitas", visitasData);
     await upsertBatched("eventos", eventosData);
     await upsertBatched("notas", notasData);
     // Defesa extra: presenças tem UNIQUE(reuniao_id, membro_id)
     await upsertBatched("presencas", presencasData, { onConflict: "reuniao_id,membro_id" });

     return new Response(
       JSON.stringify({
         success: true,
         imported: {
           cargos: cargosData.length,
           membros: membrosData.length,
           reunioes: reunioesData.length,
           visitas: visitasData.length,
           eventos: eventosData.length,
           notas: notasData.length,
           presencas: presencasData.length,
         },
       }),
       {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
       },
     );
  } catch (error) {
    console.error("backup-admin error:", error);
     const code = (error as any)?.code;
     const message = (error as any)?.message;
     const hint = (error as any)?.hint;
     return new Response(
       JSON.stringify({
         error: "Erro interno do servidor",
         code: code ?? null,
         message: message ?? null,
         hint: hint ?? null,
       }),
       {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
       },
     );
  }
});
