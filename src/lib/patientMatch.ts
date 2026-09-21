const STOP_WORDS = new Set(["consulta", "retorno", "procedimento", "avaliacao", "outros", "primeira", "primeiro", "+"]);

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().split(/\s+/).filter(Boolean);

// Eventos da agenda vêm como "Tipo: Nome", mas nem sempre completos (ex:
// "Procedimento Fabíola", "Leonil"). Tira as palavras de tipo e casa o que
// sobra com o começo do nome cadastrado. Só devolve o paciente quando há
// exatamente um candidato; se for ambíguo, devolve null.
export function findPatientBySummary<T extends { name: string }>(summary: string | undefined, patients: T[]): T | null {
  if (!summary) return null;
  const text = summary.includes(":") ? summary.slice(summary.lastIndexOf(":") + 1) : summary;
  const tokens = normalize(text).filter((t) => !STOP_WORDS.has(t));
  if (tokens.length === 0) return null;

  const candidates = patients.filter((p) => {
    const nameTokens = normalize(p.name);
    return tokens.length <= nameTokens.length && tokens.every((t, i) => nameTokens[i] === t);
  });
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.filter((p) => normalize(p.name).length === tokens.length);
  return exact.length === 1 ? exact[0] : null;
}
