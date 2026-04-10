import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hours = Array.from({ length: 10 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

const appointments: Record<string, { time: string; patient: string; type: string; duration: number }[]> = {
  "2026-04-10": [
    { time: "09:00", patient: "Ana Carolina", type: "Consulta Inicial", duration: 60 },
    { time: "11:00", patient: "Carla Mendes", type: "PRP", duration: 45 },
    { time: "14:00", patient: "Diana Ferreira", type: "Avaliação", duration: 30 },
  ],
  "2026-04-11": [
    { time: "10:00", patient: "Elena Santos", type: "Mesoterapia", duration: 60 },
    { time: "15:00", patient: "Fernanda Alves", type: "Retorno", duration: 30 },
  ],
};

const Agenda = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 10));
  const dateKey = currentDate.toISOString().split("T")[0];
  const dayAppointments = appointments[dateKey] || [];

  const changeDay = (delta: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-foreground">Agenda</h1>
          <p className="text-muted-foreground font-body mt-1">Gerencie seus horários e consultas.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Nova Consulta
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <button onClick={() => changeDay(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <p className="text-lg font-heading font-semibold text-foreground">
              {currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <button onClick={() => changeDay(1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          <div className="space-y-1">
            {hours.map((hour) => {
              const apt = dayAppointments.find((a) => a.time === hour);
              return (
                <div key={hour} className="flex gap-4 min-h-[60px]">
                  <span className="text-xs text-muted-foreground w-14 pt-2 font-body font-medium">{hour}</span>
                  <div className="flex-1 border-t border-border/50 pt-2">
                    {apt ? (
                      <div className="bg-primary/10 border-l-3 border-primary rounded-lg p-3 cursor-pointer hover:bg-primary/15 transition-colors">
                        <p className="text-sm font-medium text-foreground">{apt.patient}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">{apt.type}</p>
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Clock className="w-3 h-3" />
                            {apt.duration}min
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agenda;
