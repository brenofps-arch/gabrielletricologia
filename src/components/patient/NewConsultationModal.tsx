import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnamnesisData, anamnesisLabels } from "./AnamnesisModal";
import {
  ChevronDown, ChevronUp, ClipboardList, Calendar, Microscope, Activity, FlaskConical,
  ArrowLeft, RotateCcw, Syringe,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  consultation?: Tables<"consultations"> | null;
  previousConsultations?: Tables<"consultations">[];
  anamnesis?: AnamnesisData | null;
  onSuccess: () => void;
}

type ViewMode = "chooser" | "full" | "retorno" | "procedimento";

const PROCEDURE_TYPES = ["MMP", "PRP", "Mesoterapia", "Mesoject", "Microlyzer", "Exossomos", "Outros"];

interface TrichoscopyExam {
  // Exame Macroscópico
  macro_eyebrows_sideburns: string;
  macro_hair_line: string;
  macro_facial_papules: string;
  macro_midline_widening: string;
  macro_vertex_rarefaction: string;
  macro_prominent_recession: string;
  // Tricoscopia
  follicular_opening_present: string;
  follicular_openings: string;
  hairs_per_fu: string;
  anisotrichosis: string;
  vellus: string;
  hair_morphology: string;
  perifollicular_sign: string;
  follicular_sign: string;
  vessels: string;
  pull_test: string;
}

const emptyTrichoscopy: TrichoscopyExam = {
  macro_eyebrows_sideburns: "",
  macro_hair_line: "",
  macro_facial_papules: "",
  macro_midline_widening: "",
  macro_vertex_rarefaction: "",
  macro_prominent_recession: "",
  follicular_opening_present: "",
  follicular_openings: "",
  hairs_per_fu: "",
  anisotrichosis: "",
  vellus: "",
  hair_morphology: "",
  perifollicular_sign: "",
  follicular_sign: "",
  vessels: "",
  pull_test: "",
};

const trichoscopyOptions: Record<keyof TrichoscopyExam, string[]> = {
  macro_eyebrows_sideburns: ["Sobrancelhas e costeletas preservadas", "Rarefação de sobrancelhas", "Rarefação de costeletas"],
  macro_hair_line: ["Hairline preservada", "Hairline recuada", "Hairline em M", "Hairline irregular"],
  macro_facial_papules: ["Sim", "Não"],
  macro_midline_widening: ["Sim", "Não"],
  macro_vertex_rarefaction: ["Sim", "Não"],
  macro_prominent_recession: ["Sim", "Não"],
  follicular_opening_present: ["Sim", "Não"],
  follicular_openings: ["Preservadas / Normais", "Diminuídas", "Ausência focal", "Pontos amarelos"],
  hairs_per_fu: ["Predomínio de 1 fio", "1 a 2 fios", "2 a 3 fios (normal)", "3 a 4 fios"],
  anisotrichosis: ["Não / Ausente", "Presente (> 20%)", "Leve (< 20%)"],
  vellus: ["Ausentes", "Presentes no vértex", "Presentes na linha anterior", "Acentuados"],
  hair_morphology: ["Sem alterações", "Tricoptilose (pontas duplas)", "Tricorrexe nodosa", "Fios em ponto de exclamação", "Fios quebradiços", "Cabelos em tufo"],
  perifollicular_sign: ["Ausente / Normal", "Eritema perifolicular", "Descamação peripilar (colarete)", "Hiperqueratose folicular", "Halo branco peripilar"],
  follicular_sign: ["Sem alterações", "Pontos amarelos (Yellow dots)", "Pontos pretos (Black dots)", "Pontos brancos", "Pontos vermelhos", "Halo marrom"],
  vessels: ["Padrão normal (alças)", "Arboriformes", "Ectásicos / Tortuosos", "Pontilhados", "Ausentes"],
  pull_test: ["Negativo (normal)", "Positivo difuso", "Positivo em vértex", "Positivo frontal", "Positivo parietal", "Fios anágenos", "Fios telógenos"],
};

