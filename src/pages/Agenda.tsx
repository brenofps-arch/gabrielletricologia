import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";

const hours = Array.from({ length: 12 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

interface GEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

const Agenda = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<GEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        method: "GET" as any,
        body: undefined,
        // pass query via URL
      });

      // fallback: invoke doesn't support query easily — call via fetch
      const session = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setConnected(json.connected);
      setEvents(json.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentDate]);

  useEffect(() => {
    const status = searchParams.get("google");
    if (status === "success") {
      toast({ title: "Google Calendar conectado!", description: "Suas consultas estão sincronizadas." });
      setSearchParams({});
      fetchEvents();
    } else if (status === "error") {
      toast({ title: "Erro ao conectar", description: "Tente novamente.", variant: "destructive" });
      setSearchParams({});
    }
  }, [searchParams]);

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível iniciar a conexão.", variant: "destructive" });
      setConnecting(false);
    }
  };

  const changeDay = (delta: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const eventForHour = (hour: string) => {
    return events.find((e) => {
      const dt = e.start.dateTime || e.start.date;
      if (!dt) return false;
      const d = new Date(dt);
      return `${d.getHours().toString().padStart(2, "0")}:00` === hour;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-foreground">Agenda</h1>
          <p className="text-muted-foreground font-body mt-1">
            {connected ? "Sincronizada com seu Google Calendar." : "Conecte seu Google Calendar para sincronizar."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected === false && (
            <Button onClick={connectGoogle} disabled={connecting} className="gap-2">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
              Conectar Google Calendar
            </Button>
          )}
          {connected && (
            <span className="flex items-center gap-1.5 text-sm text-primary font-medium">
              <CheckCircle2 className="w-4 h-4" /> Conectada
            </span>
          )}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <button onClick={() => changeDay(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <p className="text-lg font-heading font-semibold text-foreground text-center">
            {currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <button onClick={() => changeDay(1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1">
              {hours.map((hour) => {
                const apt = eventForHour(hour);
                return (
                  <div key={hour} className="flex gap-4 min-h-[60px]">
                    <span className="text-xs text-muted-foreground w-14 pt-2 font-body font-medium">{hour}</span>
                    <div className="flex-1 border-t border-border/50 pt-2">
                      {apt ? (
                        <div className="bg-primary/10 border-l-3 border-primary rounded-lg p-3 cursor-pointer hover:bg-primary/15 transition-colors">
                          <p className="text-sm font-medium text-foreground">{apt.summary || "Sem título"}</p>
                          {apt.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{apt.description}</p>
                          )}
                          <span className="flex items-center gap-1 text-xs text-primary mt-1">
                            <Clock className="w-3 h-3" />
                            {apt.start.dateTime
                              ? new Date(apt.start.dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                              : "Dia todo"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;
