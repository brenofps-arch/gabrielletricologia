// Camada de serviço da Evolution API (envio/recebimento de WhatsApp).

export interface IncomingMessage {
  phoneNumber: string;
  contactName: string;
  text: string;
  waMessageId: string;
  fromMe: boolean;
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

    const rawPhone = data?.key?.remoteJid ?? "";
    if (String(rawPhone).includes("@g.us")) return null; // ignora grupos

    const phoneNumber = String(rawPhone)
      .replace("@s.whatsapp.net", "")
      .replace(/\D/g, "");

    const text =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.buttonsResponseMessage?.selectedDisplayText ||
      data?.message?.listResponseMessage?.title ||
      "";

    if (!phoneNumber || !text) return null;

    return {
      phoneNumber,
      contactName: data?.pushName || "Desconhecido",
      text: String(text),
      waMessageId: data?.key?.id || "",
      fromMe: false,
    };
  }

  async function sendText(to: string, text: string) {
    if (!isConfigured()) {
      return { ok: false, messageId: null, error: "Evolution API não configurada" };
    }
    const number = to.replace(/\D/g, "");
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

  return { isConfigured, parseWebhookEvent, sendText };
}
