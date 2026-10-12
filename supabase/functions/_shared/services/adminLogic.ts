// Lógica pura (sem rede nem banco) do assistente interno da equipe.
// Fica separada para ser testável fora do Deno.

export const PENDING_TTL_MINUTES = 30;

export const normalizeText = (s: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Pacientes cujo nome contém todas as palavras da busca (sem acento, sem caixa). */
export function matchByName<T extends { name: string }>(patients: T[], query: string): T[] {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  return patients.filter((p) => {
    const name = normalizeText(p.name);
    return tokens.every((t) => name.includes(t));
  });
}

export type Confirmation = "yes" | "no" | null;

/** Interpreta a resposta da equipe a um pedido de confirmação. */
export function parseConfirmation(text: string): Confirmation {
  const t = normalizeText(text);
  if (!t) return null;
  if (/^(ok|okay|okey|sim|confirmo|confirmado|confirma|pode|pode sim|pode fazer|isso|isso mesmo|certo|beleza|fechado|vai|manda)( |$)/.test(t)) {
    return "yes";
  }
  if (/^(nao|n|cancela|cancelar|deixa|deixa pra la|esquece|errado|errei|para|pare)( |$)/.test(t)) {
    return "no";
  }
  return null;
}

/** "2026-10-14" + "09:00" -> "2026-10-14T09:00:00-03:00". */
export const brtDateTime = (date: string, time: string) => `${date}T${time.slice(0, 5)}:00-03:00`;

/** Soma minutos a um horário de Brasília e devolve de novo no formato -03:00. */
export function addMinutesBrt(date: string, time: string, minutes: number): string {
  const start = new Date(brtDateTime(date, time));
  const end = new Date(start.getTime() + minutes * 60000);
  const local = new Date(end.getTime() - 3 * 3600000); // lê os campos UTC como hora de Brasília
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:00-03:00`
  );
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function weekdayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00-03:00`);
  return WEEKDAYS[d.getUTCDay()];
}

export function formatDateBr(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Data (YYYY-MM-DD) e hora (HH:MM) de um instante ISO, em Brasília. */
export function toBrt(iso: string): { date: string; time: string } {
  const local = new Date(new Date(iso).getTime() - 3 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}`,
    time: `${p(local.getUTCHours())}:${p(local.getUTCMinutes())}`,
  };
}

/** Só dígitos; acrescenta o 55 se o número vier sem DDI. */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

export interface PendingAction {
  type: "agendar" | "cancelar" | "pagamento";
  summary: string;
  params: Record<string, any>;
  created_at: string;
}

export const isPendingFresh = (p: PendingAction | null | undefined, now = new Date()) =>
  !!p && now.getTime() - new Date(p.created_at).getTime() <= PENDING_TTL_MINUTES * 60000;
