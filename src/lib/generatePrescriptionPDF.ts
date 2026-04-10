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
  let y = 25;

  // Header - Clinic logo placeholder
  doc.setFillColor(196, 155, 155); // rose-gold-ish
  doc.rect(margin, y, 12, 12, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("TC", margin + 3.2, y + 7.5);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("TricoCare", margin + 16, y + 5);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Clínica de Tricologia", margin + 16, y + 11);

  // Line
  y += 20;
  doc.setDrawColor(210, 190, 190);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Title
  y += 12;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("RECEITUÁRIO", pageWidth / 2, y, { align: "center" });

  // Doctor & Patient info
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Médica:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.doctorName, margin + 20, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Paciente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.patientName, margin + 24, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Data:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, margin + 15, y);

  // Line
  y += 8;
  doc.setDrawColor(220, 210, 210);
  doc.line(margin, y, pageWidth - margin, y);

  // Medications
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text("Prescrição:", margin, y);

  y += 10;
  data.items.forEach((item, index) => {
    if (y > 260) {
      doc.addPage();
      y = 25;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(`${index + 1}. ${item.medication_name}`, margin + 4, y);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);

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
    doc.setTextColor(120, 120, 120);
    doc.text(`Observações: ${data.notes}`, margin, y, { maxWidth: pageWidth - 2 * margin });
  }

  // Footer
  const footerY = 275;
  doc.setDrawColor(210, 190, 190);
  doc.line(margin + 30, footerY, pageWidth - margin - 30, footerY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(data.doctorName, pageWidth / 2, footerY + 6, { align: "center" });
  doc.text("CRM XXXXX", pageWidth / 2, footerY + 11, { align: "center" });

  doc.save(`receita_${data.patientName.replace(/\s+/g, "_")}_${data.date.replace(/\//g, "-")}.pdf`);
}
