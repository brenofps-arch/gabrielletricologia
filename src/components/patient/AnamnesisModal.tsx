import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Pill, Activity, HeartPulse, Users, Calendar, Scissors, Sparkles, User } from "lucide-react";

export interface AnamnesisData {
  // Dados Pessoais e Sociais
  profession: string;
  marital_status: string;
  has_children: string;
  children_quantity: string;
  wants_children_next_year: string;
  continuous_medications: string;
  allergies: string;
  comorbidities: string;
  anabolic_steroids: string;
  topical_testosterone: string;
  previous_surgeries: string;
  recent_infections: string;
  smoking: string;
  alcohol: string;
  physical_activity: string;
  physical_activity_type: string;
  bowel_function: string;
  water_intake: string;
  supplements: string;
  sleep_quality: string;
  sleep_medication: string;
  family_history: string;
  // HairCare (Tricologia)
  haircare_washing_frequency: string;
  haircare_water_temperature: string;
  haircare_wash_time: string;
  haircare_shampoo_conditioner: string;
  haircare_chemical_procedures: string;
  haircare_chemical_last_time: string;
  haircare_thermal_tools: string;
  haircare_routine_products: string;
  haircare_scalp_symptoms: string;
  haircare_previous_treatments: string;
}

export const emptyAnamnesis: AnamnesisData = {
  profession: "",
  marital_status: "",
  has_children: "",
  children_quantity: "",
  wants_children_next_year: "",
  continuous_medications: "",
  allergies: "",
  comorbidities: "",
  anabolic_steroids: "",
  topical_testosterone: "",
  previous_surgeries: "",
  recent_infections: "",
  smoking: "",
  alcohol: "",
  physical_activity: "",
  physical_activity_type: "",
  bowel_function: "",
  water_intake: "",
  supplements: "",
  sleep_quality: "",
  sleep_medication: "",
  family_history: "",
  haircare_washing_frequency: "",
  haircare_water_temperature: "",
  haircare_wash_time: "",
  haircare_shampoo_conditioner: "",
  haircare_chemical_procedures: "",
  haircare_chemical_last_time: "",
  haircare_thermal_tools: "",
  haircare_routine_products: "",
  haircare_scalp_symptoms: "",
  haircare_previous_treatments: "",
};

export const anamnesisLabels: Record<keyof AnamnesisData, string> = {
  // Dados Pessoais e Sociais
  profession: "Profissão",
  marital_status: "Estado civil",
  has_children: "Tem filhos?",
  children_quantity: "Quantidade de filhos",
  wants_children_next_year: "Pretende ter filhos no próximo ano?",
  continuous_medications: "Medicamentos de uso contínuo",
  allergies: "Alergias medicamentosas / Alimentares",
  comorbidities: "Comorbidades (Doenças prévias / atuais)",
  anabolic_steroids: "Usa ou já usou anabolizantes?",
  topical_testosterone: "Faz / já fez reposição tópica com testosterona?",
  previous_surgeries: "Cirurgias prévias",
  recent_infections: "Algum quadro infeccioso recente?",
  smoking: "Tabagismo",
  alcohol: "Etilismo",
  physical_activity: "Atividade física (Frequência)",
  physical_activity_type: "Tipo de atividade física praticada",
  bowel_function: "Funcionamento do intestino (Frequência evacuatória)",
  water_intake: "Ingestão de água",
  supplements: "Suplementos alimentares",
  sleep_quality: "Qualidade do sono",
  sleep_medication: "Usa medicação para dormir? (Qual?)",
  family_history: "Histórico familiar",
  // HairCare
  haircare_washing_frequency: "Frequência de lavagem do couro cabeludo",
  haircare_water_temperature: "Temperatura da água",
  haircare_wash_time: "Horário que lava",
  haircare_shampoo_conditioner: "Shampoo e condicionador que usa",
  haircare_chemical_procedures: "Procedimentos químicos realizados (tintura, descoloração, progressiva...)",
  haircare_chemical_last_time: "Tempo desde o último procedimento químico (Quando foi?)",
  haircare_thermal_tools: "Fontes de calor (secador, chapinha, babyliss...)",
  haircare_routine_products: "Produtos em uso / Rotina capilar (shampoos, tônicos, óleos...)",
  haircare_scalp_symptoms: "Sintomas no couro cabeludo (coceira, descamação, dor/tricodinia, oleosidade...)",
  haircare_previous_treatments: "Tratamentos capilares prévios (Minoxidil, MMP, LED, etc.)",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  initialData?: Partial<AnamnesisData> | null;
  initialDate?: string | null;
  onSaved?: () => void;
}

