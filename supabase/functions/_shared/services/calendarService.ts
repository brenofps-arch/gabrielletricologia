// Camada de serviço da agenda: disponibilidade, agendamento e cancelamento.

const SLOTS: Record<number, { local: string; times: string[] }> = {
  3: { local: "Vila Velha", times: ["07:00", "08:00", "09:00", "10:00"] }, // quarta
  4: { local: "Vitória", times: ["08:00", "09:00", "10:00", "11:00"] }, // quinta
};

const localToWeekday = (local?: string) => {
  const l = (local ?? "").toLowerCase();
  if (l.includes("vila")) return 3;
  if (l.includes("vit")) return 4;
  return null;
};

const isoDate = (d: Date) => d.toISOString().split("T")[0];

export function createCalendarService(supabase: any, ownerUserId: string) {
  async function busySlots(fromIso: string, toIso: string) {
    const { data } = await supabase
      .from("appointments")
      .select("appointment_date, appointment_time")
      .eq("user_id", ownerUserId)
      .gte("appointment_date", fromIso)
      .lte("appointment_date", toIso)
      .neq("status", "cancelled");
    return (data ?? []).map(
      (a: any) => `${a.appointment_date} ${String(a.appointment_time).slice(0, 5)}`,
    );
  }

  async function listAvailability(local: string, weeksAhead = 3) {
    const weekday = localToWeekday(local);
    if (!weekday) return { error: "Local inválido. Use 'Vila Velha' ou 'Vitória'." };

    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + weeksAhead * 7);
    const busy = new Set(await busySlots(isoDate(today), isoDate(horizon)));

    const days: { data: string; local: string; horarios: string[] }[] = [];
    for (let i = 1; i <= weeksAhead * 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (d.getUTCDay() !== weekday) continue;
      const conf = SLOTS[weekday];
      const date = isoDate(d);
      const horarios = conf.times.filter((t) => !busy.has(`${date} ${t}`));
      if (horarios.length) days.push({ data: date, local: conf.local, horarios });
      if (days.length >= 4) break;
    }
    return { local: SLOTS[weekday].local, disponibilidade: days };
  }

  async function scheduleAppointment(input: {
    patient_name: string;
    phone: string;
    complaint?: string;
    date: string;
    time: string;
    local?: string;
  }) {
    const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
    if (!SLOTS[weekday]) {
      return { ok: false, error: "A Dra. atende somente às quartas (Vila Velha) e quintas (Vitória)." };
    }
    if (input.date <= isoDate(new Date())) {
      return { ok: false, error: "Não é possível agendar para hoje ou datas passadas." };
    }
    const time = input.time.slice(0, 5);
    if (!SLOTS[weekday].times.includes(time)) {
      return { ok: false, error: `Horários possíveis nesse dia: ${SLOTS[weekday].times.join(", ")}` };
    }
    const busy = await busySlots(input.date, input.date);
    if (busy.includes(`${input.date} ${time}`)) {
      return { ok: false, error: "Esse horário acabou de ser ocupado. Ofereça outro." };
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        user_id: ownerUserId,
        patient_name: input.patient_name,
        patient_phone: input.phone,
        chief_complaint: input.complaint ?? null,
        appointment_date: input.date,
        appointment_time: time,
        status: "confirmed",
        source: "whatsapp",
        notes: input.local ? `Local: ${input.local}` : null,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    // Lembrete no dia anterior às 08h (BRT = 11h UTC)
    const remindAt = new Date(`${input.date}T${time}:00-03:00`);
    remindAt.setDate(remindAt.getDate() - 1);
    remindAt.setUTCHours(11, 0, 0, 0);
    await supabase.from("appointment_reminders").insert({
      user_id: ownerUserId,
      patient_phone: input.phone,
      patient_name: input.patient_name,
      appointment_at: new Date(`${input.date}T${time}:00-03:00`).toISOString(),
      send_at: remindAt.toISOString(),
      message:
        `Olá, ${input.patient_name}! Passando para lembrar da sua consulta com a Dra. Gabrielle Sagrillo amanhã às ${time}` +
        (input.local ? ` (${input.local})` : "") +
        `. Até lá! 💜`,
      status: "pending",
    });

    return { ok: true, appointment_id: data?.id, data: input.date, horario: time };
  }

  async function cancelAppointment(phone: string, date?: string) {
    let q = supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("user_id", ownerUserId)
      .eq("patient_phone", phone)
      .neq("status", "cancelled");
    if (date) q = q.eq("appointment_date", date);
    const { error } = await q;
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  async function findPatient(phone: string) {
    const { data } = await supabase
      .from("patients")
      .select("name, condition, sessions_count, important_notes")
      .eq("user_id", ownerUserId)
      .eq("phone", phone)
      .maybeSingle();

    const { data: appts } = await supabase
      .from("appointments")
      .select("appointment_date, appointment_time, status")
      .eq("user_id", ownerUserId)
      .eq("patient_phone", phone)
      .order("appointment_date", { ascending: false })
      .limit(3);

    return { paciente: data ?? null, consultas: appts ?? [] };
  }

  return { busySlots, listAvailability, scheduleAppointment, cancelAppointment, findPatient };
}
