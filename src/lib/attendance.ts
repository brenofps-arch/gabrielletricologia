export const ATTENDANCE_OPTIONS = [
  { value: "cancelou", label: "Cancelou" },
  { value: "reagendou", label: "Reagendou" },
  { value: "faltou", label: "Faltou" },
] as const;

export const attendanceLabel = (status: string | null | undefined) =>
  ATTENDANCE_OPTIONS.find((o) => o.value === status)?.label ?? null;

// Cancelamento, reagendamento e falta não contam como atendimento realizado.
export const wasAttended = (c: { attendance_status?: string | null }) => !c.attendance_status;
