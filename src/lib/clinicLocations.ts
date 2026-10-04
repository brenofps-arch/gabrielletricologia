export const CLINIC_LOCATIONS = [
  { value: "vila_velha", label: "Vila Velha - ES", short: "Vila Velha" },
  { value: "vitoria", label: "Vitória - ES", short: "Vitória" },
  { value: "niteroi", label: "Niterói - RJ", short: "Niterói" },
] as const;

// O paciente pode ser atendido em mais de uma unidade; os valores ficam
// guardados juntos, separados por vírgula (ex: "vitoria,vila_velha").
export const parseClinicLocations = (value: string | null | undefined): string[] =>
  (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

export const serializeClinicLocations = (values: string[]): string =>
  CLINIC_LOCATIONS.map((l) => l.value).filter((v) => values.includes(v)).join(",");

export const clinicLocationShort = (value: string | null | undefined) => {
  const selected = parseClinicLocations(value);
  const names = CLINIC_LOCATIONS.filter((l) => selected.includes(l.value)).map((l) => l.short);
  return names.length > 0 ? names.join(", ") : null;
};
