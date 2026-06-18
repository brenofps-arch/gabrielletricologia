import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, conversation_id } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Evolution API config ──────────────────────────────────────────
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");       // ex: https://seu-projeto.up.railway.app
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");       // API key definida no Railway
    const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE_NAME"); // nome da instância criada (ex: "iris")

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante que o número está no formato correto (só dígitos)
    const cleanPhone = phone.replace(/\D/g, "");

    // Envia mensagem via Evolution API
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "apikey": EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        }),
      }
    );

    const data = await res.json().catch(() => ({}));
    console.log("Evolution send response:", JSON.stringify(data));

    // Salva mensagem no Supabase se conversation_id fornecido
    if (conversation_id) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      await supabase.from("whatsapp_messages").insert({
        conversation_id,
        direction: "outbound",
        message_text: message,
        message_type: "text",
        wa_message_id: data?.key?.id || null,
        status: res.ok ? "sent" : "failed",
      });

      await supabase
        .from("whatsapp_conversations")
        .update({ last_message: message })
        .eq("id", conversation_id);
    }

    return new Response(JSON.stringify({ success: res.ok, data }), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Send error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
