// Orquestração da Íris: monta contexto, ferramentas e obtém a resposta final.
import { buildIrisSystemPrompt } from "../prompts/irisSystemPrompt.ts";
import { createGeminiService, GeminiContent, GeminiTool } from "./geminiService.ts";
import { createCalendarService } from "./calendarService.ts";

export function createIrisService(supabase: any, ownerUserId: string) {
  const gemini = createGeminiService();
  const calendar = createCalendarService(supabase, ownerUserId);

  function buildTools(conversationId: string, phone: string): GeminiTool[] {
    return [
      {
        name: "listar_horarios_disponiveis",
        description:
          "Lista as datas e horários livres da Dra. Gabrielle para um consultório. Use sempre antes de oferecer horários.",
        parameters: {
          type: "object",
          properties: {
            local: {
              type: "string",
              description: "Consultório escolhido pelo paciente: 'Vila Velha' ou 'Vitória'",
            },
          },
          required: ["local"],
        },
        execute: (args: any) => calendar.listAvailability(String(args?.local ?? "")),
      },
      {
        name: "agendar_consulta",
        description:
          "Agenda a consulta depois que o paciente confirmou nome completo, queixa, local, data e horário.",
        parameters: {
          type: "object",
          properties: {
            patient_name: { type: "string", description: "Nome completo do paciente" },
            complaint: { type: "string", description: "Queixa principal" },
            date: { type: "string", description: "Data no formato YYYY-MM-DD" },
            time: { type: "string", description: "Horário no formato HH:MM" },
            local: { type: "string", description: "'Vila Velha' ou 'Vitória'" },
          },
          required: ["patient_name", "date", "time"],
        },
        execute: (args: any) =>
          calendar.scheduleAppointment({
            patient_name: String(args?.patient_name ?? ""),
            phone,
            complaint: args?.complaint,
            date: String(args?.date ?? ""),
            time: String(args?.time ?? ""),
            local: args?.local,
          }),
      },
      {
        name: "cancelar_consulta",
        description: "Cancela a consulta do paciente atual. Informe a data se ele tiver mais de uma.",
        parameters: {
          type: "object",
          properties: { date: { type: "string", description: "Data YYYY-MM-DD (opcional)" } },
        },
        execute: (args: any) => calendar.cancelAppointment(phone, args?.date),
      },
      {
        name: "buscar_dados_paciente",
        description: "Busca o cadastro e as últimas consultas do paciente pelo telefone atual.",
        parameters: { type: "object", properties: {} },
        execute: () => calendar.findPatient(phone),
      },
      {
        name: "atualizar_estado_conversa",
        description:
          "Salva o estágio da conversa e os dados já coletados (nome, queixa, local, data preferida).",
        parameters: {
          type: "object",
          properties: {
            state: {
              type: "string",
              description: "greeting, collecting_info, scheduling, scheduled ou finished",
            },
            context: { type: "object", description: "Dados coletados até agora" },
          },
          required: ["state"],
        },
        execute: async (args: any) => {
          const { error } = await supabase
            .from("whatsapp_conversations")
            .update({
              conversation_state: String(args?.state ?? "greeting"),
              context_data: args?.context ?? {},
            })
            .eq("id", conversationId);
          return error ? { ok: false, error: error.message } : { ok: true };
        },
      },
    ];
  }

  async function loadHistory(conversationId: string): Promise<GeminiContent[]> {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("direction, message_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);

    const ordered = (data ?? []).reverse().filter((m: any) => m.message_text);
    const history: GeminiContent[] = ordered.map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "model",
      parts: [{ text: m.message_text }],
    }));
    // remove a mensagem atual do fim (já enviada separadamente)
    while (history.length && history[history.length - 1].role === "user") history.pop();
    // Gemini exige que o histórico comece com 'user'
    while (history.length && history[0].role !== "user") history.shift();
    return history;
  }

  async function loadLearnings() {
    const { data } = await supabase
      .from("iris_learnings")
      .select("patient_message, wrong_response, correct_response")
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!data || data.length === 0) return "Nenhuma correção registrada ainda.";
    return data
      .map((l: any, i: number) => {
        const parts = [`#${i + 1}`];
        if (l.patient_message) parts.push(`Paciente disse: "${l.patient_message}"`);
        if (l.wrong_response) parts.push(`Você respondeu (INCORRETO): "${l.wrong_response}"`);
        parts.push(`Resposta CORRETA ensinada pela Dra.: "${l.correct_response}"`);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  async function handleMessage(input: {
    conversationId: string;
    phone: string;
    text: string;
    conversationState: string;
    contextData: unknown;
  }) {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [history, learningsBlock, busy] = await Promise.all([
      loadHistory(input.conversationId),
      loadLearnings(),
      calendar.busySlots(
        today.toISOString().split("T")[0],
        nextWeek.toISOString().split("T")[0],
      ),
    ]);

    const systemPrompt = buildIrisSystemPrompt({
      conversationState: input.conversationState,
      contextData: input.contextData,
      busySlots: busy.join(", "),
      learningsBlock,
      todayIso: today.toISOString().split("T")[0],
    });

    try {
      const result = await gemini.generateReply({
        systemPrompt,
        history,
        userMessage: input.text,
        tools: buildTools(input.conversationId, input.phone),
      });

      if (result.error) console.error("Gemini indisponível:", result.error);
      if (result.toolCalls.length) {
        console.log("Ferramentas executadas:", JSON.stringify(result.toolCalls));
      }

      return {
        text: result.text?.trim() ||
          "Desculpe, não consegui responder agora. Pode repetir, por favor?",
        toolCalls: result.toolCalls,
      };
    } catch (e) {
      console.error("Falha ao gerar resposta da Íris:", e);
      return {
        text:
          "Olá! 👋 Aqui é a Íris, da Dra. Gabrielle Sagrillo. Estou com uma instabilidade técnica no momento — em instantes retornamos seu contato!",
        toolCalls: [],
      };
    }
  }

  return { handleMessage };
}
