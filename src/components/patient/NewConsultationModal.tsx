import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnamnesisData, anamnesisLabels } from "./AnamnesisModal";
import { ChevronDown, ChevronUp, ClipboardList, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  consultation?: Tables<"consultations"> | null;
  anamnesis?: AnamnesisData | null;
  onSuccess: () => void;
}

const NewConsultationModal = ({ open, onOpenChange, patientId, consultation, anamnesis, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [showAnamnesisSummary, setShowAnamnesisSummary] = useState(false);
  const [form, setForm] = useState({
    consultation_date: new Date().toISOString().slice(0, 10),
    chief_complaint: "",
    physical_exam: "",
    diagnosis: "",
    treatment_plan: "",
    prescription_notes: "",
    observations: "",
  });

  useEffect(() => {
    if (open) {
      if (consultation) {
        setForm({
          consultation_date: consultation.consultation_date
            ? new Date(consultation.consultation_date).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          chief_complaint: consultation.chief_complaint || "",
          physical_exam: consultation.physical_exam || "",
          diagnosis: consultation.diagnosis || "",
          treatment_plan: consultation.treatment_plan || "",
          prescription_notes: consultation.prescription_notes || "",
          observations: consultation.observations || "",
        });
      } else {
        setForm({
          consultation_date: new Date().toISOString().slice(0, 10),
          chief_complaint: "",
          physical_exam: "",
          diagnosis: "",
          treatment_plan: "",
          prescription_notes: "",
          observations: "",
        });
      }
    }
  }, [open, consultation]);

  const handleSubmit = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logada para salvar consultas.");
      setLoading(false);
      return;
    }

    const saveIsoDate = form.consultation_date
      ? new Date(`${form.consultation_date}T12:00:00Z`).toISOString()
      : new Date().toISOString();

    const payload = {
      consultation_date: saveIsoDate,
      chief_complaint: form.chief_complaint || null,
      physical_exam: form.physical_exam || null,
      diagnosis: form.diagnosis || null,
      treatment_plan: form.treatment_plan || null,
      prescription_notes: form.prescription_notes || null,
      observations: form.observations || null,
    };

    let saveError;
    if (consultation?.id) {
      const { error } = await supabase
        .from("consultations")
        .update(payload)
        .eq("id", consultation.id);
      saveError = error;
    } else {
      const { error } = await supabase
        .from("consultations")
        .insert({
          patient_id: patientId,
          user_id: user.id,
          ...payload,
        });
      saveError = error;
    }

    // Atualiza o diagnóstico na ficha do paciente quando preenchido na evolução
    if (!saveError && form.diagnosis.trim()) {
      await supabase.from("patients").update({ diagnosis: form.diagnosis.trim() }).eq("id", patientId);
    }

    if (saveError) {
      toast.error("Erro ao salvar consulta.");
    } else {
      toast.success(consultation ? "Consulta atualizada com sucesso!" : "Consulta registrada com sucesso!");
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {consultation ? "Editar Evolução Clínica" : "Inserir Evolução Clínica"}
          </DialogTitle>
        </DialogHeader>

        {/* Data da Consulta */}
        <div className="flex items-center justify-between bg-muted/30 border border-border/80 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <Label className="text-xs font-semibold text-foreground">Data da Consulta / Atendimento:</Label>
          </div>
          <Input
            type="date"
            value={form.consultation_date}
            onChange={(e) => setForm({ ...form, consultation_date: e.target.value })}
            className="w-44 h-8 text-xs bg-background"
          />
        </div>

        {/* Resumo rápido da Anamnese Inicial para consulta durante o atendimento */}
        {anamnesis && Object.values(anamnesis).some((v) => typeof v === "string" && v.trim().length > 0) && (
          <div className="bg-muted/40 border border-border rounded-xl p-3 text-xs">
            <button
              type="button"
              onClick={() => setShowAnamnesisSummary(!showAnamnesisSummary)}
              className="flex items-center justify-between w-full font-medium text-foreground hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-primary" />
                Consultar Anamnese do Paciente
              </span>
              {showAnamnesisSummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAnamnesisSummary && (
              <div className="grid gap-2 sm:grid-cols-2 mt-3 pt-3 border-t border-border/60">
                {(Object.keys(anamnesisLabels) as (keyof AnamnesisData)[])
                  .filter((k) => anamnesis[k]?.trim())
                  .map((k) => (
                    <div key={k} className="bg-background/80 p-2 rounded border border-border/40">
                      <span className="text-muted-foreground font-medium block">{anamnesisLabels[k]}:</span>
                      <span className="text-foreground font-body">{anamnesis[k]}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

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
            <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Ex: Alopecia Androgenética, Eflúvio Telógeno..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Conduta / Plano Terapêutico</Label>
            <Textarea value={form.treatment_plan} onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })} placeholder="Descreva a conduta adotada (terapias, procedimentos, orientações)..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Prescrição</Label>
            <Textarea value={form.prescription_notes} onChange={(e) => setForm({ ...form, prescription_notes: e.target.value })} placeholder="Medicamentos, tônicos ou fórmulas prescritas nesta consulta..." className="mt-1" />
          </div>
          <div>
            <Label className="font-body text-sm">Observações</Label>
            <Textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} placeholder="Notas adicionais ou evolução do quadro..." className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : consultation ? "Salvar Alterações" : "Salvar Evolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConsultationModal;
