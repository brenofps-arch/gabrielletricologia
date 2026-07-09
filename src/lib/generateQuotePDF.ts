import jsPDF from "jspdf";
import logoBase64 from "@/lib/logoBase64";

interface QuoteItem {
  procedure_name: string;
  description: string | null;
  value: number;
  installments?: string | null;
}

interface QuotePDFData {
  patientName: string;
  date: string;
  validityDays: number;
  paymentMethods: string;
  items: QuoteItem[];
  notes?: string | null;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function generateQuotePDF(data: QuotePDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  let y = 20;

  const brandRose: [number, number, number] = [193, 154, 132];
  const brandRoseLight: [number, number, number] = [235, 218, 208];
  const brandRosePale: [number, number, number] = [250, 245, 242];
  const textDark: [number, number, number] = [45, 35, 30];
  const textMuted: [number, number, number] = [140, 125, 115];

  // Carrega fonte Montserrat via CDN (fallback para helvetica no jsPDF)
  // jsPDF não suporta Google Fonts nativamente — usamos helvetica com espaçamento elegante

  // Watermark
  const watermarkSize = 110;
  const wmX = (pageWidth - watermarkSize) / 2;
  const wmY = (pageHeight - watermarkSize) / 2;
  const gState = (doc as any).GState({ opacity: 0.05 });
  doc.saveGraphicsState();
  doc.setGState(gState);
  doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
  doc.restoreGraphicsState();

  // Faixa superior elegante
  doc.setFillColor(...brandRose);
  doc.rect(0, 0, pageWidth, 3, "F");

  // Faixa secundária fina
  doc.setFillColor(...brandRoseLight);
  doc.rect(0, 3, pageWidth, 0.5, "F");

  // ── CABEÇALHO ────────────────────────────────────────────────────
  doc.addImage(logoBase64, "JPEG", margin, 12, 20, 20);

  y = 17;
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.setCharSpace(0.5);
  doc.text("DRA. GABRIELLE SAGRILLO", margin + 26, y);

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setCharSpace(1.5);
  doc.setTextColor(...brandRose);
  doc.text("MEDICINA CAPILAR  ·  TRICOLOGIA  ·  CRM 18090-ES", margin + 26, y);

  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setCharSpace(2);
  doc.setTextColor(...textMuted);
  doc.text("A  I D E N T I D A D E  C O M E Ç A  N A  R A I Z", margin + 26, y);
  doc.setCharSpace(0);

  y += 14;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // ── TÍTULO ───────────────────────────────────────────────────────
  y += 13;
  doc.setFillColor(...brandRosePale);
  doc.roundedRect(margin, y - 6, pageWidth - 2 * margin, 14, 2, 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(3);
  doc.setTextColor(...brandRose);
  doc.text("O R Ç A M E N T O", pageWidth / 2, y + 3, { align: "center" });
  doc.setCharSpace(0);

  // ── CABEÇALHO JURÍDICO ───────────────────────────────────────────
  y += 20;

  // Caixa de informações do paciente
  doc.setFillColor(...brandRosePale);
  doc.roundedRect(margin, y - 4, pageWidth - 2 * margin, 26, 2, 2, "F");
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y - 4, pageWidth - 2 * margin, 26, 2, 2, "S");

  // Texto jurídico introdutório
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...textMuted);
  const intro = `Este documento foi elaborado pela Dra. Gabrielle Sagrillo Pimassoni (CRM 18090-ES) e destina-se exclusivamente ao(à) paciente identificado(a) abaixo. Os valores apresentados são válidos por ${data.validityDays} dias a partir da data de emissão e podem sofrer ajustes mediante avaliação clínica individual.`;
  const introLines = doc.splitTextToSize(intro, pageWidth - 2 * margin - 8);
  doc.text(introLines, margin + 4, y + 2);

  y += 30;

