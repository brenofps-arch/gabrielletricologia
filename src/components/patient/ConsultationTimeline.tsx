import { useQuery } from "@tanstack/react-query";
import { Calendar, FileText, Stethoscope, Plus, Pencil, Trash2, FlaskConical, RotateCcw, Syringe, Images } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const CONSULTATION_PHOTOS_BUCKET = "consultation-photos";

interface Props {
  consultations: Tables<"consultations">[];
  patientId: string;
  onNewConsultation?: () => void;
  onEditConsultation?: (consultation: Tables<"consultations">) => void;
  onDeleteConsultation?: (consultationId: string) => void;
}

// Achados de exame compilados vêm como linhas "• Rótulo: valor" e cabeçalhos em maiúsculas
// (ex: "EXAME MACROSCÓPICO"). Isso quebra o texto em tópicos legíveis em vez de um bloco corrido.
const renderExamContent = (text: string) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("• ")) {
          const content = line.slice(2);
          const sepIdx = content.indexOf(":");
          if (sepIdx > -1) {
            const label = content.slice(0, sepIdx);
            const value = content.slice(sepIdx + 1).trim();
            return (
              <div key={i} className="flex flex-wrap gap-1 text-sm">
                <span className="font-semibold text-foreground">{label}:</span>
                <span className="text-foreground/90 font-body">{value}</span>
              </div>
            );
          }
          return <p key={i} className="text-sm text-foreground font-body">{content}</p>;
        }
        if (line.endsWith(":") || line === line.toUpperCase()) {
          return (
            <p key={i} className="text-xs font-bold text-primary uppercase tracking-wide mt-3 first:mt-0">
              {line}
            </p>
          );
        }
        return <p key={i} className="text-sm text-foreground font-body">{line}</p>;
      })}
    </div>
  );
};

const renderFieldContent = (text: string) => {
  if (text.includes("• ")) return renderExamContent(text);
  return <p className="text-sm text-foreground font-body whitespace-pre-line mt-1">{text}</p>;
};

const visitBadge = (visitType: string | null) => {
  if (visitType === "retorno") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/20 text-secondary-foreground flex items-center gap-1">
        <RotateCcw className="w-3 h-3" /> Retorno
      </span>
    );
  }
  if (visitType === "procedimento") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
        <Syringe className="w-3 h-3" /> Procedimento
      </span>
    );
  }
  return null;
};

