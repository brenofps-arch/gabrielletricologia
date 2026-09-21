import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logoBase64 from "@/lib/logoBase64";
import { anamnesisLabels, type AnamnesisData } from "@/components/patient/AnamnesisModal";

const HEADING_FONT = "PlayfairDisplay";
const BODY_FONT = "Montserrat";
const PHOTOS_BUCKET = "consultation-photos";
const LAB_EXAMS_BUCKET = "lab-exams";

const REFERRAL_LABELS: Record<string, string> = {
  indicacao: "Indicação de paciente",
  google: "Google / Busca online",
  anuncio: "Anúncio (Instagram / Facebook)",
  instagram_organico: "Instagram (perfil orgânico)",
  tiktok: "TikTok",
  indicacao_medico: "Indicação médica",
  retorno: "Retorno de paciente antigo",
  outro: "Outro",
};

// Mesmo padrão do PDF de orçamento: começa a carregar as fontes assim que o arquivo é importado.
const fontModulesPromise = Promise.all([
  import("@/lib/playfairFontBase64"),
  import("@/lib/bodyFontsBase64"),
]);

async function registerFonts(doc: jsPDF) {
  const [{ PLAYFAIR_REGULAR, PLAYFAIR_BOLD }, { MONTSERRAT_REGULAR, MONTSERRAT_BOLD }] = await fontModulesPromise;
  doc.addFileToVFS("PlayfairDisplay-Regular.ttf", PLAYFAIR_REGULAR);
  doc.addFont("PlayfairDisplay-Regular.ttf", HEADING_FONT, "normal");
  doc.addFileToVFS("PlayfairDisplay-Bold.ttf", PLAYFAIR_BOLD);
  doc.addFont("PlayfairDisplay-Bold.ttf", HEADING_FONT, "bold");
  doc.addFileToVFS("Montserrat-Regular.ttf", MONTSERRAT_REGULAR);
  doc.addFont("Montserrat-Regular.ttf", BODY_FONT, "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", MONTSERRAT_BOLD);
  doc.addFont("Montserrat-Bold.ttf", BODY_FONT, "bold");
}

type Rgb = [number, number, number];
const ROSE: Rgb = [178, 133, 104];
const ROSE_LIGHT: Rgb = [232, 213, 202];
const ROSE_PALE: Rgb = [250, 246, 243];
const TITLE: Rgb = [161, 143, 127];
const DARK: Rgb = [45, 35, 30];
const MUTED: Rgb = [140, 125, 115];

interface LoadedImage {
  data: string;
  width: number;
  height: number;
}

// Reduz a foto para caber no PDF sem estourar o tamanho do arquivo.
async function toJpeg(blob: Blob, maxSide = 1000): Promise<LoadedImage | null> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { data: canvas.toDataURL("image/jpeg", 0.75), width, height };
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const formatBirth = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");

const ageFrom = (birth: string) => {
  const b = new Date(`${birth}T12:00:00`);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
};

