import { Calendar, Users, Clock, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const stats = [
  {
    label: "Consultas Hoje",
    value: "8",
    change: "+2",
    up: true,
    icon: Calendar,
    color: "bg-primary/10 text-primary",
  },
  {
    label: "Pacientes Ativos",
    value: "142",
    change: "+12",
    up: true,
    icon: Users,
    color: "bg-mint/30 text-secondary-foreground",
  },
  {
    label: "Tempo Médio",
    value: "45min",
    change: "-5min",
    up: true,
    icon: Clock,
    color: "bg-rose-gold-light text-primary",
  },
  {
    label: "Taxa de Retorno",
    value: "78%",
    change: "+3%",
    up: true,
    icon: TrendingUp,
    color: "bg-mint-light text-secondary-foreground",
  },
];

const upcomingAppointments = [
  { time: "09:00", patient: "Ana Carolina Silva", type: "Consulta Inicial", status: "confirmed" },
  { time: "10:00", patient: "Beatriz Oliveira", type: "Retorno - Queda Capilar", status: "confirmed" },
  { time: "11:00", patient: "Carla Mendes", type: "Tratamento PRP", status: "pending" },
  { time: "14:00", patient: "Diana Ferreira", type: "Avaliação Tricológica", status: "confirmed" },
  { time: "15:30", patient: "Elena Santos", type: "Mesoterapia", status: "pending" },
];

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-mint/30 text-secondary-foreground" },
  pending: { label: "Pendente", className: "bg-rose-gold-light text-primary" },
};

const Index = () => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Bom dia, Dra. Maria</h1>
        <p className="text-muted-foreground font-body mt-1">Aqui está o resumo do seu dia.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                {stat.up ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-secondary-foreground" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                )}
                <span className={stat.up ? "text-secondary-foreground" : "text-destructive"}>{stat.change}</span>
              </div>
            </div>
            <p className="text-2xl font-heading font-semibold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground font-body mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-5">Próximas Consultas</h2>
          <div className="space-y-3">
            {upcomingAppointments.map((apt, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-primary font-body w-14">{apt.time}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{apt.patient}</p>
                    <p className="text-xs text-muted-foreground">{apt.type}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full ${statusLabels[apt.status].className}`}>
                  {statusLabels[apt.status].label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-heading font-semibold text-foreground mb-5">Atividade Recente</h2>
          <div className="space-y-4">
            {[
              { text: "Ana Carolina confirmou consulta", time: "Há 10 min" },
              { text: "Novo cadastro: Marina Costa", time: "Há 30 min" },
              { text: "Prontuário atualizado: Beatriz O.", time: "Há 1h" },
              { text: "Mensagem recebida no WhatsApp", time: "Há 2h" },
              { text: "Consulta finalizada: Julia Lima", time: "Há 3h" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{item.text}</p>
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