const quickOptions: Partial<Record<keyof AnamnesisData, string[]>> = {
  marital_status: ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"],
  has_children: ["Sim", "Não"],
  wants_children_next_year: ["Sim", "Não"],
  continuous_medications: ["Nega uso contínuo", "Anticoncepcional", "Anti-hipertensivo", "Tireoide (Levotiroxina)"],
  allergies: ["Nega alergias conhecidas", "Alergia a Dipirona", "Alergia a Sulfas", "Alergia alimentar"],
  comorbidities: ["Nenhuma comorbidade", "Hipotireoidismo", "Diabetes", "Hipertensão (HAS)", "SOP (Ovários Policísticos)", "Anemia / Ferritina baixa", "Dermatite seborreica", "Psoríase", "Doença autoimune"],
  anabolic_steroids: ["Não usa / Nunca usou", "Uso prévio (passado)", "Uso atual"],
  topical_testosterone: ["Não faz reposição", "Reposição tópica atual", "Reposição tópica prévia"],
  previous_surgeries: ["Nenhuma cirurgia prévia", "Cirurgia bariátrica", "Cirurgia capilar prévia"],
  recent_infections: ["Nenhum quadro recente", "COVID-19 nos últimos meses", "Dengue recente", "Febre/Infecção recente"],
  smoking: ["Não fumante", "Ex-fumante", "Fumante ativo"],
  alcohol: ["Não consome", "Socialmente (ocasional)", "Frequente"],
  physical_activity: ["Sedentário", "1 a 2x na semana", "3 a 5x na semana", "Diário / Atleta"],
  physical_activity_type: ["Musculação", "Corrida / Caminhada", "Pilates / Yoga", "Crossfit", "Natação", "Nenhuma"],
  bowel_function: ["Diário (1 a 2x ao dia)", "Dias alternados", "2 a 3x por semana (constipado)", "Mais de 3 dias sem evacuar", "Fezes ressecadas / difícil evacuação"],
  water_intake: ["Menos de 1L / dia", "1 a 2L / dia", "2 a 3L / dia", "Mais de 3L / dia"],
  supplements: ["Nenhum suplemento", "Whey protein / Creatina", "Polivitamínico / Vitamina D", "Biotina / Ferro"],
  sleep_quality: ["Bom (7-8h reparador)", "Ruim / Insônia", "Fragmentado (acorda cansado)"],
  sleep_medication: ["Não usa medicação", "Zolpidem", "Melatonina", "Clonazepam (Rivotril)", "Trazodona", "Fitoterápico / Passiflora"],
  family_history: ["Sem histórico relevante", "Calvície paterna", "Calvície materna", "Calvície bilateral (pai e mãe)", "Hipotireoidismo familiar"],
  // HairCare quick options
  haircare_washing_frequency: ["Diária", "Dias alternados", "2 a 3x por semana", "1x por semana"],
  haircare_water_temperature: ["Fria", "Morna", "Quente"],
  haircare_wash_time: ["Manhã", "Tarde", "Noite"],
  haircare_chemical_procedures: ["Nenhuma química", "Coloração / Tintura", "Luzes / Descoloração", "Progressiva / Botox capilar", "Alisamento definitivo"],
  haircare_chemical_last_time: ["Nunca realizou", "Menos de 1 mês", "Há 1 a 3 meses", "Há 3 a 6 meses", "Há mais de 6 meses", "Há mais de 1 ano"],
  haircare_thermal_tools: ["Não usa fontes de calor", "Secador com protetor térmico", "Secador frequente", "Chapinha / Babyliss frequente"],
  haircare_routine_products: ["Shampoo neutro / suave", "Shampoo anticaspa", "Tônico antiqueda", "Máscara de tratamento", "Óleos vegetais"],
  haircare_scalp_symptoms: ["Nenhum sintoma", "Queda acentuada", "Afinamento dos fios", "Prurido (coceira)", "Descamação / Caspa", "Oleosidade excessiva", "Tricodinia (dor/sensibilidade no couro)"],
  haircare_previous_treatments: ["Nenhum tratamento prévio", "Minoxidil tópico", "Minoxidil oral", "MMP capilar", "Intradermoterapia", "LEDterapia", "Transplante capilar"],
};

