import { Calendar, FileText, Stethoscope, Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

interface Props {
  consultations: Tables<"consultations">[];
  onNewConsultation?: () => void;
}

const ConsultationTimeline = ({ consultations, onNewConsultation }: Props) => {
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
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(c.consultation_date).toLocaleDateString("pt-BR")}
            </div>
            {c.diagnosis && (
              <p className="text-sm font-medium text-foreground mb-1">
                <span className="text-muted-foreground">Diagnóstico: </span>{c.diagnosis}
              </p>
            )}
            {c.chief_complaint && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Queixa: </span>{c.chief_complaint}
              </p>
            )}
            {c.treatment_plan && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">Conduta: </span>{c.treatment_plan}
              </p>
            )}
            {c.observations && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                <FileText className="w-3 h-3 inline mr-1" />{c.observations}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConsultationTimeline;