export async function buildMedicalRecordPDF(patientId: string, onProgress?: (message: string) => void) {
  onProgress?.("Carregando dados do paciente...");
  const [patientRes, consultationsRes, photosRes, labsRes, rxRes] = await Promise.all([
    supabase.from("patients").select("*").eq("id", patientId).single(),
    supabase.from("consultations").select("*").eq("patient_id", patientId)
      .order("consultation_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("consultation_photos").select("*").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("lab_exams").select("*").eq("patient_id", patientId).order("exam_date", { ascending: true }),
    supabase.from("prescriptions").select("*, prescription_items(*)").eq("patient_id", patientId).order("prescribed_at", { ascending: true }),
  ]);
  if (patientRes.error || !patientRes.data) throw patientRes.error ?? new Error("Paciente não encontrado");
  if (consultationsRes.error) throw consultationsRes.error;

  const patient = patientRes.data;
  const consultations = consultationsRes.data ?? [];
  const photos = photosRes.data ?? [];
  const labs = labsRes.data ?? [];
  const prescriptions = rxRes.data ?? [];
  const anamnesis = (patient.anamnesis ?? {}) as unknown as Partial<AnamnesisData>;

  const labImages = labs.filter((l) => l.file_type?.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(l.file_name));
  const totalDownloads = photos.length + labImages.length;
  let downloaded = 0;
  const downloadImage = async (bucket: string, path: string) => {
    const { data } = await supabase.storage.from(bucket).download(path);
    const image = data ? await toJpeg(data) : null;
    downloaded++;
    onProgress?.(`Baixando fotos e anexos (${downloaded}/${totalDownloads})...`);
    return image;
  };
  const photoImages = await mapLimit(photos, 4, (p) => downloadImage(PHOTOS_BUCKET, p.file_path));
  const labImageById = new Map<string, LoadedImage | null>();
  const labResults = await mapLimit(labImages, 4, (l) => downloadImage(LAB_EXAMS_BUCKET, l.file_path));
  labImages.forEach((l, i) => labImageById.set(l.id, labResults[i]));

  const photosByConsultation = new Map<string, (LoadedImage | null)[]>();
  photos.forEach((p, i) => {
    const list = photosByConsultation.get(p.consultation_id) ?? [];
    list.push(photoImages[i]);
    photosByConsultation.set(p.consultation_id, list);
  });

  onProgress?.("Montando o documento...");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registerFonts(doc);

  const PW = 210;
  const PH = 297;
  const M = 18;
  const CW = PW - 2 * M;
  const TOP = 20;
  const BOTTOM = PH - 18;
  let y = TOP;

  const setText = (font: string, style: "normal" | "bold", size: number, color: Rgb) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const ensure = (height: number) => {
    if (y + height > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  const wrapped = (text: string, indent = 0, size = 9.5, lineHeight = 4.7, color: Rgb = DARK) => {
    setText(BODY_FONT, "normal", size, color);
    for (const paragraph of text.split("\n")) {
      if (!paragraph.trim()) {
        y += 1.8;
        continue;
      }
      for (const line of doc.splitTextToSize(paragraph.trim(), CW - indent) as string[]) {
        ensure(lineHeight);
        doc.text(line, M + indent, y);
        y += lineHeight;
      }
    }
  };

  const labelValue = (label: string, value: string, indent = 6) => {
    const size = 9.5;
    const lineHeight = 4.7;
    setText(BODY_FONT, "bold", size, DARK);
    const prefix = `${label}: `;
    const prefixWidth = doc.getTextWidth(prefix);
    setText(BODY_FONT, "normal", size, DARK);
    const lines = doc.splitTextToSize(value, CW - indent - prefixWidth) as string[];
    lines.forEach((line, i) => {
      ensure(lineHeight);
      if (i === 0) {
        setText(BODY_FONT, "normal", size, ROSE);
        doc.text("•", M + indent - 4, y);
        setText(BODY_FONT, "bold", size, DARK);
        doc.text(prefix, M + indent, y);
        setText(BODY_FONT, "normal", size, DARK);
      }
      doc.text(line, M + indent + prefixWidth, y);
      y += lineHeight;
    });
  };

  const isHeadingLine = (line: string) =>
    (line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line) && line.length < 50) ||
    (line.endsWith(":") && line.length < 50);

  // Campos de exame vêm como "• Rótulo: valor" com cabeçalhos em maiúsculas.
  const richText = (text: string) => {
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) {
        y += 1.8;
        continue;
      }
      if (line.startsWith("• ")) {
        const content = line.slice(2);
        const idx = content.indexOf(":");
        if (idx > -1) labelValue(content.slice(0, idx), content.slice(idx + 1).trim());
        else wrapped(content, 6);
      } else if (isHeadingLine(line)) {
        y += 1.5;
        ensure(6);
        setText(BODY_FONT, "bold", 8.5, ROSE);
        doc.text(line.toUpperCase(), M, y);
        y += 5;
      } else {
        wrapped(line);
      }
    }
  };

  const fieldBlock = (title: string, text: string) => {
    ensure(12);
    y += 1.5;
    setText(BODY_FONT, "bold", 7.5, MUTED);
    doc.text(title.toUpperCase(), M, y);
    y += 4.5;
    if (text.includes("• ")) richText(text);
    else wrapped(text);
    y += 2;
  };

  const sectionTitle = (title: string) => {
    ensure(20);
    y += 6;
    setText(HEADING_FONT, "bold", 14, TITLE);
    doc.text(title, M, y);
    y += 2.5;
    doc.setDrawColor(...ROSE_LIGHT);
    doc.setLineWidth(0.4);
    doc.line(M, y, PW - M, y);
    y += 6;
  };

  const photoGrid = (images: (LoadedImage | null)[]) => {
    const cols = 3;
    const gap = 3;
    const cell = (CW - gap * (cols - 1)) / cols;
    for (let i = 0; i < images.length; i += cols) {
      ensure(cell + gap);
      images.slice(i, i + cols).forEach((img, j) => {
        const x = M + j * (cell + gap);
        doc.setDrawColor(...ROSE_LIGHT);
        doc.setLineWidth(0.3);
        doc.setFillColor(...ROSE_PALE);
        doc.roundedRect(x, y, cell, cell, 1.5, 1.5, "FD");
        if (!img) {
          setText(BODY_FONT, "normal", 7, MUTED);
          doc.text("Imagem não incluída", x + cell / 2, y + cell / 2, { align: "center" });
          return;
        }
        const ratio = Math.min(cell / img.width, cell / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        doc.addImage(img.data, "JPEG", x + (cell - w) / 2, y + (cell - h) / 2, w, h);
      });
      y += cell + gap;
    }
  };

  // ── Cabeçalho ────────────────────────────────────────────────────────
  doc.addImage(logoBase64, "JPEG", PW - M - 22, 12, 22, 22);
  setText(HEADING_FONT, "bold", 22, TITLE);
  doc.text("Prontuário do Paciente", M, 24);
  setText(BODY_FONT, "normal", 9, MUTED);
  doc.text("Dra. Gabrielle Sagrillo  ·  Tricologia e Medicina Capilar  ·  CRM 18090-ES", M, 31);
  doc.setDrawColor(...ROSE_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(M, 37, PW - M, 37);
  y = 44;

  // ── Dados do paciente ────────────────────────────────────────────────
  const procedureCount = consultations.filter((c) => c.visit_type === "procedimento").length;
  const info: [string, string][] = [
    ["CPF", patient.cpf || "—"],
    ["Nascimento", patient.birth_date ? `${formatBirth(patient.birth_date)} (${ageFrom(patient.birth_date)} anos)` : "—"],
    ["Telefone", patient.phone || "—"],
    ["E-mail", patient.email || "—"],
    ["Origem", (patient.referral_source && (REFERRAL_LABELS[patient.referral_source] ?? patient.referral_source)) || "—"],
    ["Sessões de procedimento", String(procedureCount)],
  ];
  const boxTop = y;
  const boxHeight = 12 + Math.ceil(info.length / 2) * 11 + 3;
  doc.setFillColor(...ROSE_PALE);
  doc.setDrawColor(...ROSE_LIGHT);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, boxTop, CW, boxHeight, 2.5, 2.5, "FD");
  setText(HEADING_FONT, "bold", 15, DARK);
  doc.text(patient.name, M + 6, boxTop + 9);
  info.forEach(([label, value], i) => {
    const x = M + 6 + (i % 2) * (CW / 2);
    const rowY = boxTop + 17 + Math.floor(i / 2) * 11;
    setText(BODY_FONT, "bold", 7, MUTED);
    doc.text(label.toUpperCase(), x, rowY);
    setText(BODY_FONT, "normal", 9.5, DARK);
    doc.text(doc.splitTextToSize(value, CW / 2 - 8)[0] as string, x, rowY + 4.5);
  });
  y = boxTop + boxHeight + 4;

  if (patient.diagnosis) fieldBlock("Diagnóstico clínico", patient.diagnosis);
  if (patient.important_notes) fieldBlock("Notas importantes (alergias / comorbidades / observações)", patient.important_notes);

  // ── Anamnese ─────────────────────────────────────────────────────────
  const anamnesisEntries = (Object.keys(anamnesisLabels) as (keyof AnamnesisData)[])
    .filter((k) => typeof anamnesis[k] === "string" && anamnesis[k]!.trim())
    .map((k) => [anamnesisLabels[k], anamnesis[k]!.trim()] as [string, string]);
  if (anamnesisEntries.length > 0) {
    sectionTitle("Anamnese");
    if (patient.anamnesis_completed_at) {
      wrapped(`Concluída em ${formatDate(patient.anamnesis_completed_at)}`, 0, 8.5, 4.5, MUTED);
      y += 1.5;
    }
    for (const [label, value] of anamnesisEntries) {
      ensure(12);
      setText(BODY_FONT, "bold", 7.5, MUTED);
      doc.text(label, M, y);
      y += 4.2;
      wrapped(value);
      y += 1.8;
    }
  }

  // ── Consultas e procedimentos ────────────────────────────────────────
  if (consultations.length > 0) {
    sectionTitle("Consultas e Procedimentos");
    consultations.forEach((c) => {
      let heading = `${formatDate(c.consultation_date)}  —  Consulta`;
      if (c.visit_type === "retorno") heading = `${formatDate(c.consultation_date)}  —  Retorno`;
      if (c.visit_type === "procedimento") {
        heading = `${formatDate(c.consultation_date)}  —  Procedimento${c.procedure_type ? `: ${c.procedure_type}` : ""}${
          c.procedure_number ? `  ·  Sessão nº ${c.procedure_number}` : ""
        }`;
      }

      ensure(34);
      y += 2;
      doc.setFillColor(...ROSE_PALE);
      doc.setDrawColor(...ROSE_LIGHT);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 5, CW, 9, 2, 2, "FD");
      setText(BODY_FONT, "bold", 10.5, DARK);
      doc.text(heading, M + 4, y + 1);
      y += 8;

      let fields: [string, string | null][];
      if (c.visit_type === "retorno") {
        fields = [
          ["Queixa", c.chief_complaint],
          ["Exame Físico", c.physical_exam],
          ["Exames Laboratoriais", c.exams_brought],
          ["Conduta", c.treatment_plan],
          ["Prescrição", c.prescription_notes],
        ];
      } else if (c.visit_type === "procedimento") {
        fields = [
          ["Medicações Usadas no Procedimento", c.procedure_medications],
          ["Exames Laboratoriais", c.exams_brought],
          ["Observações", c.observations],
          ["Conduta", c.treatment_plan],
          ["Prescrição", c.prescription_notes],
        ];
      } else {
        fields = [
          ["Diagnóstico", c.diagnosis],
          ["Histórico da Doença Atual", c.chief_complaint],
          ["Exame Físico (Tricológico)", c.physical_exam],
          ["Conduta / Plano Terapêutico", c.treatment_plan],
          ["Prescrição", c.prescription_notes],
          ["Exames Trazidos pelo Paciente", c.exams_brought],
          ["Observações", c.observations],
        ];
      }
      for (const [title, text] of fields) if (text?.trim()) fieldBlock(title, text);

      const images = photosByConsultation.get(c.id);
      if (images && images.length > 0) {
        ensure(70);
        setText(BODY_FONT, "bold", 7.5, MUTED);
        doc.text(`ARQUIVOS ANEXADOS (${images.length})`, M, y);
        y += 4;
        photoGrid(images);
      }
      y += 4;
    });
  }

  // ── Exames laboratoriais anexados ────────────────────────────────────
  if (labs.length > 0) {
    sectionTitle("Exames Laboratoriais Anexados");
    labs.forEach((l) => {
      ensure(14);
      const date = l.exam_date ? formatBirth(l.exam_date) : "Sem data";
      labelValue(date, l.file_name, 4);
      if (l.notes?.trim()) wrapped(l.notes.trim(), 4, 8.5, 4.3, MUTED);
      const img = labImageById.get(l.id);
      if (img) {
        y += 1;
        photoGrid([img]);
      } else if (!labImages.some((x) => x.id === l.id)) {
        wrapped("Arquivo anexado ao sistema (não incluído neste documento).", 4, 8, 4.2, MUTED);
      }
      y += 2;
    });
  }

  // ── Receitas emitidas ────────────────────────────────────────────────
  if (prescriptions.length > 0) {
    sectionTitle("Receitas Emitidas");
    prescriptions.forEach((rx) => {
      ensure(16);
      setText(BODY_FONT, "bold", 9.5, DARK);
      doc.text(`${formatDate(rx.prescribed_at)}${rx.doctor_name ? `  ·  ${rx.doctor_name}` : ""}`, M, y);
      y += 5;
      for (const item of (rx.prescription_items ?? []) as { medication_name: string; dosage?: string | null; posology?: string | null; duration?: string | null }[]) {
        const details = [item.dosage, item.posology, item.duration].filter(Boolean).join(" · ");
        wrapped(`${item.medication_name}${details ? ` — ${details}` : ""}`, 4);
      }
      if (rx.notes?.trim()) wrapped(rx.notes.trim(), 4, 8.5, 4.3, MUTED);
      y += 3;
    });
  }

  // ── Rodapé em todas as páginas ───────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...ROSE_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, PH - 14, PW - M, PH - 14);
    setText(BODY_FONT, "normal", 7.5, MUTED);
    doc.text(`Prontuário de ${patient.name}  ·  emitido em ${new Date().toLocaleDateString("pt-BR")}`, M, PH - 9);
    doc.text(`Página ${i} de ${totalPages}`, PW - M, PH - 9, { align: "right" });
  }

  const safeName = patient.name.replace(/\s+/g, "_");
  return { doc, fileName: `prontuario_${safeName}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf` };
}

export async function downloadMedicalRecordPDF(patientId: string, onProgress?: (message: string) => void) {
  const { doc, fileName } = await buildMedicalRecordPDF(patientId, onProgress);
  doc.save(fileName);
}
