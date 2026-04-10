import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess: () => void;
}

const NewConsultationModal = ({ open, onOpenChange, patientId, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    chief_complaint: "",
    physical_exam: "",
    diagnosis: "",
    treatment_plan: "",
    prescription_notes: "",
    observations: "",
  });

  const handleSubmit = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logada para registrar consultas.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("consultations").insert({
      patient_id: patientId,
      user_id: user.id,
      ...form,
    });

    if (error) {
      toast.error("Erro ao salvar consulta.");
    } else {
      toast.success("Consulta registrada com sucesso!");
      setForm({ chief_complaint: "", physical_exam: "", diagnosis: "", treatment_plan: "", prescription_notes: "", observations: "" });
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Nova Evolução</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="font-body text-sm">Queixa Principal</Label>
            <Textarea value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} placeholder="Descreva a queixa principal..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Exame Físico (Tricológico)</Label>
            <Textarea value={form.physical_exam} onChange={(e) => setForm({ ...form, physical_exam: e.target.value })} placeholder="Achados do exame do couro cabeludo..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Diagnóstico</Label>
            <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Ex: Alopecia Areata" className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Conduta / Plano Terapêutico</Label>
            <Textarea value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} placeholder="Descreva a conduta adotada..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Prescrição</Label>
            <Textarea value={form.prescription_notes} onChange={(e) => setForm({ ...form, prescription_notes: e.target.value })} placeholder="Medicamentos prescritos nesta consulta..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Observações</Label>
            <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Notas adicionais..." className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Evolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConsultationModal;
