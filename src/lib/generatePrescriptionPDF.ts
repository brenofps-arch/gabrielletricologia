import jsPDF from "jspdf";

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
  const margin = 20;
  let y = 20;

  // Brand colors from identity
  const brandBrown: [number, number, number] = [139, 119, 101]; // warm brown from logo
  const brandGold: [number, number, number] = [169, 145, 120]; // gold accent
  const brandLight: [number, number, number] = [235, 228, 220]; // light warm bg
  const textDark: [number, number, number] = [60, 50, 45];
  const textMuted: [number, number, number] = [130, 115, 105];

  // Top accent bar
  doc.setFillColor(...brandGold);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Logo area - stylized "GS" monogram
  y = 18;
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandBrown);
  doc.text("GS", pageWidth / 2, y, { align: "center" });

  // Doctor name
  y += 14;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Dra. Gabrielle Sagrillo", pageWidth / 2, y, { align: "center" });

  // Specialty
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("Medicina Capilar | Tricologia", pageWidth / 2, y, { align: "center" });

  // Tagline
  y += 7;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...brandGold);
  doc.text("A  I D E N T I D A D E  C O M E Ç A  N A  R A I Z", pageWidth / 2, y, { align: "center" });

  // Divider line
  y += 8;
  doc.setDrawColor(...brandLight);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  // RECEITUÁRIO title
  y += 14;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandBrown);
  doc.text("RECEITUÁRIO", pageWidth / 2, y, { align: "center" });

  // Patient info section
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
  doc.setDrawColor(...brandLight);
  doc.line(margin, y, pageWidth - margin, y);

  // Medications
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandBrown);
  doc.text("Prescrição:", margin, y);

  y += 10;
  data.items.forEach((item, index) => {
    if (y > 245) {
      doc.addPage();
      // Top accent on new page
      doc.setFillColor(...brandGold);
      doc.rect(0, 0, pageWidth, 4, "F");
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
  const footerY = 265;
  doc.setDrawColor(...brandGold);
  doc.setLineWidth(0.5);
  doc.line(margin + 30, footerY, pageWidth - margin - 30, footerY);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("Dra. Gabrielle Sagrillo", pageWidth / 2, footerY + 7, { align: "center" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  doc.text("CRM 18090-ES | Medicina Capilar", pageWidth / 2, footerY + 12, { align: "center" });
  doc.text("27 99244-9495", pageWidth / 2, footerY + 17, { align: "center" });

  // Bottom accent bar
  doc.setFillColor(...brandGold);
  doc.rect(0, 293, pageWidth, 4, "F");

  doc.save(`receita_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}
