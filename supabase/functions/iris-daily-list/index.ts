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
  confirmationText,
  formatDateBr,
  matchByName,
  toBrt,
  visitKindFromTitle,
  weekdayLabel,
} from "../_shared/services/adminLogic.ts";
import { ADMIN_PHONE_NUMBERS, getAdminGroupJid, getOwnerUserId } from "../_shared/config.ts";

const JOB = "daily_list";

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  // Sondagens (CORS/OPTIONS) e GET nunca executam o envio.
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  // Proteção opcional: se CRON_SECRET existir, o agendador precisa enviá-lo.
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("target") === "today" ? "today" : "tomorrow";
    const force = url.searchParams.get("force") === "1";
    // dry=1: monta a lista e devolve o texto, sem enviar nada nem registrar.
    const dry = url.searchParams.get("dry") === "1";

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
    // Simulação: permite escolher a data, mas só com dry=1 (nunca envia nada).
    const simulated = url.searchParams.get("date");
    if (dry && simulated && /^\d{4}-\d{2}-\d{2}$/.test(simulated)) day = simulated;

    // Já enviada para essa data?
    if (!force && !dry) {
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

    const { data: patients } = await supabase.from("patients").select("name, phone, clinic_location").eq("user_id", owner);
    const list = patients ?? [];

    const when = target === "today" ? "hoje" : "amanhã";
    const placeNames: Record<string, string> = {
      vila_velha: "Vila Velha", vitoria: "Vitória", cariacica: "Cariacica", niteroi: "Niterói",
    };

    const patientTexts: string[] = [];
    const lines = events.map((e, i) => {
      const t = toBrt(e.start).time;
      const title = e.summary.includes(":") ? e.summary.slice(e.summary.indexOf(":") + 1).trim() : e.summary;
      const found = matchByName(list, title);
      const patient: any = found.length === 1 ? found[0] : null;
      const phone = patient?.phone ? ` — ${patient.phone}` : "";

      // Texto pronto de confirmação, só para compromissos de paciente.
      const kind = visitKindFromTitle(e.summary);
      if (kind) {
        const fromDesc = e.description.match(/Local:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
        const locs = String(patient?.clinic_location ?? "").split(",").map((x: string) => x.trim()).filter(Boolean);
        const place = fromDesc ?? (locs.length === 1 ? placeNames[locs[0]] ?? null : null);
        patientTexts.push(
          confirmationText({
            name: patient?.name ?? title,
            kind,
            when,
            weekday: weekdayLabel(day),
            dateBr: formatDateBr(day),
            time: t,
            place,
          }),
        );
      }
      return `${i + 1}) ${t} — ${e.summary}${phone}`;
    });

    const message =
      `📅 *Consultas de ${when}* (${weekdayLabel(day)}, ${formatDateBr(day)})\n\n` +
      lines.join("\n") +
      `\n\nSe alguém cancelar, me avise aqui que eu tiro da agenda.` +
      (patientTexts.length
        ? `\n\nAbaixo, o texto pronto de cada paciente, na mesma ordem. É só copiar e enviar. 👇`
        : "");

    if (dry) return json({ status: "dry_run", date: day, events: events.length, message, patientTexts });

    const group = getAdminGroupJid();
    const targets = group ? [group] : ADMIN_PHONE_NUMBERS;
    const results: boolean[] = [];
    for (const to of targets) {
      results.push((await evolution.sendText(to, message)).ok);
      // Um texto por paciente, em mensagens separadas, para copiar com um toque.
      for (const text of patientTexts) {
        await new Promise((r) => setTimeout(r, 900));
        await evolution.sendText(to, text);
      }
    }

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
