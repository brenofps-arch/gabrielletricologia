// Assistente interno da equipe: consultas livres, mas toda gravação passa por
// uma ação "pendente" que só é executada depois do "ok" da equipe.
import { buildAdminSystemPrompt } from "../prompts/adminPrompt.ts";
import { createGeminiService, GeminiContent, GeminiTool } from "./geminiService.ts";
import { createGoogleCalendarService } from "./googleCalendarService.ts";
import {
  addMinutesBrt,
  brtDateTime,
  formatDateBr,
  matchByName,
  normalizeCpf,
  normalizeLocations,
  normalizePhone,
  normalizeReferral,
  normalizeText,
  parseBirthDate,
  PendingAction,
  REFERRAL_LABELS,
  toBrt,
  weekdayLabel,
} from "./adminLogic.ts";

const EVENT_TYPES: Record<string, string> = {
  consulta: "Consulta",
  retorno: "Retorno",
  procedimento: "Procedimento",
};

const PAYMENT_METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência bancária", "Outro"];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function createAdminAssistant(supabase: any, ownerUserId: string) {
  const gemini = createGeminiService();
  const gcal = createGoogleCalendarService(supabase, ownerUserId);

  async function loadPatients() {
    const { data } = await supabase
      .from("patients")
      .select("id, name, phone, cpf, clinic_location")
      .eq("user_id", ownerUserId);
    return data ?? [];
  }

  async function dayEvents(date: string) {
    return await gcal.listEvents(brtDateTime(date, "00:00"), brtDateTime(date, "23:59"));
  }

  function describeEvent(e: { summary: string; start: string; end: string }) {
    const s = toBrt(e.start);
    const en = toBrt(e.end);
    return { data: s.date, dia: weekdayLabel(s.date), inicio: s.time, fim: en.time, titulo: e.summary };
  }

  // ── Execução das ações já confirmadas ───────────────────────────────
  async function executePending(p: PendingAction): Promise<string> {
    const a = p.params;
    try {
      if (p.type === "agendar") {
        const created = await gcal.createEvent({
          summary: a.summary,
          description: a.description,
          startIso: a.startIso,
          endIso: a.endIso,
        });
        await supabase.from("appointments").insert({
          user_id: ownerUserId,
          patient_id: a.patient_id ?? null,
          google_calendar_event_id: created.id,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone ?? null,
          appointment_date: a.date,
          appointment_time: a.time,
          notes: a.description || null,
          status: "scheduled",
        });
        return `✅ Agendado: ${p.summary}`;
      }

      if (p.type === "cancelar") {
        await gcal.deleteEvent(a.event_id);
        await supabase
          .from("appointments")
          .update({ status: "cancelled" })
          .eq("user_id", ownerUserId)
          .eq("google_calendar_event_id", a.event_id);
        return `✅ Cancelado: ${p.summary}`;
      }

      if (p.type === "pagamento") {
        const { error } = await supabase.from("payments").insert({
          user_id: ownerUserId,
          patient_id: a.patient_id,
          amount: a.amount,
          payment_method: a.method,
          payment_date: a.date,
          status: a.status,
          paid_at: a.status === "paid" ? new Date().toISOString() : null,
          description: a.description ?? null,
        });
        if (error) throw new Error(error.message);
        return `✅ Pagamento lançado: ${p.summary}`;
      }

      if (p.type === "cadastro") {
        const { error } = await supabase.from("patients").insert({ user_id: ownerUserId, ...a.record });
        if (error) throw new Error(error.message);
        return `✅ Paciente cadastrado: ${p.summary.replace(/^Cadastrar paciente: /, "")}`;
      }

      return "Não reconheci essa ação. Nada foi alterado.";
    } catch (e) {
      return `❌ Não consegui concluir: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // ── Ferramentas do modelo ───────────────────────────────────────────
  function buildTools(setPending: (p: PendingAction) => void): GeminiTool[] {
    return [
      {
        name: "consultar_agenda",
        description: "Lista os compromissos da agenda da Dra. entre duas datas (inclusive).",
        parameters: {
          type: "object",
          properties: {
            data_inicio: { type: "string", description: "YYYY-MM-DD" },
            data_fim: { type: "string", description: "YYYY-MM-DD (opcional; padrão = data_inicio)" },
          },
          required: ["data_inicio"],
        },
        execute: async (args: any) => {
          const from = String(args?.data_inicio ?? "");
          const to = String(args?.data_fim || from);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
            return { error: "Datas inválidas. Use YYYY-MM-DD." };
          }
          const events = await gcal.listEvents(brtDateTime(from, "00:00"), brtDateTime(to, "23:59"));
          return { total: events.length, compromissos: events.map(describeEvent) };
        },
      },
      {
        name: "buscar_paciente",
        description: "Busca pacientes pelo nome (ou parte dele) e devolve telefone e local de atendimento.",
        parameters: {
          type: "object",
          properties: { nome: { type: "string" } },
          required: ["nome"],
        },
        execute: async (args: any) => {
          const found = matchByName(await loadPatients(), String(args?.nome ?? "")).slice(0, 6);
          return {
            total: found.length,
            pacientes: found.map((p: any) => ({
              nome: p.name,
              telefone: p.phone ?? null,
              local: p.clinic_location ?? null,
            })),
          };
        },
      },
      {
        name: "propor_agendamento",
        description:
          "Prepara um agendamento na agenda. NÃO grava: o sistema pede o ok da equipe antes de executar.",
        parameters: {
          type: "object",
          properties: {
            tipo: { type: "string", description: "consulta, retorno ou procedimento" },
            paciente: { type: "string", description: "Nome do paciente" },
            data: { type: "string", description: "YYYY-MM-DD" },
            hora: { type: "string", description: "HH:MM" },
            local: { type: "string", description: "Vitória, Vila Velha, etc. (opcional)" },
            duracao_min: { type: "number", description: "Duração em minutos (padrão 60)" },
            observacoes: { type: "string" },
          },
          required: ["tipo", "paciente", "data", "hora"],
        },
        execute: async (args: any) => {
          const date = String(args?.data ?? "");
          const time = String(args?.hora ?? "").slice(0, 5);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
            return { error: "Data ou hora inválida." };
          }
          const tipo = EVENT_TYPES[String(args?.tipo ?? "consulta").toLowerCase()] ?? "Consulta";
          const matches = matchByName(await loadPatients(), String(args?.paciente ?? ""));
          if (matches.length > 1) {
            return { precisa_escolher: matches.slice(0, 6).map((p: any) => p.name) };
          }
          const patient: any = matches[0] ?? null;
          const name = patient?.name ?? String(args?.paciente ?? "").trim();
          if (!name) return { error: "Informe o nome do paciente." };

          const duration = Number(args?.duracao_min) > 0 ? Number(args.duracao_min) : 60;
          const startIso = brtDateTime(date, time);
          const endIso = addMinutesBrt(date, time, duration);
          const descParts = [] as string[];
          if (args?.local) descParts.push(`Local: ${args.local}`);
          if (args?.observacoes) descParts.push(String(args.observacoes));

          const conflicts = (await dayEvents(date)).filter(
            (e) => new Date(e.start) < new Date(endIso) && new Date(e.end) > new Date(startIso),
          );

          const summary =
            `${tipo} — ${name}, ${weekdayLabel(date)} ${formatDateBr(date)} às ${time}` +
            (args?.local ? ` (${args.local})` : "") +
            (patient ? "" : " ⚠️ paciente não encontrado no cadastro");
          const warn = conflicts.length
            ? `\n⚠️ Já existe na agenda nesse horário: ${conflicts.map((c) => c.summary).join("; ")}`
            : "";

          setPending({
            type: "agendar",
            summary: summary + warn,
            created_at: new Date().toISOString(),
            params: {
              summary: `${tipo}: ${name}`,
              description: descParts.join("\n"),
              startIso,
              endIso,
              date,
              time,
              patient_id: patient?.id ?? null,
              patient_name: name,
              patient_phone: patient?.phone ? normalizePhone(patient.phone) : null,
            },
          });
          return {
            preparado: true,
            resumo: summary,
            paciente_cadastrado: !!patient,
            conflitos: conflicts.map((c) => c.summary),
          };
        },
      },
      {
        name: "propor_cancelamento",
        description:
          "Prepara o cancelamento de um compromisso da agenda de um paciente numa data. NÃO executa: pede o ok da equipe.",
        parameters: {
          type: "object",
          properties: {
            paciente: { type: "string" },
            data: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["paciente", "data"],
        },
        execute: async (args: any) => {
          const date = String(args?.data ?? "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida." };
          const tokens = String(args?.paciente ?? "");
          const events = (await dayEvents(date)).filter(
            (e) => matchByName([{ name: e.summary }], tokens).length > 0,
          );
          if (events.length === 0) return { encontrado: false, aviso: "Não achei compromisso desse paciente nessa data." };
          if (events.length > 1) return { precisa_escolher: events.map(describeEvent) };
          const ev = events[0];
          const d = describeEvent(ev);
          const summary = `Cancelar na agenda: ${ev.summary}, ${d.dia} ${formatDateBr(d.data)} às ${d.inicio}`;
          setPending({
            type: "cancelar",
            summary,
            created_at: new Date().toISOString(),
            params: { event_id: ev.id },
          });
          return { preparado: true, resumo: summary };
        },
      },
      {
        name: "propor_cadastro_paciente",
        description:
          "Cadastra um NOVO paciente. Chame a cada mensagem com TODOS os dados já informados na conversa. " +
          "A ferramenta devolve o que ainda falta. NÃO grava: só prepara; o sistema pede o ok da equipe.",
        parameters: {
          type: "object",
          properties: {
            nome: { type: "string", description: "Nome completo" },
            telefone: { type: "string", description: "Telefone com DDD" },
            cpf: { type: "string" },
            email: { type: "string" },
            data_nascimento: { type: "string", description: "DD/MM/AAAA ou AAAA-MM-DD" },
            origem: { type: "string", description: "Como conheceu: indicação, Google, Instagram, anúncio, etc." },
            local_atendimento: { type: "string", description: "Vitória, Vila Velha, Cariacica e/ou Niterói" },
            cadastrar_mesmo_com_pendencias: {
              type: "boolean",
              description: "true somente se a equipe pediu para cadastrar assim mesmo, sem os campos pendentes",
            },
          },
          required: ["nome"],
        },
        execute: async (args: any) => {
          const nome = String(args?.nome ?? "").trim().replace(/\s+/g, " ");
          if (nome.split(" ").length < 2) return { error: "Preciso do nome completo (nome e sobrenome)." };

          const invalidos: string[] = [];
          const record: Record<string, any> = { name: nome };

          const phoneRaw = String(args?.telefone ?? "").trim();
          if (phoneRaw) {
            const digits = phoneRaw.replace(/\D/g, "");
            if (digits.length < 10 || digits.length > 13) invalidos.push("telefone (precisa de DDD)");
            else record.phone = phoneRaw;
          }
          const cpfRaw = String(args?.cpf ?? "").trim();
          if (cpfRaw) {
            const cpf = normalizeCpf(cpfRaw);
            if (!cpf) invalidos.push("CPF (11 dígitos válidos)");
            else record.cpf = cpf;
          }
          const emailRaw = String(args?.email ?? "").trim();
          if (emailRaw) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) invalidos.push("e-mail");
            else record.email = emailRaw.toLowerCase();
          }
          const birthRaw = String(args?.data_nascimento ?? "").trim();
          if (birthRaw) {
            const b = parseBirthDate(birthRaw);
            if (!b) invalidos.push("data de nascimento (use DD/MM/AAAA)");
            else record.birth_date = b;
          }
          const locRaw = String(args?.local_atendimento ?? "").trim();
          if (locRaw) {
            const loc = normalizeLocations(locRaw);
            if (!loc) invalidos.push("local de atendimento (Vitória, Vila Velha, Cariacica ou Niterói)");
            else record.clinic_location = loc;
          }
          const refRaw = String(args?.origem ?? "").trim();
          if (refRaw) record.referral_source = normalizeReferral(refRaw);

          // Já existe alguém com esse nome?
          const all = await loadPatients();
          const sameName = all.filter((p: any) => normalizeText(p.name) === normalizeText(nome));
          if (sameName.length > 0) {
            return { ja_cadastrado: sameName.map((p: any) => ({ nome: p.name, telefone: p.phone ?? null })) };
          }
          const similar = matchByName(all, nome).slice(0, 4).map((p: any) => p.name);

          const faltando: string[] = [];
          if (!record.phone) faltando.push("telefone");
          if (!record.cpf) faltando.push("CPF (necessário para emitir nota fiscal)");
          if (!record.birth_date) faltando.push("data de nascimento");
          if (!record.clinic_location) faltando.push("local de atendimento");
          if (!record.referral_source) faltando.push("como conheceu a Dra.");
          if (!record.email) faltando.push("e-mail");

          const ready = faltando.length === 0 || args?.cadastrar_mesmo_com_pendencias === true;
          if (invalidos.length > 0 || !ready) {
            return {
              preparado: false,
              nome,
              dados_validos: record,
              invalidos,
              faltando,
              parecidos_no_cadastro: similar,
              instrucao: "Mostre o que já tem e o que falta; pergunte se quer completar ou cadastrar assim mesmo.",
            };
          }

          const resumoCampos = [
            `*${record.name}*`,
            record.phone ? `tel ${record.phone}` : null,
            record.cpf ? `CPF ${record.cpf}` : null,
            record.birth_date ? `nasc. ${formatDateBr(record.birth_date)}` : null,
            record.clinic_location ? `local ${String(record.clinic_location).split(",").join(" e ").replace(/_/g, " ")}` : null,
            record.referral_source ? `origem ${REFERRAL_LABELS[record.referral_source] ?? record.referral_source}` : null,
            record.email ?? null,
          ].filter(Boolean).join(" · ");

          const summary = `Cadastrar paciente: ${resumoCampos}` +
            (faltando.length ? ` (sem: ${faltando.join(", ")})` : "");
          setPending({
            type: "cadastro",
            summary,
            created_at: new Date().toISOString(),
            params: { record },
          });
          return { preparado: true, resumo: summary, parecidos_no_cadastro: similar };
        },
      },
      {
        name: "propor_pagamento",
        description:
          "Prepara o lançamento de um pagamento de paciente no financeiro. NÃO grava: pede o ok da equipe.",
        parameters: {
          type: "object",
          properties: {
            paciente: { type: "string" },
            valor: { type: "number", description: "Valor em reais" },
            forma: { type: "string", description: "Pix, Dinheiro, Cartão de crédito, Cartão de débito, Transferência bancária ou Outro" },
            data: { type: "string", description: "YYYY-MM-DD (padrão hoje)" },
            status: { type: "string", description: "paid (recebido) ou pending (a receber). Padrão paid" },
            descricao: { type: "string" },
          },
          required: ["paciente", "valor", "forma"],
        },
        execute: async (args: any) => {
          const amount = Number(args?.valor);
          if (!(amount > 0)) return { error: "Valor inválido." };
          const matches = matchByName(await loadPatients(), String(args?.paciente ?? ""));
          if (matches.length === 0) return { error: "Paciente não encontrado no cadastro." };
          if (matches.length > 1) return { precisa_escolher: matches.slice(0, 6).map((p: any) => p.name) };
          const patient: any = matches[0];

          const wanted = String(args?.forma ?? "").toLowerCase();
          const method = PAYMENT_METHODS.find((m) => m.toLowerCase() === wanted) ??
            PAYMENT_METHODS.find((m) => m.toLowerCase().includes(wanted) && wanted.length > 2) ?? "Outro";
          const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.data ?? ""))
            ? String(args.data)
            : toBrt(new Date().toISOString()).date;
          const status = String(args?.status ?? "paid") === "pending" ? "pending" : "paid";

          const summary =
            `${brl(amount)} (${method}) de ${patient.name}, ${formatDateBr(date)}, ` +
            (status === "paid" ? "recebido" : "a receber");
          setPending({
            type: "pagamento",
            summary,
            created_at: new Date().toISOString(),
            params: {
              patient_id: patient.id,
              amount,
              method,
              date,
              status,
              description: args?.descricao ? String(args.descricao) : null,
            },
          });
          return { preparado: true, resumo: summary };
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
      .limit(10);
    const ordered = (data ?? []).reverse().filter((m: any) => m.message_text);
    const history: GeminiContent[] = ordered.map((m: any) => ({
      role: m.direction === "inbound" ? "user" : "model",
      parts: [{ text: m.message_text }],
    }));
    while (history.length && history[history.length - 1].role === "user") history.pop();
    while (history.length && history[0].role !== "user") history.shift();
    return history;
  }

  async function handleMessage(input: {
    conversationId: string;
    text: string;
    senderName: string;
    hasPending: boolean;
  }): Promise<{ text: string; pending: PendingAction | null }> {
    const holder: { p: PendingAction | null } = { p: null };
    const nowBrt = toBrt(new Date().toISOString());

    const systemPrompt = buildAdminSystemPrompt({
      todayIso: nowBrt.date,
      weekday: weekdayLabel(nowBrt.date),
      senderName: input.senderName,
      hasPending: input.hasPending,
    });

    try {
      const result = await gemini.generateReply({
        systemPrompt,
        history: await loadHistory(input.conversationId),
        userMessage: input.text,
        tools: buildTools((p) => {
          holder.p = p;
        }),
      });
      if (result.error) console.error("Gemini indisponível:", result.error);
      const text = result.text?.trim() || (holder.p ? "" : "Não consegui entender agora. Pode repetir, por favor?");
      return { text, pending: holder.p };
    } catch (e) {
      console.error("Falha ao gerar resposta da Íris:", e);
      return { text: "Estou com uma instabilidade técnica agora. Tente de novo em instantes.", pending: null };
    }
  }

  return { handleMessage, executePending };
}
