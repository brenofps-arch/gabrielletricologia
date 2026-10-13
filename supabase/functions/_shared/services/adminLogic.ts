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
  type: "agendar" | "cancelar" | "pagamento" | "cadastro" | "editar_paciente" | "excluir_paciente" | "remarcar";
  summary: string;
  params: Record<string, any>;
  created_at: string;
}

export const isPendingFresh = (p: PendingAction | null | undefined, now = new Date()) =>
  !!p && now.getTime() - new Date(p.created_at).getTime() <= PENDING_TTL_MINUTES * 60000;

// ── Cadastro de paciente ────────────────────────────────────────────────

/** CPF com 11 dígitos válidos -> "000.000.000-00". Devolve null se inválido. */
export function normalizeCpf(raw: string): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return null;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  if (calc(9) !== Number(d[9]) || calc(10) !== Number(d[10])) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "30/04/1975", "30-04-75" ou "1975-04-30" -> "1975-04-30". null se inválida. */
export function parseBirthDate(raw: string): string | null {
  const t = (raw ?? "").trim();
  let y: number;
  let m: number;
  let d: number;
  let mt = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mt) {
    y = +mt[1];
    m = +mt[2];
    d = +mt[3];
  } else {
    mt = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/);
    if (!mt) return null;
    d = +mt[1];
    m = +mt[2];
    y = +mt[3];
    if (mt[3].length === 2) y += y > 30 ? 1900 : 2000;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > Date.now()) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const LOCATIONS: [string, string[]][] = [
  ["vila_velha", ["vila velha"]],
  ["vitoria", ["vitoria"]],
  ["cariacica", ["cariacica"]],
  ["niteroi", ["niteroi"]],
];

/** Texto livre ("vitória e vila velha") -> "vila_velha,vitoria" (formato do sistema). */
export function normalizeLocations(raw: string): string {
  const t = normalizeText(raw);
  return LOCATIONS.filter(([, names]) => names.some((n) => t.includes(n))).map(([v]) => v).join(",");
}

const REFERRALS: [string, string[]][] = [
  ["indicacao_medico", ["medico", "medica"]],
  ["indicacao", ["indicacao", "indicou", "amigo", "amiga", "paciente"]],
  ["instagram_organico", ["instagram"]],
  ["anuncio", ["anuncio", "facebook", "propaganda"]],
  ["google", ["google", "busca", "pesquisa"]],
  ["tiktok", ["tiktok", "tik tok"]],
  ["retorno", ["retorno", "voltou", "antigo"]],
];

export function normalizeReferral(raw: string): string | null {
  const t = normalizeText(raw);
  if (!t) return null;
  for (const [v, keys] of REFERRALS) if (keys.some((k) => t.includes(k))) return v;
  return "outro";
}

export const REFERRAL_LABELS: Record<string, string> = {
  indicacao: "Indicação de paciente",
  indicacao_medico: "Indicação de médico",
  instagram_organico: "Instagram",
  anuncio: "Anúncio",
  google: "Google",
  tiktok: "TikTok",
  retorno: "Retorno de paciente antigo",
  outro: "Outro",
};

/** Converte Markdown comum (**negrito**, # títulos) para a formatação do WhatsApp (*negrito*). */
export function toWhatsAppFormat(text: string): string {
  return (text ?? "")
    .replace(/\*\*(.+?)\*\*/gs, "*$1*")
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/__(.+?)__/gs, "_$1_")
    .replace(/^\s*[-•]\s+/gm, "• ");
}

/** Resumo curto e sem dados sensíveis de um erro, para mostrar à equipe. */
export function shortError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const code = raw.match(/\b(4\d\d|5\d\d)\b/)?.[1];
  const status = raw.match(/"status"\s*:\s*"([A-Z_]+)"/)?.[1];
  const msg = raw.match(/"message"\s*:\s*"([^"]{0,140})/)?.[1];
  // Erros nossos, em texto simples (ex.: "Gemini 504: sem resposta em 30s (modelo)"): mostra o texto.
  const plain = raw.match(/^Gemini \d{3}:\s*([^{][^
]{0,110})/)?.[1];
  return [code ? `HTTP ${code}` : null, status, msg ?? plain].filter(Boolean).join(" · ") || raw.slice(0, 120);
}

/** Valida e normaliza os campos de cadastro de paciente informados pela equipe. */
export function parsePatientFields(args: Record<string, any>): { record: Record<string, any>; invalidos: string[] } {
  const record: Record<string, any> = {};
  const invalidos: string[] = [];

  const nome = String(args?.nome ?? "").trim().replace(/\s+/g, " ");
  if (nome) record.name = nome;

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

  return { record, invalidos };
}

/** A anamnese conta como histórico se foi concluída ou tem qualquer campo preenchido. */
export function hasAnamnesis(anamnesis: unknown, completedAt?: string | null): boolean {
  if (completedAt) return true;
  if (!anamnesis || typeof anamnesis !== "object") return false;
  return Object.values(anamnesis as Record<string, unknown>).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return v;
    return true;
  });
}

export type VisitKind = "consulta" | "retorno" | "procedimento";

/** Descobre o tipo pelo prefixo do título ("Procedimento: Ana"). null se não for de paciente. */
export function visitKindFromTitle(summary: string): VisitKind | null {
  const head = normalizeText((summary ?? "").split(":")[0]);
  if (head.startsWith("procedimento")) return "procedimento";
  if (head.startsWith("retorno")) return "retorno";
  if (head.startsWith("consulta")) return "consulta";
  return null;
}

/** "ANA paula" -> "Ana" (primeiro nome com inicial maiúscula). */
export function firstNameOf(fullName: string): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

/** Texto pronto para a equipe copiar e enviar ao paciente. */
export function confirmationText(input: {
  name: string;
  kind: VisitKind;
  when: "hoje" | "amanhã";
  weekday: string;
  dateBr: string; // DD/MM/AAAA
  time: string; // HH:MM
  place?: string | null;
}): string {
  const what = input.kind === "procedimento" ? "o seu procedimento" : input.kind === "retorno" ? "o seu retorno" : "a sua consulta";
  const place = input.place ? ` em ${input.place}` : "";
  const nome = firstNameOf(input.name);
  return (
    `Olá, ${nome}! Tudo bem? 😊\n` +
    `Passando para confirmar ${what} ${input.when === "hoje" ? "de hoje" : "de amanhã"}, ${input.weekday} (${input.dateBr.slice(0, 5)}), ` +
    `às ${input.time}${place}.\n` +
    `Podemos contar com a sua presença? Se precisar reagendar, é só nos avisar. Obrigada! 💛`
  );
}

// ── Pacientes com sessão atrasada (mesma regra do Dashboard) ─────────────
export const LATE_MIN_DAYS = 20; // a partir daqui já aparece no alerta
export const LATE_MAX_DAYS = 60; // depois disso deixa de aparecer
export const LATE_OVERDUE_DAYS = 31; // a partir daqui é "atrasado"

/** Dias entre duas datas YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86400000);
}

/** Texto de situação do paciente conforme os dias desde a última sessão, ou null se fora da janela. */
export function lateStatus(daysSince: number): { overdue: boolean; label: string } | null {
  if (daysSince < LATE_MIN_DAYS || daysSince > LATE_MAX_DAYS) return null;
  if (daysSince >= LATE_OVERDUE_DAYS) return { overdue: true, label: `Atrasado há ${daysSince - 30} dia(s)` };
  return { overdue: false, label: `Faltam ${30 - daysSince} dia(s)` };
}
