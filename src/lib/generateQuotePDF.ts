import jsPDF from "jspdf";
import logoBase64 from "@/lib/logoBase64";

interface QuoteItem {
  procedure_name: string;
  description: string | null;
  value: number;
}

interface QuotePDFData {
  patientName: string;
  date: string;
  validityDays: number;
  paymentMethods: string;
  imageUseClause: boolean;
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
  const brandRoseLight: [number, number, number] = [225, 205, 190];
  const textDark: [number, number, number] = [55, 45, 40];
  const textMuted: [number, number, number] = [140, 125, 115];

  // Watermark
  const watermarkSize = 120;
  const wmX = (pageWidth - watermarkSize) / 2;
  const wmY = (pageHeight - watermarkSize) / 2;
  const gState = (doc as any).GState({ opacity: 0.06 });
  doc.saveGraphicsState();
  doc.setGState(gState);
  doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
  doc.restoreGraphicsState();

  // Top accent
  doc.setFillColor(...brandRose);
  doc.rect(0, 0, pageWidth, 2, "F");

  // Logo + header
  doc.addImage(logoBase64, "JPEG", margin, 12, 18, 18);
  y = 17;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Dra. Gabrielle Sagrillo", margin + 22, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("Medicina Capilar  |  Tricologia", margin + 22, y);

  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...brandRose);
  doc.text("A  I D E N T I D A D E  C O M E Ç A  N A  R A I Z", margin + 22, y);

  y += 10;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Title
  y += 12;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandRose);
  doc.text("ORÇAMENTO", pageWidth / 2, y, { align: "center" });

  // Patient & date
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Paciente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.patientName, margin + 24, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Data:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, margin + 15, y);

  doc.setFont("helvetica", "bold");
  doc.text("Validade:", pageWidth - margin - 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.validityDays} dias`, pageWidth - margin - 40, y);

  y += 8;
  doc.setDrawColor(...brandRoseLight);
  doc.line(margin, y, pageWidth - margin, y);

  // Items header
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandRose);
  doc.text("Procedimentos:", margin, y);

  y += 10;
  let total = 0;
  data.items.forEach((item, index) => {
    if (y > 230) {
      doc.addPage();
      doc.saveGraphicsState();
      doc.setGState(gState);
      doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
      doc.restoreGraphicsState();
      doc.setFillColor(...brandRose);
      doc.rect(0, 0, pageWidth, 2, "F");
      y = 20;
    }

    total += Number(item.value) || 0;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(`${index + 1}. ${item.procedure_name}`, margin + 4, y);
    doc.text(formatBRL(Number(item.value) || 0), pageWidth - margin, y, { align: "right" });

    if (item.description) {
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...textMuted);
      const lines = doc.splitTextToSize(item.description, pageWidth - 2 * margin - 8);
      doc.text(lines, margin + 8, y);
      y += lines.length * 4.5;
    }
    y += 6;
  });

  // Total box
  y += 2;
  doc.setDrawColor(...brandRoseLight);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFillColor(...brandRoseLight);
  doc.roundedRect(pageWidth - margin - 80, y - 6, 80, 12, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("TOTAL:", pageWidth - margin - 75, y + 2);
  doc.text(formatBRL(total), pageWidth - margin - 4, y + 2, { align: "right" });

  // Payment methods
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandRose);
  doc.text("Formas de pagamento:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  const payLines = doc.splitTextToSize(data.paymentMethods, pageWidth - 2 * margin);
  doc.text(payLines, margin, y);
  y += payLines.length * 4.5;

  // Notes
  if (data.notes) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...brandRose);
    doc.text("Observações:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    const noteLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5;
  }

  // Image use clause
  if (data.imageUseClause) {
    if (y > 220) {
      doc.addPage();
      doc.saveGraphicsState();
      doc.setGState(gState);
      doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
      doc.restoreGraphicsState();
      doc.setFillColor(...brandRose);
      doc.rect(0, 0, pageWidth, 2, "F");
      y = 20;
    }
    y += 8;
    doc.setDrawColor(...brandRoseLight);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 34, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...brandRose);
    doc.text("Termo de uso de imagem", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    const clause =
      "Ao aceitar este orçamento, o(a) paciente autoriza a Dra. Gabrielle Sagrillo a utilizar fotos e vídeos captados durante as sessões para fins de divulgação profissional (redes sociais, site, materiais educativos). Mediante solicitação do(a) paciente, será aplicada tarja sobre o rosto para preservar a identidade.";
    const cLines = doc.splitTextToSize(clause, pageWidth - 2 * margin - 8);
    doc.text(cLines, margin + 4, y + 11);

    y += 40;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text("Assinatura do(a) paciente: ______________________________________", margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text("(  ) Autorizo uso de imagem sem tarja      (  ) Autorizo apenas com tarja no rosto", margin, y);
  }

  // Footer
  const footerY = pageHeight - 30;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.3);
  doc.line(margin + 40, footerY, pageWidth - margin - 40, footerY);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Dra. Gabrielle Sagrillo", pageWidth / 2, footerY + 7, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("CRM 18090-ES  |  Medicina Capilar", pageWidth / 2, footerY + 12, { align: "center" });
  doc.text("27 99244-9495", pageWidth / 2, footerY + 17, { align: "center" });

  doc.setFillColor(...brandRose);
  doc.rect(0, pageHeight - 2, pageWidth, 2, "F");

  doc.save(`orcamento_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}