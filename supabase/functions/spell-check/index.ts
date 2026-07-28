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
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    const AI_API_URL = Deno.env.get("AI_API_URL");
    const AI_MODEL = Deno.env.get("AI_MODEL");
    if (!AI_API_KEY || !AI_API_URL || !AI_MODEL) {
      throw new Error("AI_API_KEY, AI_API_URL e AI_MODEL devem ser configurados");
    }

    const systemPrompt = `Você é um corretor ortográfico multilíngue.
Detecte automaticamente o idioma predominante do texto e faça as correções nesse mesmo idioma, sem traduzir nem alterar nomes próprios.
Retorne APENAS o texto corrigido, mantendo toda a formatação HTML (tags como <p>, <strong>, <em>, <u>, <mark>, <h1>, <h2>, <h3>, <ul>, <ol>, <li> e atributos de estilo).
Corrija somente erros ortográficos e gramaticais claros.
Mantenha a estrutura HTML intacta.
Não adicione explicações, apenas retorne o HTML corrigido.`;

    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Configured AI provider error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar correção ortográfica" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content || text;

    return new Response(
      JSON.stringify({ correctedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Spell check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
