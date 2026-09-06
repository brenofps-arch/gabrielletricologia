import jsPDF from "jspdf";
import logoBase64 from "@/lib/logoBase64";

interface QuotePDFData {
  patientName: string;
  date: string;
  validityDays: number;
  includedItems: string;
  packageName: string;
  priceFull: number | null;
  price3x?: number | null;
  price6x?: number | null;
  pixKey?: string | null;
  paymentMethods: string;
  notes?: string | null;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const HEADING_FONT = "PlayfairDisplay";
const BODY_FONT = "Montserrat";
const FOOTER_FONT = "JuliusSansOne";

// Cada coluna: cidade em destaque no topo, seguida das linhas do endereço.
const CLINIC_ADDRESSES: { city: string; lines: string[] }[] = [
  { city: "Vila Velha - ES", lines: ["Ed. MQ Business - Sala 114", "Rua Professor Telmo de Souza Torres, 255, Praia da Costa"] },
  { city: "Vitória - ES", lines: ["Ed. Victória Office Tower - Torre Leste, Sala 305", "Av. Américo Buaiz, 501, Enseada do Suá"] },
  { city: "Niterói - RJ", lines: ["Edifício Central Park - Sala 310", "Rua Otávio Carneiro, 143, Icaraí"] },
];

let fontsRegistered = false;
async function ensureHeadingFont(doc: jsPDF) {
  if (fontsRegistered) return;
  const { PLAYFAIR_REGULAR, PLAYFAIR_BOLD } = await import("@/lib/playfairFontBase64");
  doc.addFileToVFS("PlayfairDisplay-Regular.ttf", PLAYFAIR_REGULAR);
  doc.addFont("PlayfairDisplay-Regular.ttf", HEADING_FONT, "normal");
  doc.addFileToVFS("PlayfairDisplay-Bold.ttf", PLAYFAIR_BOLD);
  doc.addFont("PlayfairDisplay-Bold.ttf", HEADING_FONT, "bold");

  const { MONTSERRAT_REGULAR, MONTSERRAT_BOLD, JULIUS_SANS_ONE_REGULAR } = await import("@/lib/bodyFontsBase64");
  doc.addFileToVFS("Montserrat-Regular.ttf", MONTSERRAT_REGULAR);
  doc.addFont("Montserrat-Regular.ttf", BODY_FONT, "normal");
  doc.addFileToVFS("Montserrat-Bold.ttf", MONTSERRAT_BOLD);
  doc.addFont("Montserrat-Bold.ttf", BODY_FONT, "bold");
  doc.addFileToVFS("JuliusSansOne-Regular.ttf", JULIUS_SANS_ONE_REGULAR);
  doc.addFont("JuliusSansOne-Regular.ttf", FOOTER_FONT, "normal");

  fontsRegistered = true;
}

export async function generateQuotePDF(data: QuotePDFData) {
  const doc = new jsPDF();
  await ensureHeadingFont(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 0;

  const brandRose: [number, number, number] = [178, 133, 104];
  const brandRoseLight: [number, number, number] = [232, 213, 202];
  const brandRosePale: [number, number, number] = [250, 246, 243];
  const footerBrown: [number, number, number] = [213, 196, 175]; // #d5c4af
  const titleColor: [number, number, number] = [161, 143, 127]; // #a18f7f
  const textDark: [number, number, number] = [45, 35, 30];
  const textMuted: [number, number, number] = [140, 125, 115];

  const drawWatermark = () => {
    const watermarkSize = 130;
    const wmX = pageWidth * 0.52;
    const wmY = pageHeight * 0.4;
    const gState = (doc as any).GState({ opacity: 0.05 });
    doc.saveGraphicsState();
    doc.setGState(gState);
    doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
    doc.restoreGraphicsState();
  };

  // ── CABEÇALHO (consolidado) ───────────────────────────────────────
  doc.addImage(logoBase64, "JPEG", pageWidth - margin - 26, 14, 26, 26);

  y = 30;
  doc.setFontSize(19);
  doc.setFont(HEADING_FONT, "bold");
  doc.setTextColor(...titleColor);
  doc.text("Orçamento", pageWidth / 2, y, { align: "center" });

  y += 13;
  doc.setFontSize(13);
  doc.text("Acompanhamento com a Dra Gabrielle Sagrillo", pageWidth / 2, y, { align: "center" });
  y += 6.5;
  doc.text("Tricologia e Medicina Capilar", pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.4);
  doc.line(margin + 35, y, pageWidth - margin - 35, y);

  y += 6;
  doc.setFontSize(10.5);
  doc.setFont(BODY_FONT, "normal");
  doc.setTextColor(...textMuted);
  doc.text(`Paciente: ${data.patientName}`, pageWidth / 2, y, { align: "center" });

  y += 5.5;
  doc.setFontSize(8);
  doc.text(`Emitido em ${data.date}  ·  Válido por ${data.validityDays} dias`, pageWidth / 2, y, { align: "center" });

  // ── O QUE ESTÁ INCLUSO ───────────────────────────────────────────
  y += 16;
  doc.setFontSize(11.5);
  doc.setFont(HEADING_FONT, "bold");
  doc.setTextColor(...textDark);
  doc.text("O que está incluso", margin, y);

  const includedLines = data.includedItems
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  doc.setFontSize(10);
  doc.setFont(BODY_FONT, "normal");
  const includedWrapped = includedLines.flatMap((line) =>
    doc.splitTextToSize(line, contentWidth - 20)
  );

  y += 6;
  const includedBoxTop = y;
  const includedBoxHeight = includedWrapped.length * 6.5 + 10;
  doc.setFillColor(...brandRosePale);
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, includedBoxTop, contentWidth, includedBoxHeight, 2.5, 2.5, "FD");

  let iy = includedBoxTop + 8;
  doc.setTextColor(...textDark);
  includedWrapped.forEach((line: string) => {
    doc.setFont(BODY_FONT, "bold");
    doc.text("–", margin + 6, iy);
    doc.setFont(BODY_FONT, "normal");
    doc.text(line, margin + 12, iy);
    iy += 6.5;
  });
  y = includedBoxTop + includedBoxHeight + 12;

  // ── INVESTIMENTO ─────────────────────────────────────────────────
  doc.setFontSize(11.5);
  doc.setFont(HEADING_FONT, "bold");
  doc.setTextColor(...textDark);
  doc.text("Investimento", margin, y);

  y += 6;
  const investBoxTop = y;
  let investBoxHeight = 10;
  if (data.packageName.trim()) investBoxHeight += 6.5;
  if (data.priceFull != null) investBoxHeight += 13;
  if (data.price3x != null) investBoxHeight += 6.5;
  if (data.price6x != null) investBoxHeight += 6.5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...brandRose);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, investBoxTop, contentWidth, investBoxHeight, 2.5, 2.5, "FD");

  let vy = investBoxTop + 8;
  if (data.packageName.trim()) {
    doc.setFontSize(9.5);
    doc.setFont(BODY_FONT, "bold");
    doc.setTextColor(...textMuted);
    doc.text(data.packageName, margin + 8, vy);
    vy += 9;
  }
  if (data.priceFull != null) {
    doc.setFontSize(20);
    doc.setFont(HEADING_FONT, "bold");
    doc.setTextColor(...brandRose);
    const priceStr = formatBRL(data.priceFull);
    doc.text(priceStr, margin + 8, vy);
    const priceWidth = doc.getTextWidth(priceStr);
    doc.setFontSize(10);
    doc.setFont(BODY_FONT, "normal");
    doc.setTextColor(...textMuted);
    doc.text("à vista", margin + 8 + priceWidth + 3, vy);
    vy += 9.5;
  }
  doc.setFontSize(9.5);
  doc.setFont(BODY_FONT, "normal");
  doc.setTextColor(...textMuted);
  if (data.price3x != null) {
    doc.text(`ou em até 3x de ${formatBRL(data.price3x / 3)} (total ${formatBRL(data.price3x)})`, margin + 8, vy);
    vy += 6.5;
  }
  if (data.price6x != null) {
    doc.text(`ou em até 6x de ${formatBRL(data.price6x / 6)} (total ${formatBRL(data.price6x)})`, margin + 8, vy);
    vy += 6.5;
  }
  y = investBoxTop + investBoxHeight + 12;

  // A marca d'água é desenhada depois das caixas acima para que a logo apareça
  // por cima delas (e não fique escondida atrás do preenchimento das caixas).
  drawWatermark();

  // ── FORMAS DE PAGAMENTO ──────────────────────────────────────────
  doc.setFontSize(11.5);
  doc.setFont(HEADING_FONT, "bold");
  doc.setTextColor(...textDark);
  doc.text("Formas de Pagamento", margin, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont(BODY_FONT, "normal");
  doc.setTextColor(...textDark);
  if (data.pixKey?.trim()) {
    doc.setFont(BODY_FONT, "bold");
    doc.text("Chave PIX (CNPJ):", margin, y);
    doc.setFont(BODY_FONT, "normal");
    doc.text(data.pixKey, margin + doc.getTextWidth("Chave PIX (CNPJ): ") + 2, y);
    y += 6.5;
  }
  if (data.paymentMethods?.trim()) {
    doc.setFont(BODY_FONT, "normal");
    const payLines = doc.splitTextToSize(data.paymentMethods, contentWidth);
    doc.text(payLines, margin, y);
    y += payLines.length * 6.5;
  }

  // ── OBSERVAÇÕES ──────────────────────────────────────────────────
  if (data.notes?.trim()) {
    y += 8;
    doc.setFontSize(11.5);
    doc.setFont(HEADING_FONT, "bold");
    doc.setTextColor(...textDark);
    doc.text("Observações", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(BODY_FONT, "normal");
    doc.setTextColor(...textDark);
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 6.5;
  }

  // ── RODAPÉ (faixa com endereços) ──────────────────────────────────
  const footerIndent = margin + 12;
  const addrColGap = 10;
  const addrColWidth = (pageWidth - footerIndent - margin - 2 * addrColGap) / 3;
  const addrLineHeight = 3.7;

  doc.setFontSize(7);
  const wrappedAddresses = CLINIC_ADDRESSES.map((col) => ({
    city: col.city,
    lines: col.lines.map((line) => doc.splitTextToSize(line, addrColWidth) as string[]),
  }));
  const maxAddrLines = Math.max(
    ...wrappedAddresses.map((col) => 1 + col.lines.flat().length) // +1 para a linha da cidade
  );

  // Offsets relativos ao topo da faixa (calculados antes de sabermos a altura final da faixa)
  const offName = 11.5;
  const offMedicina = offName + 5;
  const offAddrStart = offMedicina + 7;
  const offAfterAddr = offAddrStart + maxAddrLines * addrLineHeight;
  const offTelefone = offAfterAddr + 4.5;
  const footerHeight = offTelefone + 6;
  const footerTop = pageHeight - footerHeight;

  doc.setFillColor(...footerBrown);
  doc.rect(0, footerTop, pageWidth, footerHeight, "F");

  doc.setFontSize(15);
  doc.setFont(FOOTER_FONT, "normal");
  doc.setTextColor(...textDark);
  doc.setCharSpace(2);
  doc.text("DRA. GABRIELLE SAGRILLO", footerIndent, footerTop + offName);

  doc.setFontSize(7.5);
  doc.setCharSpace(2);
  doc.text("MEDICINA CAPILAR", footerIndent, footerTop + offMedicina);
  doc.setCharSpace(0);

  wrappedAddresses.forEach((col, i) => {
    const colX = footerIndent + i * (addrColWidth + addrColGap);
    let cy = footerTop + offAddrStart;

    doc.setFontSize(7.3);
    doc.setFont(FOOTER_FONT, "normal");
    doc.setTextColor(...textDark);
    doc.text(col.city, colX, cy);
    cy += addrLineHeight;

    col.lines.forEach((wrapped) => {
      doc.setFontSize(7);
      doc.setFont(FOOTER_FONT, "normal");
      doc.setTextColor(...textDark);
      doc.text(wrapped, colX, cy);
      cy += wrapped.length * addrLineHeight;
    });
  });

  doc.setFontSize(7.5);
  doc.setFont(FOOTER_FONT, "normal");
  doc.setTextColor(...textDark);
  doc.text("TELEFONE: (27) 99244-9495  ·  CRM 18090-ES", pageWidth / 2, footerTop + offTelefone, { align: "center" });

  doc.save(`orcamento_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}
