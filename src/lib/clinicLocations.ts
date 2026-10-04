export const CLINIC_LOCATIONS = [
  { value: "vila_velha", label: "Vila Velha - ES", short: "Vila Velha" },
  { value: "vitoria", label: "Vitória - ES", short: "Vitória" },
  { value: "niteroi", label: "Niterói - RJ", short: "Niterói" },
] as const;

export const clinicLocationShort = (value: string | null | undefined) =>
  CLINIC_LOCATIONS.find((l) => l.value === value)?.short ?? null;
