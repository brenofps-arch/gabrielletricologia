import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WHATSAPP_OWNER_USER_ID = "922d4be3-68dd-4b84-8fca-8db3b442a44c";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ⚠️ MODO TESTE: Íris responde EXCLUSIVAMENTE a este número.
// Quando o WhatsApp Business da clínica estiver liberado, remova/expanda esta lista.
const ALLOWED_PHONE_NUMBERS = ["5521971183737"];

// Comando que a Dra. envia para iniciar uma correção da última resposta da Íris.
const CORRECTION_COMMAND = "#corrigir_resposta_iris";

// Helper para enviar mensagem via WhatsApp e salvar no histórico
async function sendWhatsApp(
  token: string,
  phoneId: string,
  to: string,
  text: string,
  supabase: any,
  conversationId: string,
) {
  const res = await fetch(
    `https://graph.facebook.com/v25.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    message_text: text,
    message_type: "text",
    wa_message_id: data?.messages?.[0]?.id,
    status: res.ok ? "sent" : "failed",
  });
  await supabase
    .from("whatsapp_conversations")
    .update({ last_message: text })
    .eq("id", conversationId);
  return res.ok;
}

const getWhatsappOwnerUserId = () => {
  const configuredOwnerUserId = Deno.env.get("WHATSAPP_OWNER_USER_ID")?.trim();

  if (configuredOwnerUserId && UUID_REGEX.test(configuredOwnerUserId)) {
    return configuredOwnerUserId;
  }

  if (configuredOwnerUserId) {
    console.warn("Invalid WHATSAPP_OWNER_USER_ID; using verified owner user id fallback");
  }

  return DEFAULT_WHATSAPP_OWNER_USER_ID;
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Meta webhook verification (GET request)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // Process incoming messages (POST)
  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // The user_id of the doctor who owns this WhatsApp integration
    const OWNER_USER_ID = getWhatsappOwnerUserId();

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !OWNER_USER_ID) {
      console.error("Missing WhatsApp configuration");
      return new Response(JSON.stringify({ error: "Missing configuration" }), {
        status: 200, // Always return 200 to Meta to avoid retries
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract message data from Meta webhook format
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) {
      // Status update or other non-message event
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const phoneNumber = message.from;
    const contactName = contact?.profile?.name || "Desconhecido";
    const messageText = message.text?.body || "";
    const waMessageId = message.id;

    console.log(`Message from ${contactName} (${phoneNumber}): ${messageText}`);

    // 🔒 Trava de segurança: ignora qualquer número que não seja o autorizado para teste.
    if (!ALLOWED_PHONE_NUMBERS.includes(phoneNumber)) {
      console.log(`Ignored message from unauthorized number: ${phoneNumber}`);
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone_number", phoneNumber)
      .eq("user_id", OWNER_USER_ID)
      .eq("is_active", true)
      .single();

    if (!conversation) {
      const { data: newConv, error: convError } = await supabase
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

      if (convError) {
        console.error("Error creating conversation:", convError);
        throw convError;
      }
      conversation = newConv;
    } else {
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message: messageText, contact_name: contactName })
        .eq("id", conversation.id);
    }

    // Save inbound message
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      message_text: messageText,
      message_type: "text",
      wa_message_id: waMessageId,
      status: "delivered",
    });

    // ============================================================
    // 🎓 FLUXO DE ENSINO DA ÍRIS (apenas número autorizado)
    // Passo 1: Dra. envia "#corrigir_resposta_iris" → marca estado awaiting_correction
    // Passo 2: Próxima mensagem da Dra. vira a "resposta correta" e fica salva
    //          junto com a última pergunta do paciente e a última resposta errada.
    // ============================================================
    const trimmed = messageText.trim();

    if (trimmed.toLowerCase().startsWith(CORRECTION_COMMAND)) {
      // Pega a última troca (pergunta do paciente + resposta da Íris) antes deste comando
      const { data: history } = await supabase
        .from("whatsapp_messages")
        .select("direction, message_text, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const ordered = (history || []).reverse();
      // Última resposta da Íris (antes deste comando)
      const lastOutbound = [...ordered].reverse().find(
        (m) => m.direction === "outbound"
      );
      // Última pergunta do paciente antes daquela resposta
      const lastInbound = [...ordered]
        .reverse()
        .find(
          (m) =>
            m.direction === "inbound" &&
            m.message_text !== messageText &&
            (!lastOutbound || new Date(m.created_at) < new Date(lastOutbound.created_at))
        );

      // Permite enviar a correção na mesma mensagem:
      // "#corrigir_resposta_iris O correto seria dizer..."
      const inlineCorrection = trimmed.slice(CORRECTION_COMMAND.length).trim();

      if (inlineCorrection) {
        await supabase.from("iris_learnings").insert({
          user_id: OWNER_USER_ID,
          patient_message: lastInbound?.message_text || null,
          wrong_response: lastOutbound?.message_text || null,
          correct_response: inlineCorrection,
        });

        const confirm = "✅ Anotado! Vou usar essa resposta como referência a partir de agora.";
        await sendWhatsApp(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, phoneNumber, confirm, supabase, conversation.id);
        return new Response(JSON.stringify({ status: "learned" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sem texto inline → entra em modo "aguardando correção"
      await supabase
        .from("whatsapp_conversations")
        .update({
          conversation_state: "awaiting_correction",
          context_data: {
            ...(conversation.context_data || {}),
            pending_correction: {
              patient_message: lastInbound?.message_text || null,
              wrong_response: lastOutbound?.message_text || null,
            },
          },
        })
        .eq("id", conversation.id);

      const prompt = "📝 Modo correção ativado. Me envie agora qual seria a resposta ideal e eu aprendo na hora.";
      await sendWhatsApp(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, phoneNumber, prompt, supabase, conversation.id);
      return new Response(JSON.stringify({ status: "awaiting_correction" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se a conversa está aguardando a correção, esta mensagem é a resposta ideal
    if (conversation.conversation_state === "awaiting_correction") {
      const pending = (conversation.context_data as any)?.pending_correction || {};
      await supabase.from("iris_learnings").insert({
        user_id: OWNER_USER_ID,
        patient_message: pending.patient_message || null,
        wrong_response: pending.wrong_response || null,
        correct_response: messageText,
      });

      await supabase
        .from("whatsapp_conversations")
        .update({
          conversation_state: "greeting",
          context_data: {},
        })
        .eq("id", conversation.id);

      const confirm = "✅ Aprendi! Da próxima vez que aparecer uma situação parecida vou usar essa resposta como referência. 💡";
      await sendWhatsApp(WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, phoneNumber, confirm, supabase, conversation.id);
      return new Response(JSON.stringify({ status: "learned" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca ensinamentos anteriores da Dra. para injetar no contexto da IA
    const { data: learnings } = await supabase
      .from("iris_learnings")
      .select("patient_message, wrong_response, correct_response")
      .eq("user_id", OWNER_USER_ID)
      .order("created_at", { ascending: false })
      .limit(30);

    // Get conversation history for AI context
    const { data: recentMessages } = await supabase
      .from("whatsapp_messages")
      .select("direction, message_text, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Get available appointment slots (next 7 days)
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: existingAppointments } = await supabase
      .from("appointments")
      .select("appointment_date, appointment_time")
      .eq("user_id", OWNER_USER_ID)
      .gte("appointment_date", today.toISOString().split("T")[0])
      .lte("appointment_date", nextWeek.toISOString().split("T")[0])
      .neq("status", "cancelled");

    // Build AI prompt
    const conversationHistory = (recentMessages || [])
      .map((m) => `${m.direction === "inbound" ? "Paciente" : "Secretária"}: ${m.message_text}`)
      .join("\n");

    const busySlots = (existingAppointments || [])
      .map((a) => `${a.appointment_date} ${a.appointment_time}`)
      .join(", ");

    const learningsBlock = (learnings && learnings.length > 0)
      ? learnings
          .map((l, i) => {
            const parts: string[] = [`#${i + 1}`];
            if (l.patient_message) parts.push(`Paciente disse: "${l.patient_message}"`);
            if (l.wrong_response) parts.push(`Você respondeu (INCORRETO): "${l.wrong_response}"`);
            parts.push(`Resposta CORRETA ensinada pela Dra.: "${l.correct_response}"`);
            return parts.join("\n");
          })
          .join("\n\n")
      : "Nenhuma correção registrada ainda.";

    const systemPrompt = `Você é a Íris, secretária virtual da Dra. Gabrielle Sagrillo Pimassoni, médica tricologista (CRM 18090-ES).
Sua personalidade: profissional mas com leveza, educada e empática. Tom semiformal — acessível mas profissional. Use emojis com moderação (1-2 por mensagem).

NUNCA use a palavra "curar" nem prometa resultados. Responda em português do Brasil.

SOBRE A DRA. GABRIELLE:
- Especialidade: Tricologia médica (medicina capilar)
- Membro da Sociedade Brasileira de Tricologia, Associação Brasileira de Tricologia e Sociedade Brasileira de Medicina e Transplante Capilar
- Abordagem: diagnóstico baseado em evidências, tratamento individualizado, foco na causa real da queixa capilar
- Diferenciais: consulta humanizada, escuta ativa, educação ativa do paciente, abordagem realista e ética
- Atende todas as idades, gestantes, particular (sem convênio)

CONSULTÓRIOS (Instituto Health):
1. Vila Velha — Rua Inácio Higino, 1050 – Shopping Praia da Costa, torre leste, sala 101 (entrada pela rua ou ao lado do cinema)
2. Cariacica — Rua Waldemar Siepiersk, 200 – Villaggio Campo Grande Comercial, loja 44 (térreo, corredor da BR)
3. Vitória — Av. Adalberto Simão Nader, 387, sala 208, Ed. Concorde, Mata da Praia

AGENDA:
- Quarta: manhã 07h-10h (Vila Velha) + tarde 14h-18h (Cariacica, quinzenal)
- Quinta: manhã 08h-13h
- Sexta: tarde 14h-18h (Cariacica)
- NÃO atende segunda, terça, sábado, domingo, feriados
- NÃO permite agendamento para o mesmo dia
- Duração da consulta: 1 hora | Intervalo entre consultas: 5 minutos

VALORES:
- Primeira consulta (avaliação): R$ 350,00
- Retorno: R$ 350,00 (1º retorno gratuito em até 45 dias se não fechar protocolo; se fechar protocolo, só paga a primeira consulta)
- Pagamento: após a consulta. Aceita dinheiro, Pix, débito, crédito (até 6x com juros). Sem desconto à vista. Fornece nota fiscal para reembolso

PROCEDIMENTOS (valores informados somente em consulta, pois dependem da avaliação individual):
- Mesoterapia capilar (40min-1h) — microinjeções no couro cabeludo
- MMP – Microinfusão de Medicamentos na Pele (40min-1h)
- Mesoject Gun — eletroporação sem agulhas, indolor (40min-1h)
- Microlyzer — microfragmentação de tecidos autólogos (1h30)
- PRP – Plasma Rico em Plaquetas (1h30)
- LEDterapia capilar
- Programas de Acompanhamento Capilar (4-6 meses)

CONDIÇÕES TRATADAS: alopecia androgenética (M/F), alopecia areata, eflúvio telógeno, FAPD, dermatite seborreica, quebra capilar, lúpus de couro cabeludo, líquen plano pilar, alopecia frontal fibrosante, foliculite decalvante, celulite dissecante, alopecia central centrífuga, alergias no couro cabeludo.
NÃO ATENDE o que fugir do cuidado com couro cabeludo/fios.

RESPOSTAS PARA PERGUNTAS FREQUENTES:
- "Tem cura?" → Depende da causa. Algumas são reversíveis (eflúvio telógeno), outras crônicas e exigem controle contínuo (androgenética). O diagnóstico correto define o prognóstico.
- "Quanto tempo pro resultado?" → O ciclo capilar é lento. Primeiros sinais em 2-3 meses, resultados consistentes em 4-6 meses. Regularidade faz diferença.
- "Lavar cabelo piora queda?" → Não. Os fios que caem no banho já estavam em fase de queda. Importante usar produtos adequados ao couro cabeludo.
- "Aceita plano?" → Não. A consulta oferece avaliação completa e personalizada por médica especializada com formação atualizada em tricologia.

OBJEÇÃO DE PREÇO: Responda com empatia e foco em valor (não em desconto). Reforce que é avaliação médica completa que evita gastos com produtos ineficazes. Nunca desvalorize o serviço.

PREPARAÇÃO PARA CONSULTA (sempre informar ao agendar):
- Trazer exames de sangue recentes (se tiver)
- Lista de medicamentos em uso
- Não usar tintura no cabelo até 15 dias antes
- Lavar o cabelo 1 dia antes da consulta
- Se possível, vir acompanhado(a) de pessoa que ajuda em grandes decisões

POLÍTICAS:
- Cancelamento: até 24h antes sem custo (exceto casos extremos)
- Reagendamento: até 2 vezes, com 24h de antecedência
- Sem multa por no-show
- Teleconsulta: não oferece (exceto casos extremos)

EMERGÊNCIA (NÃO AGENDAR, orientar ida ao hospital com tom calmo):
- Dor de cabeça intensa, vômitos persistentes, prostração, secreção purulenta do couro cabeludo com febre

REDES: Instagram @dra.gabriellesagrillo | Site: www.gabriellesagrillo.com.br | WhatsApp: (27) 99244-9495

FLUXO DE AGENDAMENTO:
1. Cumprimente, se apresente como Íris e pergunte como pode ajudar
2. Se quer agendar: colete nome completo e queixa principal
3. Verifique se a condição é do escopo (couro cabeludo/fios)
4. Sugira horários disponíveis (informando qual consultório)
5. Informe valor (R$350 primeira consulta) e orientações pré-consulta
6. Confirme o agendamento

ESTADO ATUAL DA CONVERSA: ${conversation.conversation_state}
DADOS COLETADOS: ${JSON.stringify(conversation.context_data)}
HORÁRIOS OCUPADOS (próx. 7 dias): ${busySlots || "Nenhum agendamento ainda"}

📚 APRENDIZADOS DA DRA. GABRIELLE (correções prévias que você DEVE seguir):
${learningsBlock}

REGRA CRÍTICA SOBRE OS APRENDIZADOS: Sempre que uma situação semelhante a um dos exemplos acima aparecer, use a "Resposta CORRETA" como referência principal. Adapte o tom mas mantenha o conteúdo e a postura ensinada pela Dra.

IMPORTANTE: Se o paciente confirmar um agendamento, responda com o JSON de ação no final da mensagem, separado por |||ACTION|||:
{"action":"schedule","patient_name":"Nome","phone":"telefone","complaint":"queixa","date":"YYYY-MM-DD","time":"HH:MM"}

Exemplo de resposta com ação:
Perfeito! ✅ Sua consulta está agendada para dia 15/04 às 10h com a Dra. Gabrielle. Enviaremos um lembrete!|||ACTION|||{"action":"schedule","patient_name":"Maria","phone":"5511999999","complaint":"queda capilar","date":"2026-04-15","time":"10:00"}

Se precisar atualizar o estado da conversa, adicione também:
|||STATE|||{"state":"scheduling","context":{"name":"Maria","complaint":"queda capilar"}}`;

    // Call AI
    let aiResponse = "Olá! 👋 Bem-vinda à Clínica Dra. Gabrielle Sagrillo. Estou com dificuldades técnicas no momento, mas uma de nossas atendentes entrará em contato em breve!";

    if (LOVABLE_API_KEY) {
      try {
        const aiMessages = [
          { role: "system", content: systemPrompt },
          ...((recentMessages || []).map((m) => ({
            role: m.direction === "inbound" ? "user" : "assistant",
            content: m.message_text,
          }))),
        ];

        // Don't duplicate the last user message since it's already in history
        // but if history is empty or last message is not from user, add it
        if (aiMessages.length <= 1 || aiMessages[aiMessages.length - 1].role !== "user") {
          aiMessages.push({ role: "user", content: messageText });
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: aiMessages,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          aiResponse = aiData.choices?.[0]?.message?.content || aiResponse;
        } else {
          console.error("AI error:", aiRes.status, await aiRes.text());
        }
      } catch (aiError) {
        console.error("AI call failed:", aiError);
      }
    }

    // Parse actions from AI response
    let responseText = aiResponse;
    let actionData = null;
    let stateData = null;

    if (aiResponse.includes("|||ACTION|||")) {
      const parts = aiResponse.split("|||ACTION|||");
      responseText = parts[0].trim();
      try {
        const actionPart = parts[1].split("|||STATE|||")[0].trim();
        actionData = JSON.parse(actionPart);
      } catch (e) {
        console.error("Failed to parse action:", e);
      }
    }

    if (aiResponse.includes("|||STATE|||")) {
      const parts = aiResponse.split("|||STATE|||");
      try {
        stateData = JSON.parse(parts[parts.length - 1].trim());
      } catch (e) {
        console.error("Failed to parse state:", e);
      }
    }

    // Execute action if present
    if (actionData?.action === "schedule") {
      const { error: aptError } = await supabase.from("appointments").insert({
        user_id: OWNER_USER_ID,
        patient_name: actionData.patient_name,
        patient_phone: phoneNumber,
        chief_complaint: actionData.complaint,
        appointment_date: actionData.date,
        appointment_time: actionData.time,
        status: "confirmed",
        source: "whatsapp",
      });

      if (aptError) {
        console.error("Error creating appointment:", aptError);
      } else {
        console.log("Appointment created successfully");
      }
    }

    // Update conversation state
    if (stateData) {
      await supabase
        .from("whatsapp_conversations")
        .update({
          conversation_state: stateData.state,
          context_data: stateData.context,
        })
        .eq("id", conversation.id);
    }

    // Send response via WhatsApp
    const sendRes = await fetch(
      `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: responseText },
        }),
      }
    );

    const sendData = await sendRes.json();
    console.log("WhatsApp send response:", JSON.stringify(sendData));

    // Save outbound message
    await supabase.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      message_text: responseText,
      message_type: "text",
      wa_message_id: sendData?.messages?.[0]?.id,
      status: sendRes.ok ? "sent" : "failed",
    });

    // Update last message
    await supabase
      .from("whatsapp_conversations")
      .update({ last_message: responseText })
      .eq("id", conversation.id);

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ status: "error" }), {
      status: 200, // Always 200 for Meta
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
