import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon, Loader2, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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

type ViewMode = "day" | "week" | "month";

const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
};
const endOfWeek = (d: Date) => {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const Agenda = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("day");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [events, setEvents] = useState<GEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ summary: "", description: "", date: "", startTime: "", endTime: "", phone: "", sendWhatsApp: true });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const openCreate = (preset?: { date?: Date; hour?: string }) => {
    const base = preset?.date || currentDate;
    const startTime = preset?.hour || "09:00";
    const [h, m] = startTime.split(":").map(Number);
    const endH = pad((h + 1) % 24);
    setEditingId(null);
    setForm({
      summary: "",
      description: "",
      date: toDateInput(base),
      startTime,
      endTime: `${endH}:${pad(m)}`,
      phone: "",
      sendWhatsApp: true,
    });
    setModalOpen(true);
  };

  const openEdit = (e: GEvent) => {
    const s = new Date(e.start.dateTime || e.start.date!);
    const en = new Date(e.end.dateTime || e.end.date!);
    setEditingId(e.id);
    setForm({
      summary: e.summary || "",
      description: e.description || "",
      date: toDateInput(s),
      startTime: toTimeInput(s),
      endTime: toTimeInput(en),
      phone: "",
      sendWhatsApp: false,
    });
    setModalOpen(true);
  };

  const saveEvent = async () => {
    if (!form.summary || !form.date || !form.startTime || !form.endTime) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    const startDt = new Date(`${form.date}T${form.startTime}:00`);
    const endDt = new Date(`${form.date}T${form.endTime}:00`);
    if (endDt <= startDt) {
      toast({ title: "Horário inválido", description: "O horário de término deve ser depois do início.", variant: "destructive" });
      return;
    }
    if (form.sendWhatsApp && !editingId && !form.phone.trim()) {
      toast({ title: "Telefone obrigatório", description: "Informe o telefone do paciente para enviar a confirmação.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const startDateTime = startDt.toISOString();
      const endDateTime = endDt.toISOString();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-manage${editingId ? `?eventId=${editingId}` : ""}`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: form.summary,
          description: form.description,
          startDateTime,
          endDateTime,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      toast({ title: editingId ? "Evento atualizado" : "Evento criado" });

      if (!editingId && form.sendWhatsApp && form.phone.trim()) {
        try {
          const dateLabel = startDt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
          const timeLabel = startDt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const message = `Olá! Sua consulta com a Dra. Gabrielle Sagrillo está confirmada para ${dateLabel} às ${timeLabel}. Em caso de imprevisto, por favor avise com antecedência. 💛`;
          const phoneDigits = form.phone.replace(/\D/g, "");
          const { error: waErr } = await supabase.functions.invoke("whatsapp-send", {
            body: { phone: phoneDigits, message },
          });
          if (waErr) throw waErr;
          toast({ title: "Confirmação enviada", description: "Mensagem de WhatsApp enviada ao paciente." });
        } catch (waError) {
          toast({
            title: "Evento criado, mas WhatsApp falhou",
            description: waError instanceof Error ? waError.message : "Não foi possível enviar a confirmação.",
            variant: "destructive",
          });
        }
      }

      setModalOpen(false);
      fetchEvents();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-manage?eventId=${id}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      toast({ title: "Evento excluído" });
      setConfirmDeleteId(null);
      fetchEvents();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let start: Date, end: Date;
      if (view === "day") {
        start = new Date(currentDate); start.setHours(0, 0, 0, 0);
        end = new Date(currentDate); end.setHours(23, 59, 59, 999);
      } else if (view === "week") {
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
      } else {
        // month: include leading/trailing weeks for grid
        start = startOfWeek(startOfMonth(currentDate));
        end = endOfWeek(endOfMonth(currentDate));
      }

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
  }, [currentDate, view]);

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

  const navigate = (delta: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "day") d.setDate(d.getDate() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  const eventForHour = (hour: string) => {
    return events.find((e) => {
      const dt = e.start.dateTime || e.start.date;
      if (!dt) return false;
      const d = new Date(dt);
      return sameDay(d, currentDate) && `${d.getHours().toString().padStart(2, "0")}:00` === hour;
    });
  };

  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const dt = e.start.dateTime || e.start.date;
      if (!dt) return false;
      return sameDay(new Date(dt), day);
    });

  const headerLabel = () => {
    if (view === "day")
      return currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(currentDate);
      const e = endOfWeek(currentDate);
      return `${s.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  const weekDays = () => {
    const s = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  };

  const monthDays = () => {
    const s = startOfWeek(startOfMonth(currentDate));
    const e = endOfWeek(endOfMonth(currentDate));
    const days: Date[] = [];
    const cur = new Date(s);
    while (cur <= e) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
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
          {connected && (
            <Button onClick={() => openCreate()} className="gap-2">
              <Plus className="w-4 h-4" /> Novo evento
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-muted rounded-lg p-1">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-body font-medium rounded-md transition-colors ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Hoje
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <p className="text-lg font-heading font-semibold text-foreground text-center capitalize">
            {headerLabel()}
          </p>
          <button onClick={() => navigate(1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : view === "day" ? (
            <div className="space-y-1">
              {hours.map((hour) => {
                const apt = eventForHour(hour);
                return (
                  <div key={hour} className="flex gap-4 min-h-[60px]">
                    <span className="text-xs text-muted-foreground w-14 pt-2 font-body font-medium">{hour}</span>
                    <div className="flex-1 border-t border-border/50 pt-2">
                      {apt ? (
                        <div className="bg-primary/10 border-l-3 border-primary rounded-lg p-3 group flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(apt)}>
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
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(apt)} className="p-1 hover:bg-primary/20 rounded" title="Editar">
                              <Pencil className="w-3.5 h-3.5 text-primary" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(apt.id)} className="p-1 hover:bg-destructive/20 rounded" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => openCreate({ hour })}
                          className="w-full text-left text-xs text-muted-foreground/40 hover:text-primary hover:bg-muted/30 rounded px-2 py-1 transition-colors"
                        >
                          + Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : view === "week" ? (
            <div className="grid grid-cols-7 gap-2">
              {weekDays().map((day) => {
                const dayEvents = eventsForDay(day);
                const isToday = sameDay(day, new Date());
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => { setCurrentDate(day); setView("day"); }}
                    className={`text-left min-h-[140px] rounded-lg border p-2 transition-colors hover:bg-muted/50 ${
                      isToday ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground font-body">{weekdayShort[day.getDay()]}</span>
                      <span className={`text-sm font-heading font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-1 truncate">
                          {e.start.dateTime
                            ? new Date(e.start.dateTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " "
                            : ""}
                          {e.summary || "Sem título"}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} mais</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekdayShort.map((w) => (
                  <div key={w} className="text-xs text-center text-muted-foreground font-body font-medium">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthDays().map((day) => {
                  const dayEvents = eventsForDay(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = sameDay(day, new Date());
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => { setCurrentDate(day); setView("day"); }}
                      className={`text-left min-h-[90px] rounded-lg border p-1.5 transition-colors hover:bg-muted/50 ${
                        isToday ? "border-primary bg-primary/5" : "border-border"
                      } ${!isCurrentMonth ? "opacity-40" : ""}`}
                    >
                      <div className={`text-sm font-heading font-semibold mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div key={e.id} className="text-[10px] bg-primary/10 text-primary rounded px-1 py-0.5 truncate">
                            {e.summary || "Sem título"}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>Os dados são sincronizados com o Google Calendar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="summary">Título *</Label>
              <Input id="summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Consulta - Maria Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Início *</Label>
                <Input id="start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Fim *</Label>
                <Input id="end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Observações</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {!editingId && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sendWhatsApp}
                    onChange={(e) => setForm({ ...form, sendWhatsApp: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-body">Enviar confirmação por WhatsApp ao paciente</span>
                </label>
                {form.sendWhatsApp && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone do paciente *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="Ex: 5527999999999 (DDI + DDD + número)"
                    />
                    <p className="text-xs text-muted-foreground">Inclua o código do país (55 para Brasil) sem espaços ou símbolos.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editingId && (
              <Button variant="destructive" onClick={() => { setModalOpen(false); setConfirmDeleteId(editingId); }} className="mr-auto gap-2">
                <Trash2 className="w-4 h-4" /> Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveEvent} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. O evento será removido do Google Calendar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && deleteEvent(confirmDeleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Agenda;
