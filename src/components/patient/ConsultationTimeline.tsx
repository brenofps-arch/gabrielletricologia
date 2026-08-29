import { Calendar, FileText, Stethoscope, Plus, Pencil, Trash2, Activity, FlaskConical } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

interface Props {
  consultations: Tables<"consultations">[];
  onNewConsultation?: () => void;
  onEditConsultation?: (consultation: Tables<"consultations">) => void;
  onDeleteConsultation?: (consultationId: string) => void;
}

const ConsultationTimeline = ({ consultations, onNewConsultation, onEditConsultation, onDeleteConsultation }: Props) => {
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
                  <p className="text-foreground font-body mt-1">{c.chief_complaint}</p>
                </div>
              )}

              {c.physical_exam && (
                <div>
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Exame Físico (Tricológico)</span>
                  <p className="text-foreground font-body mt-1">{c.physical_exam}</p>
                </div>
              )}

              {c.treatment_plan && (
                <div>
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide block">Conduta / Plano Terapêutico</span>
                  <p className="text-foreground font-body mt-1">{c.treatment_plan}</p>
                </div>
              )}

              {c.exams_brought && (
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4" /> Exames Trazidos pelo Paciente
                  </span>
                  <p className="text-foreground font-body mt-1 whitespace-pre-line">{c.exams_brought}</p>
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
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConsultationTimeline;
