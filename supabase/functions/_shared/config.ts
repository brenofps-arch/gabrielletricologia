// Configuração compartilhada das funções do assistente interno (Íris).

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_OWNER_USER_ID = "922d4be3-68dd-4b84-8fca-8db3b442a44c";

/** Telefones (DDI+DDD+número, só dígitos) da equipe autorizada a falar com a Íris. */
export const ADMIN_PHONE_NUMBERS = ["5521971183737", "5527997244164", "5527997626808"];

export function getOwnerUserId(): string {
  const configured = Deno.env.get("WHATSAPP_OWNER_USER_ID")?.trim();
  if (configured && UUID_REGEX.test(configured)) return configured;
  if (configured) console.warn("WHATSAPP_OWNER_USER_ID inválido; usando fallback");
  return DEFAULT_OWNER_USER_ID;
}

/** JID do grupo da equipe (ex.: 120363000000000000@g.us). Opcional. */
export function getAdminGroupJid(): string | null {
  const jid = Deno.env.get("IRIS_ADMIN_GROUP_JID")?.trim();
  return jid ? jid : null;
}