const AnamnesisModal = ({ open, onOpenChange, patientId, initialData, initialDate, onSaved }: Props) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AnamnesisData>(emptyAnamnesis);
  const [customDate, setCustomDate] = useState<string>(() => {
    if (initialDate) return new Date(initialDate).toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (open) {
      setForm({ ...emptyAnamnesis, ...(initialData || {}) });
      if (initialDate) {
        setCustomDate(new Date(initialDate).toISOString().slice(0, 10));
      } else {
        setCustomDate(new Date().toISOString().slice(0, 10));
      }
    }
  }, [open, initialData, initialDate]);

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
    const saveIsoDate = customDate ? new Date(`${customDate}T12:00:00Z`).toISOString() : new Date().toISOString();

    // Sincroniza automaticamente com notas importantes do paciente (Alergias e Comorbidades)
    const notesParts: string[] = [];
    if (form.allergies?.trim()) {
      notesParts.push(`Alergias: ${form.allergies.trim()}`);
    }
    if (form.comorbidities?.trim()) {
      notesParts.push(`Comorbidades: ${form.comorbidities.trim()}`);
    }

    const updatePayload: Record<string, unknown> = {
      anamnesis: form as unknown as Record<string, string>,
      anamnesis_completed_at: saveIsoDate,
    };

    if (notesParts.length > 0) {
      updatePayload.important_notes = notesParts.join(" | ");
    }

    const { error } = await supabase
      .from("patients")
      .update(updatePayload)
      .eq("id", patientId);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar a anamnese.");
      return;
    }
    toast.success("Anamnese do paciente salva com sucesso!");
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
                const singleChoiceKeys: (keyof AnamnesisData)[] = [
                  "smoking", "alcohol", "physical_activity", "water_intake", "sleep_quality",
                  "anabolic_steroids", "topical_testosterone", "haircare_washing_frequency",
                  "bowel_function", "haircare_chemical_last_time",
                  "marital_status", "has_children", "wants_children_next_year",
                  "haircare_water_temperature", "haircare_wash_time",
                ];
                if (!multiline && singleChoiceKeys.includes(k)) {
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
          <DialogTitle className="font-heading text-xl">Anamnese do Paciente</DialogTitle>
          <DialogDescription className="font-body text-xs">
            Preencha ou edite as informações clínicas e tricológicas do paciente. As informações ficam gravadas na ficha clínica.
          </DialogDescription>
        </DialogHeader>

        {/* Data da Anamnese */}
        <div className="flex items-center justify-between bg-muted/30 border border-border/80 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <Label className="text-xs font-semibold text-foreground">Data da Anamnese:</Label>
          </div>
          <Input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="w-44 h-8 text-xs bg-background"
          />
        </div>

        <div className="space-y-6 py-2">
          {/* Seção 0: Dados Pessoais e Sociais */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="w-4 h-4 text-primary" />
              <span>Dados Pessoais e Sociais</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("profession", "Ex: Advogada, autônoma, do lar...")}
              {renderField("marital_status", "Ex: Solteiro(a), casado(a)...")}
              {renderField("wants_children_next_year", "Ex: Sim / Não")}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="font-body text-xs font-semibold text-foreground/90">{anamnesisLabels.has_children}</Label>
                </div>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {quickOptions.has_children!.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => {
                        set("has_children", opt);
                        if (opt !== "Sim") set("children_quantity", "");
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        form.has_children === opt
                          ? "bg-primary text-primary-foreground border-primary font-medium"
                          : "border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {form.has_children === "Sim" && (
                  <Input
                    value={form.children_quantity}
                    onChange={(e) => set("children_quantity", e.target.value)}
                    placeholder="Quantos filhos?"
                    className="text-sm bg-background h-9"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Seção 1: Medicamentos, Alergias e Comorbidades */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Pill className="w-4 h-4 text-primary" />
              <span>Medicamentos, Alergias e Comorbidades</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("allergies", "Ex: Dipirona, frutos do mar, iodo...", true)}
              {renderField("comorbidities", "Ex: Hipotireoidismo, SOP, Hipertensão, Anemia...", true)}
            </div>
            {renderField("continuous_medications", "Ex: Losartana 50mg 1x/dia, anticoncepcional...", true)}
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

          {/* Seção 3: Hábitos, Vícios e Fisiologia */}
          <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Activity className="w-4 h-4 text-primary" />
              <span>Hábitos, Vícios e Fisiologia</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("smoking", "Ex: Não fumante / 10 cigarros ao dia")}
              {renderField("alcohol", "Ex: Social fim de semana / Não consome")}
              {renderField("physical_activity", "Ex: 3 a 5x na semana")}
              {renderField("physical_activity_type", "Ex: Musculação intensa, corrida 5km, pilates...")}
              {renderField("water_intake", "Ex: 2 a 2.5 litros ao dia")}
              {renderField("bowel_function", "Ex: Diário 1x ao dia / Constipado (a cada 3 dias)...")}
              {renderField("supplements", "Ex: Creatina, Whey, Biotina...", true)}
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2 bg-background/50 p-3 rounded-lg border border-border/60">
                {renderField("sleep_quality", "Ex: Dorme 6h, sono leve / acorda cansado...")}
                {renderField("sleep_medication", "Ex: Nega / Sim, usa Zolpidem 10mg, Melatonina...")}
              </div>
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

          {/* Seção 5: HairCare - Cuidados com o Cabelo e Couro Cabeludo (Por último) */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Scissors className="w-4 h-4" />
              <span>HairCare (Cuidados com Cabelo e Couro Cabeludo)</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {renderField("haircare_washing_frequency", "Ex: Diária / Dias alternados...")}
              {renderField("haircare_water_temperature", "Ex: Fria, morna ou quente...")}
              {renderField("haircare_wash_time", "Ex: Manhã, tarde ou noite...")}
              {renderField("haircare_shampoo_conditioner", "Ex: Shampoo antiqueda X, condicionador Y...", true)}
              {renderField("haircare_thermal_tools", "Ex: Secador após lavagem com protetor térmico...")}
              {renderField("haircare_chemical_procedures", "Ex: Luzes, coloração, botox capilar, progressiva...", true)}
              {renderField("haircare_chemical_last_time", "Ex: Fez mechas há 2 meses, última progressiva há 6 meses...")}
              {renderField("haircare_routine_products", "Ex: Shampoo antiqueda, tônico noturno, máscara...", true)}
              {renderField("haircare_scalp_symptoms", "Ex: Coceira leve, descamação, dor no topo da cabeça...", true)}
              {renderField("haircare_previous_treatments", "Ex: Minoxidil 5% tópico por 1 ano, MMP prévio...", true)}
            </div>
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
