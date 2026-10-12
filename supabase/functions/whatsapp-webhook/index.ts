// Webhook da Evolution API -> Íris (assistente INTERNA da equipe).
// A Íris não responde pacientes: só números autorizados da equipe, em conversa
// direta ou no grupo configurado em IRIS_ADMIN_GROUP_JID.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createEvolutionService } from "../_shared/services/evolutionService.ts";
import { createAdminAssistant } from "../_shared/services/adminAssistantService.ts";
import { isPendingFresh, parseConfirmation, PendingAction, toWhatsAppFormat } from "../_shared/services/adminLogic.ts";
import { ADMIN_PHONE_NUMBERS, getAdminGroupJid, getOwnerUserId } from "../_shared/config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const evolution = createEvolutionService();
    const OWNER_USER_ID = getOwnerUserId();
    const ADMIN_GROUP = getAdminGroupJid();

    if (!evolution.isConfigured()) {
      console.error("Evolution API não configurada");
      return ok({ status: "missing_configuration" });
    }

    const incoming = evolution.parseWebhookEvent(body);
    if (!incoming) return ok({ status: "ignored", event: body?.event ?? null });

    const { senderPhone, chatId, isGroup, contactName, text: messageText, waMessageId } = incoming;

    // ── Autorização: nada de paciente. Só a equipe. ─────────────────────
    if (!ADMIN_PHONE_NUMBERS.includes(senderPhone)) {
      return ok({ status: "ignored_unauthorized" });
    }
    if (isGroup && chatId !== ADMIN_GROUP) {
      return ok({ status: "ignored_group" });
    }

    // ── Conversa (uma por telefone ou por grupo) ────────────────────────
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone_number", chatId)
      .eq("user_id", OWNER_USER_ID)
      .eq("is_active", true)
      .maybeSingle();

    if (!conversation) {
      const { data: created, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          user_id: OWNER_USER_ID,
          phone_number: chatId,
          contact_name: isGroup ? "Grupo da equipe" : contactName,
          last_message: messageText,
          conversation_state: "admin",
          context_data: {},
        })
        .select()
        .single();
      if (error) throw error;
      conversation = created;
    } else {
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message: messageText })
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

    const setContext = async (context: Record<string, unknown>) => {
      conversation.context_data = context;
      await supabase.from("whatsapp_conversations").update({ context_data: context }).eq("id", conversation.id);
    };

    const reply = async (rawText: string) => {
      const text = toWhatsAppFormat(rawText);
      const res = await evolution.sendText(chatId, text);
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        direction: "outbound",
        message_text: text,
        message_type: "text",
        wa_message_id: res.messageId,
        status: res.ok ? "sent" : "failed",
      });
      await supabase.from("whatsapp_conversations").update({ last_message: text }).eq("id", conversation.id);
      return res.ok;
    };

    const assistant = createAdminAssistant(supabase, OWNER_USER_ID);
    const context = (conversation.context_data ?? {}) as Record<string, any>;
    const pending: PendingAction | null = isPendingFresh(context.pending_action) ? context.pending_action : null;

    // ── Há uma ação aguardando "ok"? Decide sem passar pelo modelo ──────
    if (pending) {
      const answer = parseConfirmation(messageText);
      if (answer === "yes") {
        await setContext({ ...context, pending_action: null });
        await reply(await assistant.executePending(pending));
        return ok({ status: "executed", action: pending.type });
      }
      if (answer === "no") {
        await setContext({ ...context, pending_action: null });
        await reply("Ok, não fiz nada. 👍");
        return ok({ status: "discarded" });
      }
    } else if (context.pending_action) {
      // expirou: limpa
      await setContext({ ...context, pending_action: null });
    }

    // ── Conversa livre com a Íris (somente prepara ações) ───────────────
    const result = await assistant.handleMessage({
      conversationId: conversation.id,
      text: messageText,
      senderName: contactName,
      hasPending: !!pending,
    });

    if (result.pending) {
      await setContext({ ...context, pending_action: result.pending });
      const header = result.text ? `${result.text}\n\n` : "";
      await reply(
        `${header}📝 *Vou fazer isto:*\n${result.pending.summary}\n\nResponda *ok* para confirmar ou *não* para descartar.`,
      );
      return ok({ status: "awaiting_confirmation", action: result.pending.type });
    }

    await reply(result.text);
    return ok({ status: "ok" });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return ok({ status: "error" });
  }
});