  // Linha paciente / data / validade
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Paciente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...brandRose);
  doc.text(data.patientName, margin + 24, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Emissão:", pageWidth / 2 - 10, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text(data.date, pageWidth / 2 + 16, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Validade:", pageWidth - margin - 55, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text(`${data.validityDays} dias`, pageWidth - margin - 30, y);

  y += 10;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // ── PROCEDIMENTOS ────────────────────────────────────────────────
  y += 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(1.5);
  doc.setTextColor(...brandRose);
  doc.text("PROCEDIMENTOS", margin, y);
  doc.setCharSpace(0);

  y += 8;
  let total = 0;

  data.items.forEach((item, index) => {
    if (y > 230) {
      doc.addPage();
      doc.saveGraphicsState();
      doc.setGState(gState);
      doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
      doc.restoreGraphicsState();
      doc.setFillColor(...brandRose);
      doc.rect(0, 0, pageWidth, 3, "F");
      y = 20;
    }

    total += Number(item.value) || 0;

    // Fundo alternado suave
    if (index % 2 === 0) {
      doc.setFillColor(...brandRosePale);
      doc.rect(margin, y - 4, pageWidth - 2 * margin, 14, "F");
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(`${index + 1}.  ${item.procedure_name}`, margin + 4, y + 3);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brandRose);
    doc.text(formatBRL(Number(item.value) || 0), pageWidth - margin - 4, y + 3, { align: "right" });

    // Parcelamento
    if (item.installments) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text(`→ ${item.installments}`, pageWidth - margin - 4, y + 8, { align: "right" });
      y += 4;
    }

    if (item.description) {
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...textMuted);
      const lines = doc.splitTextToSize(item.description, pageWidth - 2 * margin - 12);
      doc.text(lines, margin + 8, y + 3);
      y += lines.length * 4.5;
    }
    y += 10;
  });

  // ── TOTAL ────────────────────────────────────────────────────────
  y += 2;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;
  doc.setFillColor(...brandRose);
  doc.roundedRect(pageWidth - margin - 85, y - 5, 85, 14, 2, 2, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL", pageWidth - margin - 78, y + 4);
  doc.setFontSize(11);
  doc.text(formatBRL(total), pageWidth - margin - 4, y + 4, { align: "right" });

  // ── PAGAMENTO ────────────────────────────────────────────────────
  y += 20;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(1.5);
  doc.setTextColor(...brandRose);
  doc.text("FORMAS DE PAGAMENTO", margin, y);
  doc.setCharSpace(0);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  const payLines = doc.splitTextToSize(data.paymentMethods, pageWidth - 2 * margin);
  doc.text(payLines, margin, y);
  y += payLines.length * 5;

  // ── OBSERVAÇÕES ──────────────────────────────────────────────────
  if (data.notes) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setCharSpace(1.5);
    doc.setTextColor(...brandRose);
    doc.text("OBSERVAÇÕES", margin, y);
    doc.setCharSpace(0);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5;
  }

  // ── ASSINATURA ───────────────────────────────────────────────────
  const signY = Math.max(y + 16, pageHeight - 60);
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.3);
  doc.line(margin + 20, signY, pageWidth / 2 - 10, signY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("Assinatura do(a) paciente", margin + 20, signY + 5);

  doc.line(pageWidth / 2 + 10, signY, pageWidth - margin - 20, signY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Dra. Gabrielle Sagrillo", pageWidth / 2 + 12, signY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text("CRM 18090-ES", pageWidth / 2 + 12, signY + 10);

  // ── RODAPÉ ───────────────────────────────────────────────────────
  const footerY = pageHeight - 20;
  doc.setFillColor(...brandRosePale);
  doc.rect(0, footerY - 6, pageWidth, 26, "F");
  doc.setFillColor(...brandRose);
  doc.rect(0, pageHeight - 2, pageWidth, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("@dra.gabriellesagrillo  |  www.gabriellesagrillo.com.br  |  (27) 99244-9495", pageWidth / 2, footerY + 2, { align: "center" });
  doc.setFontSize(7);
  doc.text("Instituto Health · Vila Velha · Cariacica · Vitória", pageWidth / 2, footerY + 7, { align: "center" });

  doc.save(`orcamento_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}
