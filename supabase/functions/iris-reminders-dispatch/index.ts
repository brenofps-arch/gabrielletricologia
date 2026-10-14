// Dispara os lembretes que a equipe pediu à Íris (tabela iris_reminders).
// Agendamento sugerido: a cada 5 minutos (pg_cron + pg_net).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createEvolutionService } from "../_shared/services/evolutionService.ts";
import { toBrt, weekdayLabel, formatDateBr } from "../_shared/services/adminLogic.ts";
import { getAdminGroupJid, getOwnerUserId } from "../_shared/config.ts";

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) return json({ error: "unauthorized" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const owner = getOwnerUserId();
    const evolution = createEvolutionService();
    if (!evolution.isConfigured()) return json({ status: "missing_configuration" });

    const { data: due, error } = await supabase
      .from("iris_reminders")
      .select("id, text, remind_at, chat_id")
      .eq("user_id", owner)
      .eq("status", "pending")
      .lte("remind_at", new Date().toISOString())
      .order("remind_at", { ascending: true })
      .limit(20);
    if (error) throw error;
    if (!due || due.length === 0) return json({ status: "nothing_due" });

    const group = getAdminGroupJid();
    let sent = 0;
    let failed = 0;

    for (const r of due) {
      // "Reserva" o lembrete para que duas execuções seguidas não o enviem duas vezes.
      const { data: claimed } = await supabase
        .from("iris_reminders")
        .update({ status: "sending" })
        .eq("id", r.id)
        .eq("status", "pending")
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const when = toBrt(r.remind_at);
      const lateMin = Math.round((Date.now() - new Date(r.remind_at).getTime()) / 60000);
      const lateNote = lateMin > 20
        ? `\n_(era para ${weekdayLabel(when.date)} ${formatDateBr(when.date)} às ${when.time}; chegou com atraso)_`
        : "";
      const text = `⏰ *Lembrete:* ${r.text}${lateNote}`;

      // Só vai para o grupo da equipe (nunca para conversa privada).
      const target = group ?? (String(r.chat_id ?? "").includes("@g.us") ? r.chat_id : null);
      const targets = target ? [target] : [];
      let ok = false;
      let lastError = targets.length ? "" : "sem grupo da equipe configurado";
      for (const to of targets) {
        const res = await evolution.sendText(to, text);
        if (res.ok) ok = true;
        else lastError = res.error ?? "falha no envio";
      }

      await supabase
        .from("iris_reminders")
        .update(ok
          ? { status: "sent", sent_at: new Date().toISOString(), error: null }
          : { status: "pending", error: lastError.slice(0, 300) })
        .eq("id", r.id);
      if (ok) sent++;
      else failed++;
    }

    return json({ status: "done", due: due.length, sent, failed });
  } catch (e) {
    console.error("Erro no disparo de lembretes:", e);
    return json({ status: "error", error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
