import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePrescriptionPDF } from "@/lib/generatePrescriptionPDF";

interface MedicationItem {
  medication_name: string;
  dosage: string;
  posology: string;
  duration: string;
}

const SUGGESTIONS = [
  "Minoxidil 5%", "Finasterida 1mg", "Biotina 5mg", "Espironolactona 100mg",
  "Pantogar", "Ciproterona 50mg", "Dutasterida 0.5mg", "Latanoprosta 0.005%",
  "Complexo B", "Ferro quelato", "Zinco 30mg", "Vitamina D3 5000UI",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  onSuccess: () => void;
}

const PrescriptionModal = ({ open, onOpenChange, patientId, patientName, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MedicationItem[]>([
    { medication_name: "", dosage: "", posology: "", duration: "" },
  ]);

  const addItem = () => setItems([...items, { medication_name: "", dosage: "", posology: "", duration: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof MedicationItem, value: string) => {
    const updated = [...items];
    updated[i][field] = value;
    setItems(updated);
  };

  const handleSubmit = async (generatePDF: boolean) => {
    const validItems = items.filter((i) => i.medication_name.trim());
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um medicamento.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login."); setLoading(false); return; }

    const { data: prescription, error } = await supabase.from("prescriptions").insert({
      patient_id: patientId,
      user_id: user.id,
      doctor_name: "Dra. Especialista",
      notes,
    }).select().single();

    if (error || !prescription) {
      toast.error("Erro ao salvar receita.");
      setLoading(false);
      return;
    }

    const { error: itemsError } = await supabase.from("prescription_items").insert(
      validItems.map((item) => ({ prescription_id: prescription.id, ...item }))
    );

    if (itemsError) {
      toast.error("Erro ao salvar medicamentos.");
    } else {
      toast.success("Receita salva com sucesso!");
      if (generatePDF) {
        generatePrescriptionPDF({
          patientName,
          doctorName: prescription.doctor_name,
          date: new Date().toLocaleDateString("pt-BR"),
          items: validItems,
          notes,
        });
      }
      setItems([{ medication_name: "", dosage: "", posology: "", duration: "" }]);
      setNotes("");
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Gerar Receita</DialogTitle>
        </DialogHeader>

        <div className="mb-3">
          <p className="text-xs text-muted-foreground font-body mb-2">Sugestões rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const emptyIdx = items.findIndex((i) => !i.medication_name.trim());
                  if (emptyIdx >= 0) updateItem(emptyIdx, "medication_name", s);
                  else setItems([...items, { medication_name: s, dosage: "", posology: "", duration: "" }]);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground hover:bg-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Medicamento {i + 1}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <Input placeholder="Nome do medicamento" value={item.medication_name} onChange={(e) => updateItem(i, "medication_name", e.target.value)} />
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Dosagem" value={item.dosage} onChange={(e) => updateItem(i, "dosage", e.target.value)} />
                <Input placeholder="Posologia" value={item.posology} onChange={(e) => updateItem(i, "posology", e.target.value)} />
                <Input placeholder="Duração" value={item.duration} onChange={(e) => updateItem(i, "duration", e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 mt-2">
          <Plus className="w-3.5 h-3.5" /> Adicionar Medicamento
        </Button>

        <div className="mt-3">
          <Label className="font-body text-sm">Observações</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Orientações adicionais..." className="mt-1" />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={loading}>Salvar</Button>
          <Button onClick={() => handleSubmit(true)} disabled={loading} className="gap-1.5">
            <FileDown className="w-4 h-4" /> Salvar e Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrescriptionModal;
