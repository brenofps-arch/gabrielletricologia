// Lista das consultas enviada à EQUIPE (nunca ao paciente).
//
// Agendamento sugerido (horário de Brasília):
//   18h30  -> lista de AMANHÃ            (padrão: ?target=tomorrow)
//   09h30  -> lista de HOJE, só se a das 18h30 não saiu (?target=today)
// Cada data é enviada uma única vez (controle na tabela iris_job_runs).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createEvolutionService } from "../_shared/services/evolutionService.ts";
import { createGoogleCalendarService } from "../_shared/services/googleCalendarService.ts";
import {
  brtDateTime,
  formatDateBr,
  matchByName,
  toBrt,
  weekdayLabel,
} from "../_shared/services/adminLogic.ts";
import { ADMIN_PHONE_NUMBERS, getAdminGroupJid, getOwnerUserId } from "../_shared/config.ts";

const JOB = "daily_list";

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  // Proteção opcional: se CRON_SECRET existir, o agendador precisa enviá-lo.
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("target") === "today" ? "today" : "tomorrow";
    const force = url.searchParams.get("force") === "1";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const owner = getOwnerUserId();
    const evolution = createEvolutionService();
    if (!evolution.isConfigured()) return json({ status: "missing_configuration" });

    // Data da lista, em Brasília.
    const today = toBrt(new Date().toISOString()).date;
    let day = today;
    if (target === "tomorrow") {
      const base = new Date(`${today}T12:00:00-03:00`);
      base.setUTCDate(base.getUTCDate() + 1);
      day = toBrt(base.toISOString()).date;
    }

    // Já enviada para essa data?
    if (!force) {
      const { data: already } = await supabase
        .from("iris_job_runs")
        .select("run_date")
        .eq("job", JOB)
        .eq("run_date", day)
        .maybeSingle();
      if (already) return json({ status: "already_sent", date: day });
    }

    const gcal = createGoogleCalendarService(supabase, owner);
    const events = await gcal.listEvents(brtDateTime(day, "00:00"), brtDateTime(day, "23:59"));
    if (events.length === 0) return json({ status: "no_events", date: day });

    const { data: patients } = await supabase.from("patients").select("name, phone").eq("user_id", owner);
    const list = patients ?? [];

    const lines = events.map((e, i) => {
      const t = toBrt(e.start).time;
      const title = e.summary.includes(":") ? e.summary.slice(e.summary.indexOf(":") + 1).trim() : e.summary;
      const found = matchByName(list, title);
      const phone = found.length === 1 && found[0].phone ? ` — ${found[0].phone}` : "";
      return `${i + 1}) ${t} — ${e.summary}${phone}`;
    });

    const when = target === "today" ? "de hoje" : "de amanhã";
    const message =
      `📅 *Consultas ${when}* (${weekdayLabel(day)}, ${formatDateBr(day)})\n\n` +
      lines.join("\n") +
      `\n\nConfirmem com os pacientes. Se alguém cancelar, me avise aqui que eu tiro da agenda.`;

    const group = getAdminGroupJid();
    const targets = group ? [group] : ADMIN_PHONE_NUMBERS;
    const results: boolean[] = [];
    for (const to of targets) results.push((await evolution.sendText(to, message)).ok);

    // Só marca como enviada se chegou a pelo menos um destino.
    if (results.some(Boolean)) {
      await supabase.from("iris_job_runs").upsert({ job: JOB, run_date: day });
    }

    return json({ status: results.some(Boolean) ? "sent" : "failed", date: day, events: events.length, delivered: results });
  } catch (e) {
    console.error("Erro na lista diária:", e);
    return json({ status: "error", error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
