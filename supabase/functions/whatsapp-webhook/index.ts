// Webhook da Evolution API -> Íris (Gemini) -> Evolution API.
// Camada de transporte apenas: toda a inteligência vive em _shared/services.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createEvolutionService } from "../_shared/services/evolutionService.ts";
import { createIrisService } from "../_shared/services/irisService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WHATSAPP_OWNER_USER_ID = "922d4be3-68dd-4b84-8fca-8db3b442a44c";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PHONE_NUMBERS = ["5521971183737", "5527997244164", "5527997626808"];
const ADMIN_PHONE_NUMBERS = ["5521971183737", "5527997244164", "5527997626808"];

const CORRECTION_COMMAND = "#corrigir_resposta_iris";
const CANCEL_COMMAND = "#cancelar";

const getWhatsappOwnerUserId = () => {
  const configured = Deno.env.get("WHATSAPP_OWNER_USER_ID")?.trim();
  if (configured && UUID_REGEX.test(configured)) return configured;
  if (configured) console.warn("WHATSAPP_OWNER_USER_ID inválido; usando fallback");
  return DEFAULT_WHATSAPP_OWNER_USER_ID;
};

const ok = (payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Webhook recebido:", JSON.stringify(body).slice(0, 1000));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evolution = createEvolutionService();
    const OWNER_USER_ID = getWhatsappOwnerUserId();

    if (!evolution.isConfigured()) {
      console.error("Evolution API não configurada");
      return ok({ status: "missing_configuration" });
    }

    const incoming = evolution.parseWebhookEvent(body);
    if (!incoming) return ok({ status: "ignored", event: body?.event ?? null });

    const { phoneNumber, contactName, text: messageText, waMessageId } = incoming;
    console.log(`Mensagem de ${contactName} (${phoneNumber}): ${messageText}`);

    if (!ALLOWED_PHONE_NUMBERS.includes(phoneNumber)) {
      console.log("Número não autorizado:", phoneNumber);
      return ok({ status: "ignored_unauthorized" });
    }

    // ── Conversa ────────────────────────────────────────────────────────
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("user_id", OWNER_USER_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (!conversation) {
      const { data: newConv, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          user_id: OWNER_USER_ID,
          phone_number: phoneNumber,
          contact_name: contactName,
          last_message: messageText,
          conversation_state: "greeting",
          context_data: {},
        })
        .select()
        .single();
      if (error) throw error;
      conversation = newConv;
    } else {
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message: messageText, contact_name: contactName })
        .eq("id", conversation.id);
    }

    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      message_text: messageText,
      message_type: "text",
      wa_message_id: waMessageId,
      status: "delivered",
    });

    const reply = async (text: string) => {
      const res = await evolution.sendText(phoneNumber, text);
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        message_text: text,
        message_type: "text",
        wa_message_id: res.messageId,
        status: res.ok ? "sent" : "failed",
      });
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message: text })
        .eq("id", conversation.id);
      return res.ok;
    };

    // ── 🎓 Fluxo de ensino da Íris ──────────────────────────────────────
    const trimmed = messageText.trim();

    if (trimmed.toLowerCase().startsWith(CORRECTION_COMMAND)) {
      const { data: history } = await supabase
        .from("whatsapp_messages")
        .select("direction, message_text, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const ordered = (history ?? []).reverse();
      const lastOutbound = [...ordered].reverse().find((m: any) => m.direction === "outbound");
      const lastInbound = [...ordered].reverse().find(
        (m: any) =>
          m.direction === "inbound" &&
          m.message_text !== messageText &&
          (!lastOutbound || new Date(m.created_at) < new Date(lastOutbound.created_at)),
      );

      const inlineCorrection = trimmed.slice(CORRECTION_COMMAND.length).trim();

      if (inlineCorrection) {
        await supabase.from("iris_learnings").insert({
          user_id: OWNER_USER_ID,
          patient_message: lastInbound?.message_text ?? null,
          wrong_response: lastOutbound?.message_text ?? null,
          correct_response: inlineCorrection,
        });
        await reply("✅ Anotado! Vou usar essa resposta como referência a partir de agora.");
        return ok({ status: "learned" });
      }

      await supabase
        .from("whatsapp_conversations")
        .update({
          conversation_state: "awaiting_correction",
          context_data: {
            ...(conversation.context_data ?? {}),
            pending_correction: {
              patient_message: lastInbound?.message_text ?? null,
              wrong_response: lastOutbound?.message_text ?? null,
            },
          },
        })
        .eq("id", conversation.id);

      await reply("📝 Modo correção ativado. Me envie agora qual seria a resposta ideal e eu aprendo na hora.");
      return ok({ status: "awaiting_correction" });
    }

    if (conversation.conversation_state === "awaiting_correction") {
      if (!ADMIN_PHONE_NUMBERS.includes(phoneNumber)) {
        await supabase
          .from("whatsapp_conversations")
          .update({ conversation_state: "greeting", context_data: {} })
          .eq("id", conversation.id);
        conversation.conversation_state = "greeting";
      } else if (trimmed.toLowerCase() === CANCEL_COMMAND) {
        await supabase
          .from("whatsapp_conversations")
          .update({ conversation_state: "greeting", context_data: {} })
          .eq("id", conversation.id);
        await reply("❌ Modo correção cancelado. Voltando ao modo normal!");
        return ok({ status: "cancelled" });
      } else {
        const pending = (conversation.context_data as any)?.pending_correction ?? {};
        await supabase.from("iris_learnings").insert({
          user_id: OWNER_USER_ID,
          patient_message: pending.patient_message ?? null,
          wrong_response: pending.wrong_response ?? null,
          correct_response: messageText,
        });
        await supabase
          .from("whatsapp_conversations")
          .update({ conversation_state: "greeting", context_data: {} })
          .eq("id", conversation.id);
        await reply("✅ Aprendi! Da próxima vez que aparecer uma situação parecida vou usar essa resposta como referência. 💡");
        return ok({ status: "learned" });
      }
    }

    // ── Íris (Gemini + function calling) ────────────────────────────────
    const iris = createIrisService(supabase, OWNER_USER_ID);
    const result = await iris.handleMessage({
      conversationId: conversation.id,
      phone: phoneNumber,
      text: messageText,
      conversationState: conversation.conversation_state,
      contextData: conversation.context_data,
    });

    await reply(result.text);

    return ok({ status: "ok", tools: result.toolCalls.map((t) => t.name) });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return ok({ status: "error" });
  }
});
