import { Calendar, Users, ClipboardList, CalendarClock, AlarmClock, Syringe } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, addDays, differenceInCalendarDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

// Janela de alerta: sessoes de procedimento sao mensais, entao avisamos a
// partir de ~20 dias (proximo do prazo) ate 60 dias (ainda relevante marcar).
const PROCEDURE_ALERT_MIN_DAYS = 20;
const PROCEDURE_ALERT_MAX_DAYS = 60;
const PROCEDURE_ALERT_OVERDUE_DAYS = 31;

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-mint/30 text-secondary-foreground" },
  pending: { label: "Pendente", className: "bg-rose-gold-light text-primary" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

type ActivityItem = { text: string; date: Date };

const Index = () => {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("Doutora");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      const full = (data?.name || "").trim();
      if (full) {
        const first = full.split(/\s+/)[0];
        setDisplayName(`Dra. ${first}`);
      }
    })();
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const weekEnd = format(addDays(now, 7), "yyyy-MM-dd");

      const [todayRes, patientsRes, monthRes, weekRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("appointment_date", today)
          .neq("status", "cancelled"),
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("appointment_date", monthStart)
          .lte("appointment_date", monthEnd)
          .neq("status", "cancelled"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("appointment_date", today)
          .lte("appointment_date", weekEnd)
          .neq("status", "cancelled"),
      ]);

      return {
        today: todayRes.count ?? 0,
        patients: patientsRes.count ?? 0,
        month: monthRes.count ?? 0,
        nextWeek: weekRes.count ?? 0,
      };
    },
  });

  const { data: procedureAlerts = [] } = useQuery({
    queryKey: ["dashboard-procedure-alerts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("patient_id, consultation_date, procedure_type, patients(name)")
        .eq("visit_type", "procedimento")
        .order("consultation_date", { ascending: false });
      if (error) throw error;

      // Mantem apenas a sessao de procedimento mais recente de cada paciente
      const latestByPatient = new Map<string, (typeof data)[number]>();
      for (const c of data ?? []) {
        if (!latestByPatient.has(c.patient_id)) latestByPatient.set(c.patient_id, c);
      }

      const now = new Date();
      return Array.from(latestByPatient.values())
        .map((c) => {
          const lastDate = new Date(c.consultation_date);
          const daysSince = differenceInCalendarDays(now, lastDate);
          return {
            patientId: c.patient_id,
            patientName: (c as any).patients?.name ?? "Paciente",
            procedureType: c.procedure_type as string | null,
            lastDate,
            daysSince,
          };
        })
        .filter((p) => p.daysSince >= PROCEDURE_ALERT_MIN_DAYS && p.daysSince <= PROCEDURE_ALERT_MAX_DAYS)
        .sort((a, b) => b.daysSince - a.daysSince);
    },
  });

  const { data: upcomingResult } = useQuery({
    queryKey: ["dashboard-upcoming-gcal", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { connected: false, events: [] as GEvent[] };
      const timeMin = new Date().toISOString();
      const timeMax = addDays(new Date(), 7).toISOString();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const json = await res.json();
      return { connected: !!json.connected, events: (json.events ?? []) as GEvent[] };
    },
  });
  const upcoming = upcomingResult?.events ?? [];
  const calendarConnected = upcomingResult?.connected ?? true;

  const { data: activities = [] } = useQuery({
    queryKey: ["dashboard-activity", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [patientsRes, apptsRes, consultsRes, convsRes] = await Promise.all([
        supabase.from("patients").select("name, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("appointments").select("patient_name, created_at, appointment_date").order("created_at", { ascending: false }).limit(3),
        supabase.from("consultations").select("created_at, patients(name)").order("created_at", { ascending: false }).limit(3),
        supabase.from("whatsapp_conversations").select("contact_name, phone_number, updated_at").order("updated_at", { ascending: false }).limit(3),
      ]);

      const items: ActivityItem[] = [];

      for (const p of patientsRes.data ?? []) {
        items.push({ text: `Novo cadastro: ${p.name}`, date: new Date(p.created_at) });
      }
      for (const a of apptsRes.data ?? []) {
        items.push({
          text: `Consulta agendada: ${a.patient_name} (${format(new Date(`${a.appointment_date}T12:00:00`), "dd/MM")})`,
          date: new Date(a.created_at),
        });
      }
      for (const c of consultsRes.data ?? []) {
        const name = (c as any).patients?.name ?? "Paciente";
        items.push({ text: `Prontuário registrado: ${name}`, date: new Date(c.created_at) });
      }
      for (const w of convsRes.data ?? []) {
        items.push({
          text: `Mensagem no WhatsApp: ${w.contact_name || w.phone_number}`,
          date: new Date(w.updated_at),
        });
      }

      return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
    },
  });

  const statCards = [
    { label: "Consultas Hoje", value: stats?.today ?? 0, icon: Calendar, color: "bg-primary/10 text-primary" },
    { label: "Pacientes Cadastrados", value: stats?.patients ?? 0, icon: Users, color: "bg-mint/30 text-secondary-foreground" },
    { label: "Consultas no Mês", value: stats?.month ?? 0, icon: ClipboardList, color: "bg-rose-gold-light text-primary" },
    { label: "Próximos 7 dias", value: stats?.nextWeek ?? 0, icon: CalendarClock, color: "bg-mint-light text-secondary-foreground" },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Bom dia, {displayName}</h1>
        <p className="text-muted-foreground font-body mt-1">Aqui está o resumo do seu dia.</p>
      </div>

      {procedureAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlarmClock className="w-5 h-5 text-amber-700" />
            <h2 className="text-base font-heading font-semibold text-amber-800">
              Pacientes próximas de completar 1 mês da última sessão
            </h2>
          </div>
          <div className="space-y-2">
            {procedureAlerts.map((p) => {
              const overdue = p.daysSince >= PROCEDURE_ALERT_OVERDUE_DAYS;
              return (
                <button
                  key={p.patientId}
                  onClick={() => navigate(`/pacientes/${p.patientId}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white/70 border border-amber-200/70 hover:bg-white transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Syringe className="w-4 h-4 text-amber-700 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        Última sessão{p.procedureType ? ` (${p.procedureType})` : ""} em{" "}
                        {format(p.lastDate, "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full shrink-0 ${
                      overdue ? "bg-destructive/10 text-destructive" : "bg-amber-200/60 text-amber-800"
                    }`}
                  >
                    {overdue ? `Atrasado há ${p.daysSince - 30} dia(s)` : `Faltam ${30 - p.daysSince} dia(s)`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-heading font-semibold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground font-body mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-heading font-semibold text-foreground">Próximas Consultas</h2>
            <button
              onClick={() => navigate("/agenda")}
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver agenda completa
            </button>
          </div>
          {!calendarConnected ? (
            <div className="py-10 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Google Calendar não conectado.</p>
              <button onClick={() => navigate("/agenda")} className="text-xs text-primary hover:underline mt-1">
                Conecte na Agenda para ver suas próximas consultas aqui.
              </button>
            </div>
          ) : upcoming.length === 0 ? (
            <div className="py-10 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta agendada para os próximos 7 dias.</p>
              <p className="text-xs text-muted-foreground mt-1">Novos eventos da sua agenda aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 6).map((e) => {
                const startRaw = e.start.dateTime || e.start.date;
                if (!startRaw) return null;
                const start = new Date(startRaw);
                const isToday = isSameDay(start, new Date());
                const timeLabel = e.start.dateTime ? format(start, "HH:mm") : "Dia todo";
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold text-primary font-body">{timeLabel}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {isToday ? "Hoje" : format(start, "dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.summary || "Sem título"}</p>
                        {e.description && <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>}
                      </div>
                    </div>
                    <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint/30 text-secondary-foreground">
                      Agendado
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-5">Atividade Recente</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada ainda.</p>
          ) : (
            <div className="space-y-4">
              {activities.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm text-foreground">{item.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(item.date, { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
