// Camada de serviço da Evolution API (envio/recebimento de WhatsApp).

export interface IncomingMessage {
  /** Quem escreveu (só dígitos). Em grupo, é o participante. */
  senderPhone: string;
  /** Onde responder: o telefone (conversa direta) ou o JID do grupo. */
  chatId: string;
  isGroup: boolean;
  /** JID de quem escreveu (pode ser um LID, "123@lid", sem telefone). */
  senderJid: string;
  /** true quando o remetente veio como LID e o telefone ainda precisa ser resolvido. */
  senderIsLid: boolean;
  contactName: string;
  text: string;
  waMessageId: string;
  /** Momento em que a mensagem foi enviada (ms), se o payload trouxer. */
  timestampMs: number | null;
}

export function createEvolutionService(cfg?: {
  url?: string;
  apiKey?: string;
  instance?: string;
}) {
  const url = (cfg?.url ?? Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
  const apiKey = cfg?.apiKey ?? Deno.env.get("EVOLUTION_API_KEY") ?? "";
  const instance = cfg?.instance ?? Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "";

  const isConfigured = () => Boolean(url && apiKey && instance);

  /** Normaliza o payload do webhook da Evolution API. Retorna null se não for mensagem válida. */
  function parseWebhookEvent(body: any): IncomingMessage | null {
    const normalizedEvent = String(body?.event ?? "").toLowerCase().replace("_", ".");
    if (normalizedEvent !== "messages.upsert") return null;

    const data = body?.data;
    if (!data) return null;
    if (data?.key?.fromMe === true) return null;

    const remoteJid = String(data?.key?.remoteJid ?? "");
    const isGroup = remoteJid.includes("@g.us");

    // Em grupo, quem escreveu vem em key.participant.
    const senderJid = isGroup ? String(data?.key?.participant ?? data?.participant ?? "") : remoteJid;
    const senderIsLid = senderJid.endsWith("@lid");

    // O WhatsApp novo identifica por LID; alguns campos trazem o telefone correspondente.
    const altCandidates = [
      data?.key?.participantAlt, data?.key?.participantPn, data?.key?.senderPn, data?.key?.remoteJidAlt,
      data?.participantAlt, data?.participantPn, data?.senderPn,
    ];
    const altJid = altCandidates.map((v) => String(v ?? "")).find((v) => v.endsWith("@s.whatsapp.net"));
    const senderPhone = senderIsLid && altJid
      ? altJid.split("@")[0].replace(/\D/g, "")
      : senderJid.split("@")[0].replace(/\D/g, "");

    const text =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.buttonsResponseMessage?.selectedDisplayText ||
      data?.message?.listResponseMessage?.title ||
      "";

    if (!senderPhone || !text) return null;

    return {
      senderPhone,
      chatId: isGroup ? remoteJid : senderPhone,
      isGroup,
      senderJid,
      senderIsLid: senderIsLid && !altJid,
      contactName: data?.pushName || "Equipe",
      text: String(text),
      waMessageId: data?.key?.id || "",
      timestampMs: Number(data?.messageTimestamp) > 0 ? Number(data.messageTimestamp) * 1000 : null,
    };
  }

  /** Traduz o LID de um participante do grupo no telefone dele (via dados do grupo). */
  async function resolveGroupMemberPhone(groupJid: string, memberJid: string): Promise<string | null> {
    if (!isConfigured()) return null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `${url}/group/findGroupInfos/${instance}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers: { apikey: apiKey }, signal: controller.signal },
      );
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      const found = (data?.participants ?? []).find((p: any) => p?.id === memberJid);
      const phone = String(found?.phoneNumber ?? "");
      return phone.endsWith("@s.whatsapp.net") ? phone.split("@")[0].replace(/\D/g, "") : null;
    } catch (err: any) {
      console.error("resolveGroupMemberPhone falhou:", err?.message || String(err));
      return null;
    }
  }

  async function sendText(to: string, text: string) {
    if (!isConfigured()) {
      return { ok: false, messageId: null, error: "Evolution API não configurada" };
    }
    // Grupo: mantém o JID inteiro; conversa direta: só dígitos.
    const number = to.includes("@g.us") ? to : to.replace(/\D/g, "");
    const endpoint = `${url}/message/sendText/${instance}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number, text }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Evolution sendText falhou:", res.status, JSON.stringify(data).slice(0, 500));
      }
      return {
        ok: res.ok,
        messageId: data?.key?.id ?? null,
        error: res.ok ? undefined : JSON.stringify(data).slice(0, 500),
      };
    } catch (err: any) {
      console.error("Evolution sendText erro:", err?.message || String(err), "URL:", endpoint);
      return { ok: false, messageId: null, error: err?.message || String(err) };
    }
  }

  return { isConfigured, parseWebhookEvent, resolveGroupMemberPhone, sendText };
}
