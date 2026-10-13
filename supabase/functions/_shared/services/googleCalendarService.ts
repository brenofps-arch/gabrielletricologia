// Acesso ao Google Calendar da Dra. a partir das funções do servidor
// (usa o mesmo token guardado quando a agenda foi conectada no app).

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIME_ZONE = "America/Sao_Paulo";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: string; // ISO
  end: string; // ISO
  status?: string;
}

/** "2026-10-14" + "09:00" -> "2026-10-14T09:00:00-03:00" (Brasília, sem horário de verão). */
export function brtDateTime(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}:00-03:00`;
}

export function createGoogleCalendarService(supabase: any, ownerUserId: string) {
  async function getAccessToken(): Promise<string> {
    const { data: row } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (!row) throw new Error("Google Calendar não está conectado. Conecte a agenda no app.");

    if (new Date(row.expires_at) > new Date(Date.now() + 60000)) return row.access_token;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "",
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshed = await res.json();
    if (!refreshed.access_token) {
      throw new Error("Não consegui renovar o acesso ao Google Calendar. Reconecte a agenda no app.");
    }
    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("user_id", ownerUserId);
    return refreshed.access_token;
  }

  async function listEvents(timeMinIso: string, timeMaxIso: string): Promise<CalendarEvent[]> {
    const token = await getAccessToken();
    const url =
      `${CALENDAR_BASE}?timeMin=${encodeURIComponent(timeMinIso)}&timeMax=${encodeURIComponent(timeMaxIso)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=250`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao ler a agenda");
    return (data.items ?? [])
      .filter((e: any) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
      .map((e: any) => ({
        id: e.id,
        summary: e.summary ?? "(sem título)",
        description: e.description ?? "",
        start: e.start.dateTime ?? `${e.start.date}T00:00:00-03:00`,
        end: e.end?.dateTime ?? `${e.end?.date ?? e.start.date}T00:00:00-03:00`,
        status: e.status,
      }));
  }

  async function createEvent(input: { summary: string; description?: string; startIso: string; endIso: string }) {
    const token = await getAccessToken();
    const res = await fetch(CALENDAR_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description ?? "",
        start: { dateTime: input.startIso, timeZone: TIME_ZONE },
        end: { dateTime: input.endIso, timeZone: TIME_ZONE },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao criar o evento");
    return data as { id: string };
  }

  async function updateEventTimes(eventId: string, startIso: string, endIso: string) {
    const token = await getAccessToken();
    const res = await fetch(`${CALENDAR_BASE}/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: startIso, timeZone: TIME_ZONE },
        end: { dateTime: endIso, timeZone: TIME_ZONE },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao remarcar o evento");
    return data as { id: string };
  }

  async function deleteEvent(eventId: string) {
    const token = await getAccessToken();
    const res = await fetch(`${CALENDAR_BASE}/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 410) {
      const txt = await res.text();
      throw new Error(`Google: ${txt.slice(0, 200)}`);
    }
  }

  return { listEvents, createEvent, updateEventTimes, deleteEvent };
}
