import jsPDF from "jspdf";
import logoBase64 from "@/lib/logoBase64";

interface PrescriptionItem {
  medication_name: string;
  dosage: string | null;
  posology: string | null;
  duration: string | null;
}

interface PrescriptionPDFData {
  patientName: string;
  doctorName: string;
  date: string;
  items: PrescriptionItem[];
  notes?: string | null;
}

export function generatePrescriptionPDF(data: PrescriptionPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  let y = 20;

  // Brand colors
  const brandRose: [number, number, number] = [193, 154, 132]; // rose gold from logo
  const brandRoseLight: [number, number, number] = [225, 205, 190];
  const textDark: [number, number, number] = [55, 45, 40];
  const textMuted: [number, number, number] = [140, 125, 115];

  // Watermark — centered logo with low opacity
  const watermarkSize = 120;
  const wmX = (pageWidth - watermarkSize) / 2;
  const wmY = (pageHeight - watermarkSize) / 2;
  // jsPDF doesn't support opacity on images natively, so we use a GState
  const gState = (doc as any).GState({ opacity: 0.06 });
  doc.saveGraphicsState();
  doc.setGState(gState);
  doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
  doc.restoreGraphicsState();

  // Thin top accent line
  doc.setFillColor(...brandRose);
  doc.rect(0, 0, pageWidth, 2, "F");

  // Logo small - top left
  doc.addImage(logoBase64, "JPEG", margin, 12, 18, 18);

  // Header text - next to logo
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

  // Divider
  y += 10;
  doc.setDrawColor(...brandRoseLight);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // RECEITUÁRIO
  y += 12;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandRose);
  doc.text("RECEITUÁRIO", pageWidth / 2, y, { align: "center" });

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

  // Divider
  y += 8;
  doc.setDrawColor(...brandRoseLight);
  doc.line(margin, y, pageWidth - margin, y);

  // Prescrição
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandRose);
  doc.text("Prescrição:", margin, y);

  y += 10;
  data.items.forEach((item, index) => {
    if (y > 240) {
      doc.addPage();
      // Watermark on new page
      doc.saveGraphicsState();
      doc.setGState(gState);
      doc.addImage(logoBase64, "JPEG", wmX, wmY, watermarkSize, watermarkSize);
      doc.restoreGraphicsState();
      doc.setFillColor(...brandRose);
      doc.rect(0, 0, pageWidth, 2, "F");
      y = 20;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textDark);
    doc.text(`${index + 1}. ${item.medication_name}`, margin + 4, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);

    const details: string[] = [];
    if (item.dosage) details.push(`Dosagem: ${item.dosage}`);
    if (item.posology) details.push(`Posologia: ${item.posology}`);
    if (item.duration) details.push(`Duração: ${item.duration}`);

    details.forEach((detail) => {
      doc.text(`   ${detail}`, margin + 4, y);
      y += 5;
    });

    y += 4;
  });

  // Notes
  if (data.notes) {
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...textMuted);
    doc.text(`Observações: ${data.notes}`, margin, y, { maxWidth: pageWidth - 2 * margin });
  }

  // Footer
  const footerY = 262;
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

  // Bottom accent
  doc.setFillColor(...brandRose);
  doc.rect(0, pageHeight - 2, pageWidth, 2, "F");

  doc.save(`receita_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}
