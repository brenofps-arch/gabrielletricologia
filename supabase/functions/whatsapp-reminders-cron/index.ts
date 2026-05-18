import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WA_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("appointment_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let failed = 0;

  for (const r of due ?? []) {
    try {
      if (!WA_TOKEN || !WA_PHONE_ID) throw new Error("WhatsApp não configurado");
      const res = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: r.patient_phone,
          type: "text",
          text: { body: r.message },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      await supabase
        .from("appointment_reminders")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", r.id);
      sent++;
    } catch (e) {
      failed++;
      await supabase
        .from("appointment_reminders")
        .update({ status: "failed", error: e instanceof Error ? e.message : String(e) })
        .eq("id", r.id);
    }
  }

  return new Response(JSON.stringify({ processed: due?.length ?? 0, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});