const getVisitMode = (c: Tables<"consultations"> | null | undefined): ViewMode => {
  if (!c) return "full";
  if (c.visit_type === "retorno") return "retorno";
  if (c.visit_type === "procedimento") return "procedimento";
  return "full";
};

const NewConsultationModal = ({ open, onOpenChange, patientId, consultation, previousConsultations = [], anamnesis, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [showAnamnesisSummary, setShowAnamnesisSummary] = useState(false);
  const [showTrichoscopyFields, setShowTrichoscopyFields] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("full");

  const [form, setForm] = useState({
    consultation_date: new Date().toISOString().slice(0, 10),
    chief_complaint: "",
    physical_exam_notes: "",
    diagnosis: "",
    treatment_plan: "",
    prescription_notes: "",
    observations: "",
    exams_brought: "",
    procedure_type: "",
    procedure_number: "",
    procedure_medications: "",
  });

  const [exam, setExam] = useState<TrichoscopyExam>(emptyTrichoscopy);

  useEffect(() => {
    if (open) {
      if (consultation) {
        setForm({
          consultation_date: consultation.consultation_date
            ? new Date(consultation.consultation_date).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          chief_complaint: consultation.chief_complaint || "",
          physical_exam_notes: consultation.physical_exam || "",
          diagnosis: consultation.diagnosis || "",
          treatment_plan: consultation.treatment_plan || "",
          prescription_notes: consultation.prescription_notes || "",
          observations: consultation.observations || "",
          exams_brought: consultation.exams_brought || "",
          procedure_type: consultation.procedure_type || "",
          procedure_number: consultation.procedure_number != null ? String(consultation.procedure_number) : "",
          procedure_medications: consultation.procedure_medications || "",
        });
        setExam(emptyTrichoscopy);
        setViewMode(getVisitMode(consultation));
      } else {
        setForm({
          consultation_date: new Date().toISOString().slice(0, 10),
          chief_complaint: "",
          physical_exam_notes: "",
          diagnosis: "",
          treatment_plan: "",
          prescription_notes: "",
          observations: "",
          exams_brought: "",
          procedure_type: "",
          procedure_number: "",
          procedure_medications: "",
        });
        setExam(emptyTrichoscopy);
        setViewMode(previousConsultations.length === 0 ? "full" : "chooser");
      }
    }
  }, [open, consultation]);

  const setExamField = (k: keyof TrichoscopyExam, val: string) => {
    setExam((prev) => ({ ...prev, [k]: val }));
  };

  const computeProcedureNumber = (type: string) => {
    if (!type) return "";
    const count = previousConsultations.filter(
      (c) => c.visit_type === "procedimento" && c.procedure_type === type && c.id !== consultation?.id
    ).length;
    return String(count + 1);
  };

  const selectProcedureType = (type: string) => {
    setForm((f) => ({ ...f, procedure_type: type, procedure_number: computeProcedureNumber(type) }));
  };

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

    let payload: Record<string, unknown>;

    if (viewMode === "retorno") {
      payload = {
        consultation_date: saveIsoDate,
        visit_type: "retorno",
        chief_complaint: form.chief_complaint || null,
        physical_exam: form.physical_exam_notes || null,
        exams_brought: form.exams_brought || null,
        treatment_plan: form.treatment_plan || null,
        diagnosis: null,
        prescription_notes: null,
        observations: null,
        procedure_type: null,
        procedure_number: null,
        procedure_medications: null,
      };
    } else if (viewMode === "procedimento") {
      payload = {
        consultation_date: saveIsoDate,
        visit_type: "procedimento",
        procedure_type: form.procedure_type || null,
        procedure_number: form.procedure_number ? parseInt(form.procedure_number, 10) : null,
        procedure_medications: form.procedure_medications || null,
        observations: form.observations || null,
        treatment_plan: form.treatment_plan || null,
        chief_complaint: null,
        physical_exam: null,
        exams_brought: null,
        diagnosis: null,
        prescription_notes: null,
      };
    } else {
      // Compila os achados do exame macroscópico
      const macroLines: string[] = [];
      if (exam.macro_eyebrows_sideburns) macroLines.push(`• Sobrancelhas e costeletas: ${exam.macro_eyebrows_sideburns}`);
      if (exam.macro_hair_line) macroLines.push(`• Hair line: ${exam.macro_hair_line}`);
      if (exam.macro_facial_papules) macroLines.push(`• Pápulas em face: ${exam.macro_facial_papules}`);
      if (exam.macro_midline_widening) macroLines.push(`• Alargamento de linha média: ${exam.macro_midline_widening}`);
      if (exam.macro_vertex_rarefaction) macroLines.push(`• Rarefação em vértex: ${exam.macro_vertex_rarefaction}`);
      if (exam.macro_prominent_recession) macroLines.push(`• Entradas proeminentes: ${exam.macro_prominent_recession}`);

      const examLines: string[] = [];
      if (macroLines.length > 0) {
        examLines.push("EXAME MACROSCÓPICO");
        examLines.push(...macroLines);
        examLines.push("");
        examLines.push("TRICOSCOPIA");
      }
      if (exam.follicular_opening_present) examLines.push(`• Abertura folicular: ${exam.follicular_opening_present}`);
      if (exam.follicular_openings) examLines.push(`• Presença de abertura folicular: ${exam.follicular_openings}`);
      if (exam.hairs_per_fu) examLines.push(`• Fios por UF: ${exam.hairs_per_fu}`);
      if (exam.anisotrichosis || exam.vellus) {
        const diam = [
          exam.anisotrichosis ? `Anisotricose: ${exam.anisotrichosis}` : "",
          exam.vellus ? `Velus: ${exam.vellus}` : "",
        ].filter(Boolean).join(" | ");
        examLines.push(`• Diâmetro dos fios: ${diam}`);
      }
      if (exam.hair_morphology) examLines.push(`• Morfologia dos fios: ${exam.hair_morphology}`);
      if (exam.perifollicular_sign) examLines.push(`• Sinal perifolicular: ${exam.perifollicular_sign}`);
      if (exam.follicular_sign) examLines.push(`• Sinal folicular: ${exam.follicular_sign}`);
      if (exam.vessels) examLines.push(`• Vasos: ${exam.vessels}`);
      if (exam.pull_test) examLines.push(`• PULL TEST: ${exam.pull_test}`);

      let fullPhysicalExam = "";
      if (examLines.length > 0) {
        fullPhysicalExam = examLines.join("\n");
        if (form.physical_exam_notes.trim()) {
          fullPhysicalExam += `\n\nOutras observações do exame físico:\n${form.physical_exam_notes.trim()}`;
        }
      } else {
        fullPhysicalExam = form.physical_exam_notes.trim();
      }

      payload = {
        consultation_date: saveIsoDate,
        visit_type: null,
        chief_complaint: form.chief_complaint || null,
        physical_exam: fullPhysicalExam || null,
        diagnosis: form.diagnosis || null,
        treatment_plan: form.treatment_plan || null,
        prescription_notes: form.prescription_notes || null,
        observations: form.observations || null,
        exams_brought: form.exams_brought || null,
        procedure_type: null,
        procedure_number: null,
        procedure_medications: null,
      };
    }

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

    // Atualiza o diagnóstico na ficha do paciente quando preenchido na evolução completa
    if (!saveError && viewMode === "full" && form.diagnosis.trim()) {
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

  const renderTrichoscopyInput = (key: keyof TrichoscopyExam, label: string, placeholder: string) => (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground/90">{label}</Label>
      <div className="flex flex-wrap gap-1 pb-1">
        {trichoscopyOptions[key].map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => setExamField(key, opt)}
            className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
              exam[key] === opt
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <Input
        value={exam[key]}
        onChange={(e) => setExamField(key, e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs bg-background"
      />
    </div>
  );

  const dialogTitle = () => {
    if (consultation) {
      if (viewMode === "retorno") return "Editar Retorno";
      if (viewMode === "procedimento") return "Editar Procedimento";
      return "Editar Evolução Clínica";
    }
    if (viewMode === "chooser") return "Nova Evolução Clínica";
    if (viewMode === "retorno") return "Registrar Retorno";
    if (viewMode === "procedimento") return "Registrar Procedimento";
    return "Inserir Evolução Clínica";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-1.5">
            {!consultation && viewMode !== "chooser" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1.5"
                onClick={() => setViewMode("chooser")}
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            {dialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {viewMode === "chooser" ? (
          <div className="grid sm:grid-cols-2 gap-4 py-6">
            <button
              type="button"
              onClick={() => setViewMode("retorno")}
              className="flex flex-col items-center text-center gap-2 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <RotateCcw className="w-8 h-8 text-primary" />
              <span className="font-heading text-base font-semibold text-foreground">Retorno</span>
              <span className="text-xs text-muted-foreground">Queixa, exame físico, exames laboratoriais e conduta</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("procedimento")}
              className="flex flex-col items-center text-center gap-2 p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Syringe className="w-8 h-8 text-primary" />
              <span className="font-heading text-base font-semibold text-foreground">Procedimento</span>
              <span className="text-xs text-muted-foreground">MMP, PRP, Mesoterapia, Mesoject, Microlyzer, Exossomos...</span>
            </button>
          </div>
        ) : (
          <>
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

            {/* Resumo rápido da Anamnese para consulta durante o atendimento */}
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

            {viewMode === "full" && (
              <div className="space-y-5">
                {/* Queixa Principal */}
                <div>
                  <Label className="font-body text-sm font-semibold">Queixa Principal</Label>
                  <Textarea
                    value={form.chief_complaint}
                    onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                    placeholder="Descreva a queixa do paciente nesta consulta..."
                    className="mt-1 min-h-[70px]"
                  />
                </div>

                {/* Exame Macroscópico */}
                <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Microscope className="w-4 h-4" />
                    <span>Exame Macroscópico</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {renderTrichoscopyInput("macro_eyebrows_sideburns", "Descrever sobrancelhas e costeletas:", "Ex: Sobrancelhas e costeletas preservadas...")}
                    {renderTrichoscopyInput("macro_hair_line", "Hair line:", "Ex: Hairline preservada, recuada...")}
                    {renderTrichoscopyInput("macro_facial_papules", "Tem pápulas em face?", "Sim / Não")}
                    {renderTrichoscopyInput("macro_midline_widening", "Alargamento de linha média?", "Sim / Não")}
                    {renderTrichoscopyInput("macro_vertex_rarefaction", "Rarefação em vértex?", "Sim / Não")}
                    {renderTrichoscopyInput("macro_prominent_recession", "Entradas proeminentes?", "Sim / Não")}
                  </div>
                </div>

                {/* Exame Físico Tricológico Estruturado */}
                <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <Microscope className="w-4 h-4" />
                      <span>Exame Físico / Tricoscopia</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setShowTrichoscopyFields(!showTrichoscopyFields)}
                    >
                      {showTrichoscopyFields ? "Ocultar Parâmetros" : "Exibir Parâmetros"}
                    </Button>
                  </div>

                  {showTrichoscopyFields && (
                    <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-border/60">
                      {renderTrichoscopyInput("follicular_opening_present", "Abertura folicular:", "Sim / Não")}
                      {renderTrichoscopyInput("follicular_openings", "Presença de abertura folicular:", "Ex: Preservadas, ausentes...")}
                      {renderTrichoscopyInput("hairs_per_fu", "Fios por UF:", "Ex: 1 a 2 fios, predomínio 1...")}

                      {/* Diâmetro dos fios: Anisotricose e Velus */}
                      <div className="sm:col-span-2 bg-background/60 p-3 rounded-lg border border-border/60 space-y-3">
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Diâmetro dos fios</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {renderTrichoscopyInput("anisotrichosis", "Anisotricose?", "Ex: Presente (> 20%)...")}
                          {renderTrichoscopyInput("vellus", "Velus?", "Ex: Presentes no vértex...")}
                        </div>
                      </div>

                      {renderTrichoscopyInput("hair_morphology", "Morfologia dos fios / algo alterado?", "Ex: Sem alterações, tricoptilose...")}
                      {renderTrichoscopyInput("perifollicular_sign", "Sinal perifolicular (couro cabeludo):", "Ex: Ausente, eritema, colarete...")}
                      {renderTrichoscopyInput("follicular_sign", "Sinal folicular:", "Ex: Pontos amarelos, pontos pretos...")}
                      {renderTrichoscopyInput("vessels", "Vasos:", "Ex: Normais em alça, arboriformes...")}

                      {/* PULL TEST em destaque */}
                      <div className="sm:col-span-2 bg-primary/5 p-3 rounded-lg border border-primary/30 space-y-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> PULL TEST
                        </span>
                        <div className="flex flex-wrap gap-1 pb-1">
                          {trichoscopyOptions.pull_test.map((opt) => (
                            <button
                              type="button"
                              key={opt}
                              onClick={() => setExamField("pull_test", opt)}
                              className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                                exam.pull_test === opt
                                  ? "bg-primary text-primary-foreground border-primary font-medium"
                                  : "border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={exam.pull_test}
                          onChange={(e) => setExamField("pull_test", e.target.value)}
                          placeholder="Ex: Negativo / Positivo difuso (3 fios telógenos)..."
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                    </div>
                  )}

                  {/* Observações adicionais do Exame Físico (Caixa Maior) */}
                  <div className="pt-2">
                    <Label className="font-body text-xs font-semibold text-muted-foreground">
                      Observações Adicionais do Exame Físico (Caixa Ampliada)
                    </Label>
                    <Textarea
                      value={form.physical_exam_notes}
                      onChange={(e) => setForm({ ...form, physical_exam_notes: e.target.value })}
                      placeholder="Descreva detalhes adicionais do couro cabeludo, áreas afetadas, achados macroscópicos..."
                      className="mt-1 min-h-[120px] text-sm bg-background"
                    />
                  </div>
                </div>

                {/* Diagnóstico */}
                <div>
                  <Label className="font-body text-sm font-semibold">Diagnóstico</Label>
                  <Input
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="Ex: Alopecia Androgenética, Eflúvio Telógeno..."
                    className="mt-1"
                  />
                </div>

                {/* Conduta / Plano Terapêutico */}
                <div>
                  <Label className="font-body text-sm font-semibold">Conduta / Plano Terapêutico</Label>
                  <Textarea
                    value={form.treatment_plan}
                    onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })}
                    placeholder="Descreva a conduta adotada (procedimentos em consultório, MMP, LED, orientações)..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                {/* Prescrição */}
                <div>
                  <Label className="font-body text-sm font-semibold">Prescrição</Label>
                  <Textarea
                    value={form.prescription_notes}
                    onChange={(e) => setForm({ ...form, prescription_notes: e.target.value })}
                    placeholder="Medicamentos, fórmulas manipuladas, tônicos ou loções prescritas..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                {/* Observações */}
                <div>
                  <Label className="font-body text-sm font-semibold">Observações Gerais</Label>
                  <Textarea
                    value={form.observations}
                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                    placeholder="Notas adicionais ou orientações para o próximo retorno..."
                    className="mt-1 min-h-[60px]"
                  />
                </div>

                {/* Exames Trazidos pelo Paciente (Caixa Final) */}
                <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <FlaskConical className="w-4 h-4" />
                    <span>Exames Trazidos pelo Paciente</span>
                  </div>
                  <Textarea
                    value={form.exams_brought}
                    onChange={(e) => setForm({ ...form, exams_brought: e.target.value })}
                    placeholder="Ex: Hemograma, ferritina, TSH... Registre aqui os exames e resultados trazidos pelo paciente nesta consulta..."
                    className="mt-1 min-h-[100px] text-sm bg-background"
                  />
                </div>
              </div>
            )}

            {viewMode === "retorno" && (
              <div className="space-y-5">
                <div>
                  <Label className="font-body text-sm font-semibold">Queixa</Label>
                  <Textarea
                    value={form.chief_complaint}
                    onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                    placeholder="Descreva a queixa relatada pelo paciente neste retorno..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="font-body text-sm font-semibold">Exame Físico</Label>
                  <Textarea
                    value={form.physical_exam_notes}
                    onChange={(e) => setForm({ ...form, physical_exam_notes: e.target.value })}
                    placeholder="Descreva os achados do exame físico neste retorno..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="font-body text-sm font-semibold">Exames Laboratoriais</Label>
                  <Textarea
                    value={form.exams_brought}
                    onChange={(e) => setForm({ ...form, exams_brought: e.target.value })}
                    placeholder="Resultados de exames laboratoriais trazidos ou discutidos neste retorno..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="font-body text-sm font-semibold">Conduta</Label>
                  <Textarea
                    value={form.treatment_plan}
                    onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })}
                    placeholder="Descreva a conduta adotada neste retorno..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>
            )}

            {viewMode === "procedimento" && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="font-body text-sm font-semibold">Tipo de Procedimento</Label>
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {PROCEDURE_TYPES.map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => selectProcedureType(opt)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          form.procedure_type === opt
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={form.procedure_type}
                    onChange={(e) => setForm({ ...form, procedure_type: e.target.value })}
                    onBlur={(e) => setForm((f) => ({ ...f, procedure_number: f.procedure_number || computeProcedureNumber(e.target.value) }))}
                    placeholder="Ex: MMP, PRP, Mesoterapia... ou especifique (Outros)"
                    className="text-sm bg-background h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-body text-sm font-semibold">Número do Procedimento</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.procedure_number}
                    onChange={(e) => setForm({ ...form, procedure_number: e.target.value })}
                    placeholder="Ex: 1, 2, 3..."
                    className="text-sm bg-background h-9 w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculado automaticamente com base no histórico de procedimentos deste tipo. Pode ser ajustado manualmente.
                  </p>
                </div>

                <div>
                  <Label className="font-body text-sm font-semibold">Medicações Usadas no Procedimento</Label>
                  <Textarea
                    value={form.procedure_medications}
                    onChange={(e) => setForm({ ...form, procedure_medications: e.target.value })}
                    placeholder="Ex: Minoxidil injetável, Dutasterida, PRP puro, vitaminas..."
                    className="mt-1 min-h-[80px]"
                  />
                </div>

                <div>
                  <Label className="font-body text-sm font-semibold">Observações</Label>
                  <Textarea
                    value={form.observations}
                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                    placeholder="Notas adicionais sobre o procedimento..."
                    className="mt-1 min-h-[70px]"
                  />
                </div>

                <div>
                  <Label className="font-body text-sm font-semibold">Conduta</Label>
                  <Textarea
                    value={form.treatment_plan}
                    onChange={(e) => setForm({ ...form, treatment_plan: e.target.value })}
                    placeholder="Descreva a conduta adotada..."
                    className="mt-1 min-h-[70px]"
                  />
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {viewMode !== "chooser" && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Salvando..." : consultation ? "Salvar Alterações" : "Salvar Evolução"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewConsultationModal;
