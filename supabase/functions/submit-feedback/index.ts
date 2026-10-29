import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sessão necessária." }, 401);
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Sessão inválida." }, 401);
    const body = await request.json();
    const category = ["idea", "bug", "other"].includes(body.category) ? body.category : null;
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 4000) : "";
    const steps = typeof body.steps === "string" ? body.steps.trim().slice(0, 2000) : null;
    if (!category || title.length < 4 || description.length < 12) return json({ error: "Confira o tipo, título e descrição do feedback." }, 400);

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: feedback, error: insertError } = await adminClient.from("user_feedback").insert({
      user_id: user.id, group_id: typeof body.group_id === "string" ? body.group_id : null,
      category, title, description, reproduction_steps: steps || null,
    }).select("id, created_at").single();
    if (insertError) throw insertError;

    const { data: admins, error: adminsError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (adminsError) throw adminsError;
    const superAdmins = (admins.users ?? []).filter((admin) => admin.app_metadata?.super_admin === true);
    const categoryLabel = category === "bug" ? "Bug ou erro" : category === "idea" ? "Ideia ou sugestão" : "Outro";
    for (const admin of superAdmins) {
      await adminClient.from("notifications").insert({
        user_id: admin.id, type: "user_feedback", title: "Novo feedback recebido",
        message: `${categoryLabel}: ${title}`, entity_type: "user_feedback", entity_id: feedback.id,
        metadata: { feedback_id: feedback.id }, dedupe_key: `feedback:${feedback.id}`,
      });
    }

    let emailSent = false;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const feedbackEmail = Deno.env.get("FEEDBACK_EMAIL");
    const fromEmail = Deno.env.get("FEEDBACK_FROM_EMAIL");
    if (resendKey && feedbackEmail && fromEmail) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [feedbackEmail], subject: `[Zelo] ${categoryLabel}: ${title}`,
          text: `Feedback de ${user.user_metadata?.username ?? user.email ?? user.id}\nGrupo: ${body.group_id ?? "Não informado"}\n\n${description}${steps ? `\n\nComo reproduzir:\n${steps}` : ""}\n\nID: ${feedback.id}` }),
      });
      emailSent = response.ok;
      if (!response.ok) console.error("Resend delivery failed", response.status, await response.text());
    } else {
      console.warn("Feedback saved; set RESEND_API_KEY, FEEDBACK_EMAIL and FEEDBACK_FROM_EMAIL to enable email delivery.");
    }
    return json({ id: feedback.id, email_sent: emailSent });
  } catch (error) {
    console.error("submit-feedback", error);
    return json({ error: "Não foi possível processar o feedback agora. Tente novamente." }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
