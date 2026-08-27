import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface AnamnesisData {
  continuous_medications: string;
  allergies: string;
  anabolic_steroids: string;
  topical_testosterone: string;
  previous_surgeries: string;
  recent_infections: string;
  smoking: string;
  alcohol: string;
  physical_activity: string;
  water_intake: string;
  supplements: string;
  sleep_quality: string;
  family_history: string;
}

export const emptyAnamnesis: AnamnesisData = {
  continuous_medications: "",
  allergies: "",
  anabolic_steroids: "",
  topical_testosterone: "",
  previous_surgeries: "",
  recent_infections: "",
  smoking: "",
  alcohol: "",
  physical_activity: "",
  water_intake: "",
  supplements: "",
  sleep_quality: "",
  family_history: "",
};

export const anamnesisLabels: Record<keyof AnamnesisData, string> = {
  continuous_medications: "Medicamentos de uso contínuo",
  allergies: "Alergias medicamentosas / alimentares",
  anabolic_steroids: "Usa ou já usou anabolizantes?",
  topical_testosterone: "Faz / já fez reposição tópica com testosterona?",
  previous_surgeries: "Cirurgias prévias",
  recent_infections: "Algum quadro infeccioso recente?",
  smoking: "Tabagismo",
  alcohol: "Etilismo",
  physical_activity: "Atividade física",
  water_intake: "Ingestão de água",
  supplements: "Suplementos alimentares",
  sleep_quality: "Qualidade do sono",
  family_history: "Histórico familiar",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  initialData?: Partial<AnamnesisData> | null;
  onSaved?: () => void;
}

const AnamnesisModal = ({ open, onOpenChange, patientId, initialData, onSaved }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnamnesisData>(emptyAnamnesis);

  useEffect(() => {
    if (open) setForm({ ...emptyAnamnesis, ...(initialData || {}) });
  }, [open, initialData]);

  const set = (k: keyof AnamnesisData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("patients")
      .update({
        anamnesis: form as unknown as Record<string, string>,
        anamnesis_completed_at: new Date().toISOString(),
      })
      .eq("id", patientId);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar a anamnese.");
      return;
    }
    toast.success("Anamnese inicial salva!");
    queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    onOpenChange(false);
    onSaved?.();
  };

  const field = (k: keyof AnamnesisData, placeholder: string, multiline = false) => (
    <div key={k}>
      <Label className="font-body text-sm">{anamnesisLabels[k]}</Label>
      {multiline ? (
        <Textarea value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} className="mt-1" />
      ) : (
        <Input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} className="mt-1" />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Anamnese Inicial</DialogTitle>
          <DialogDescription className="font-body">
            Preencha as informações da primeira consulta. Elas ficam salvas na ficha do paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {field("continuous_medications", "Ex: Losartana 50mg 1x/dia", true)}
          {field("allergies", "Ex: Dipirona, frutos do mar...", true)}
          {field("anabolic_steroids", "Ex: Não / Sim, entre 2019 e 2021")}
          {field("topical_testosterone", "Ex: Não / Sim, há 6 meses")}
          {field("previous_surgeries", "Ex: Apendicectomia (2015)", true)}
          {field("recent_infections", "Ex: Não / COVID há 2 meses")}

          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Hábitos e vícios</p>
            <div className="space-y-4">
              {field("smoking", "Ex: Não fumante / 10 cigarros/dia")}
              {field("alcohol", "Ex: Social, 1x por semana")}
              {field("physical_activity", "Ex: Musculação 4x/semana")}
              {field("water_intake", "Ex: 2 litros por dia")}
              {field("supplements", "Ex: Creatina, vitamina D", true)}
              {field("sleep_quality", "Ex: 6h por noite, sono fragmentado")}
            </div>
          </div>

          {field("family_history", "Ex: Pai com calvície precoce, mãe com hipotireoidismo", true)}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar anamnese"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnamnesisModal;
