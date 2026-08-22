import { Calendar, Users, ClipboardList, CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const { data: upcoming = [] } = useQuery({
    queryKey: ["dashboard-upcoming", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, patient_name, chief_complaint, appointment_date, appointment_time, status")
        .gte("appointment_date", today)
        .neq("status", "cancelled")
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

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
          {upcoming.length === 0 ? (
            <div className="py-10 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta agendada.</p>
              <p className="text-xs text-muted-foreground mt-1">Novas consultas aparecerão aqui automaticamente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((apt) => {
                const st = statusLabels[apt.status] ?? statusLabels.pending;
                const isToday = apt.appointment_date === today;
                return (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 shrink-0">
                        <p className="text-sm font-semibold text-primary font-body">
                          {String(apt.appointment_time).slice(0, 5)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {isToday ? "Hoje" : format(new Date(`${apt.appointment_date}T12:00:00`), "dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{apt.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{apt.chief_complaint || "Consulta"}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${st.className}`}>
                      {st.label}
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