const ConsultationTimeline = ({ consultations, patientId, onNewConsultation, onEditConsultation, onDeleteConsultation }: Props) => {
  const { data: photosByConsultation = {} } = useQuery({
    queryKey: ["consultation_photos_all", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_photos")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return {} as Record<string, { id: string; file_name: string; url: string }[]>;
      const { data: signed } = await supabase.storage
        .from(CONSULTATION_PHOTOS_BUCKET)
        .createSignedUrls(data.map((p) => p.file_path), 3600);
      const withUrls = data.map((p, i) => ({ id: p.id, file_name: p.file_name, consultation_id: p.consultation_id, url: signed?.[i]?.signedUrl || "" }));
      return withUrls.reduce((acc, p) => {
        (acc[p.consultation_id] ||= []).push(p);
        return acc;
      }, {} as Record<string, { id: string; file_name: string; url: string }[]>);
    },
  });

  if (consultations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl p-8">
        <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-40 text-primary" />
        <p className="font-body text-sm font-medium text-foreground mb-1">Nenhuma consulta registrada ainda.</p>
        <p className="font-body text-xs text-muted-foreground mb-4">
          Ao registrar a primeira evolução, será solicitado o preenchimento da anamnese inicial.
        </p>
        {onNewConsultation && (
          <Button onClick={onNewConsultation} className="gap-2">
            <Plus className="w-4 h-4" /> Inserir Evolução (1ª Consulta)
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consultations.map((c) => (
        <div key={c.id} className="relative pl-8 pb-6 border-l-2 border-border last:border-l-0 last:pb-0">
          <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-card" />
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm hover:border-border/80 transition-colors">
            {/* Header com Data e Ações de Edição */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 pb-2 border-b border-border/50">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">
                  Consulta de {new Date(c.consultation_date).toLocaleDateString("pt-BR")}
                </span>
                {visitBadge(c.visit_type)}
              </div>
              <div className="flex items-center gap-1">
                {onEditConsultation && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1.5 text-foreground hover:bg-muted"
                    onClick={() => onEditConsultation(c)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar Consulta
                  </Button>
                )}
                {onDeleteConsultation && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    title="Excluir consulta"
                    onClick={() => onDeleteConsultation(c.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Conteúdo Clínico */}
            {c.visit_type === "retorno" ? (
              <div className="space-y-5 text-sm">
                {c.chief_complaint && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Queixa</span>
                    {renderFieldContent(c.chief_complaint)}
                  </div>
                )}
                {c.physical_exam && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Exame Físico</span>
                    {renderFieldContent(c.physical_exam)}
                  </div>
                )}
                {c.exams_brought && (
                  <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <span className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4" /> Exames Laboratoriais
                    </span>
                    {renderFieldContent(c.exams_brought)}
                  </div>
                )}
                {c.treatment_plan && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Conduta</span>
                    {renderFieldContent(c.treatment_plan)}
                  </div>
                )}
              </div>
            ) : c.visit_type === "procedimento" ? (
              <div className="space-y-5 text-sm">
                {c.procedure_type && (
                  <div className="p-2.5 rounded-lg bg-mint-light/40 border border-secondary/30">
                    <p className="text-sm font-bold text-secondary-foreground uppercase tracking-wide">Procedimento</p>
                    <p className="font-bold text-foreground font-heading mt-1">
                      {c.procedure_type}
                      {c.procedure_number ? ` — Sessão nº ${c.procedure_number}` : ""}
                    </p>
                  </div>
                )}
                {c.procedure_medications && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Medicações Usadas no Procedimento</span>
                    {renderFieldContent(c.procedure_medications)}
                  </div>
                )}
                {c.observations && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Observações</span>
                    {renderFieldContent(c.observations)}
                  </div>
                )}
                {c.treatment_plan && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Conduta</span>
                    {renderFieldContent(c.treatment_plan)}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                {c.diagnosis && (
                  <div className="p-2.5 rounded-lg bg-mint-light/40 border border-secondary/30">
                    <p className="text-sm font-bold text-secondary-foreground uppercase tracking-wide">Diagnóstico</p>
                    <p className="font-bold text-foreground font-heading mt-1">{c.diagnosis}</p>
                  </div>
                )}

                {c.chief_complaint && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Queixa</span>
                    {renderFieldContent(c.chief_complaint)}
                  </div>
                )}

                {c.physical_exam && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Exame Físico (Tricológico)</span>
                    {renderFieldContent(c.physical_exam)}
                  </div>
                )}

                {c.treatment_plan && (
                  <div>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Conduta / Plano Terapêutico</span>
                    {renderFieldContent(c.treatment_plan)}
                  </div>
                )}

                {c.exams_brought && (
                  <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <span className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                      <FlaskConical className="w-4 h-4" /> Exames Trazidos pelo Paciente
                    </span>
                    {renderFieldContent(c.exams_brought)}
                  </div>
                )}

                {c.observations && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 inline" /> {c.observations}
                    </p>
                  </div>
                )}
              </div>
            )}

            {photosByConsultation[c.id]?.length > 0 && (
              <div className="pt-3 mt-3 border-t border-border/50">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Images className="w-4 h-4" /> Arquivos Anexados
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {photosByConsultation[c.id].map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-md overflow-hidden border border-border bg-muted block"
                    >
                      <img src={p.url} alt={p.file_name} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConsultationTimeline;
