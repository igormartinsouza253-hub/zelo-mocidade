import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, context, history } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(
        JSON.stringify({ error: "Pergunta é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt =
      "Você é uma assistente virtual de um painel de gestão de reuniões de jovens em português brasileiro. " +
      "Responda de forma clara, objetiva e amigável, usando Markdown simples (negrito **texto**, itálico *texto*, listas quando fizer sentido). " +
      "Você recebe um contexto JSON estruturado com: resumo geral (totais), listas de membros, reuniões, notas e presenças recentes. " +
      "Use ESSE contexto para responder perguntas sobre reuniões (datas, temas, visitas, observações, recitativos), membros (nomes, faixas etárias, telefones, cargos, observações), " +
      "notas (conteúdo, vínculo com membros e reuniões) e presenças (quem participou de qual reunião). " +
      "Você também recebe um histórico de conversa com o usuário; utilize esse histórico para manter o contexto, lembrar preferências e parecer que está aprendendo ao longo do tempo, " +
      "mas nunca prometa guardar informações além desta sessão. " +
      "O aplicativo possui menus principais como: Página inicial (dashboard), Membros, Reuniões, Notas, Estatísticas, Aniversariantes, Configurações. " +
      "Explique sempre que necessário em qual tela o usuário deve entrar para executar ações (por exemplo: para adicionar um membro, use a tela de novo membro; para alterar configurações, vá em Configurações). " +
      "Se não encontrar a informação exata no contexto, explique ao usuário que está respondendo com base apenas nos dados mais recentes enviados pelo sistema.";

    const userContent =
      `Pergunta do usuário: ${question}\n\n` +
      `Contexto estruturado (JSON, pode estar resumido):\n` +
      `${JSON.stringify(context ?? {}, null, 2)}\n\n` +
      `Histórico recente da conversa (lista de mensagens, do mais antigo para o mais novo):\n` +
      `${JSON.stringify(history ?? [], null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições de IA excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos na área de configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const errorText = await response.text();
      console.error("AI assistant error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar resposta da assistente de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Não foi possível gerar uma resposta no momento.";

    return new Response(
      JSON.stringify({ answer }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("AI assistant function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
