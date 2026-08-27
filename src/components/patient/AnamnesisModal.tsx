import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pill, AlertCircle, Activity, HeartPulse, Sparkles, Users, Dumbbell, Wine, Cigarette, Droplets, Moon } from "lucide-react";

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
  allergies: "Alergias medicamentosas / Alimentares",
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

const quickOptions: Partial<Record<keyof AnamnesisData, string[]>> = {
  continuous_medications: ["Nega uso contínuo", "Anticoncepcional", "Anti-hipertensivo", "Tireoide (Levotiroxina)"],
  allergies: ["Nega alergias conhecidas", "Alergia a Dipirona", "Alergia a Sulfas", "Alergia alimentar"],
  anabolic_steroids: ["Não usa / Nunca usou", "Uso prévio (passado)", "Uso atual"],
  topical_testosterone: ["Não faz reposição", "Reposição tópica atual", "Reposição tópica prévia"],
  previous_surgeries: ["Nenhuma cirurgia prévia", "Cirurgia bariátrica", "Cirurgia capilar prévia"],
  recent_infections: ["Nenhum quadro recente", "COVID-19 nos últimos meses", "Dengue recente", "Febre/Infecção recente"],
  smoking: ["Não fumante", "Ex-fumante", "Fumante ativo"],
  alcohol: ["Não consome", "Socialmente (ocasional)", "Frequente"],
  physical_activity: ["Sedentário", "1 a 2x na semana", "3 a 5x na semana", "Diário / Atleta"],
  water_intake: ["Menos de 1L / dia", "1 a 2L / dia", "2 a 3L / dia", "Mais de 3L / dia"],
  supplements: ["Nenhum suplemento", "Whey protein / Creatina", "Polivitamínico / Vitamina D", "Biotina / Ferro"],
  sleep_quality: ["Bom (7-8h reparador)", "Ruim / Insônia", "Fragmentado (acorda cansado)"],
  family_history: ["Sem histórico relevante", "Calvície paterna", "Calvície materna", "Calvície bilateral (pai e mãe)", "Hipotireoidismo familiar"],
};

const AnamnesisModal = ({ open, onOpenChange, patientId, initialData, onSaved }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnamnesisData>(emptyAnamnesis);

  useEffect(() => {
    if (open) setForm({ ...emptyAnamnesis, ...(initialData || {}) });
  }, [open, initialData]);

  const set = (k: keyof AnamnesisData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const appendOrSet = (k: keyof AnamnesisData, option: string) => {
    setForm((prev) => {
      const current = prev[k].trim();
      if (!current) return { ...prev, [k]: option };
      if (current.includes(option)) return prev;
      return { ...prev, [k]: `${current}, ${option}` };
    });
  };

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
    toast.success("Anamnese inicial salva com sucesso!");
    queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    onOpenChange(false);
    onSaved?.();
  };

  const renderField = (k: keyof AnamnesisData, placeholder: string, multiline = false) => (
    <div key={k} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="font-body text-xs font-semibold text-foreground/90">{anamnesisLabels[k]}</Label>
      </div>

      {/* Quick click badges */}
      {quickOptions[k] && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {quickOptions[k]!.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => {
                // If it's a single choice like smoking or alcohol, replace; otherwise append if multiline
                if (!multiline && (k === "smoking" || k === "alcohol" || k === "physical_activity" || k === "water_intake" || k === "sleep_quality" || k === "anabolic_steroids" || k === "topical_testosterone")) {
                  set(k, opt);
                } else {
                  appendOrSet(k, opt);
                }
              }}
              className="text-[11px] px-2 py-0.5 rounded-md border border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors text-muted-foreground"
            >
              + {opt}
            </button>
          ))}
        </div>
      )}

      {multiline ? (
        <Textarea
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder={placeholder}
          className="text-sm min-h-[68px] bg-background"
        />
      ) : (
        <Input
          value={form[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder={placeholder}
          className="text-sm bg-background h-9"
        />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <DialogTitle className="font-heading text-xl">Anamnese Inicial Tricológica</DialogTitle>
          </div>
          <DialogDescription className="font-body text-xs">
            Esta anamnese é solicitada na primeira consulta/evolução do paciente para registrar o histórico de saúde. As informações ficam gravadas na ficha clínica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Seção 1: Medicamentos e Alergias */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Pill className="w-4 h-4 text-primary" />
              <span>Medicamentos e Alergias</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("continuous_medications", "Ex: Losartana 50mg 1x/dia, anticoncepcional...", true)}
              {renderField("allergies", "Ex: Dipirona, frutos do mar, iodo...", true)}
            </div>
          </div>

          {/* Seção 2: Histórico Hormonal, Cirúrgico e Infeccioso */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <HeartPulse className="w-4 h-4 text-primary" />
              <span>Histórico Hormonal, Cirúrgico e Infeccioso</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("anabolic_steroids", "Ex: Nega / Sim, usou durateston há 1 ano")}
              {renderField("topical_testosterone", "Ex: Não / Sim, uso tópico diário")}
              {renderField("previous_surgeries", "Ex: Bariátrica (2022), Apendicectomia...", true)}
              {renderField("recent_infections", "Ex: COVID há 3 meses, dengue recente...", true)}
            </div>
          </div>

          {/* Seção 3: Hábitos e Vícios */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="w-4 h-4 text-primary" />
              <span>Hábitos e Vícios</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("smoking", "Ex: Não fumante / 10 cigarros ao dia")}
              {renderField("alcohol", "Ex: Social fim de semana / Não consome")}
              {renderField("physical_activity", "Ex: Musculação 4x/semana")}
              {renderField("water_intake", "Ex: 2 a 2.5 litros ao dia")}
              {renderField("supplements", "Ex: Creatina, Whey, Biotina...", true)}
              {renderField("sleep_quality", "Ex: Dorme 6h, acorda descansado/cansado...")}
            </div>
          </div>

          {/* Seção 4: Histórico Familiar */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="w-4 h-4 text-primary" />
              <span>Histórico Familiar</span>
            </div>
            {renderField("family_history", "Ex: Pai com calvície aos 30 anos, mãe com hipotireoidismo...", true)}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? "Salvando..." : "Salvar Anamnese e Prosseguir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnamnesisModal;
