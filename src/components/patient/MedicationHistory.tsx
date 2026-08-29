import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Calendar } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  patientId: string;
  consultations?: Tables<"consultations">[];
}

const MedicationHistory = ({ patientId, consultations = [] }: Props) => {
  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ["prescriptions", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*, prescription_items(*)")
        .eq("patient_id", patientId)
        .order("prescribed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const consultationsWithPrescription = consultations.filter((c) => c.prescription_notes?.trim());

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>;

  if ((!prescriptions || prescriptions.length === 0) && consultationsWithPrescription.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Pill className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-body text-sm">Nenhum medicamento prescrito ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {consultationsWithPrescription.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prescrições Registradas em Consulta</p>
          {consultationsWithPrescription.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(c.consultation_date).toLocaleDateString("pt-BR")}
              </div>
              <div className="flex items-start gap-2">
                <Pill className="w-3.5 h-3.5 mt-0.5 text-primary" />
                <p className="text-sm text-foreground font-body whitespace-pre-line">{c.prescription_notes}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {prescriptions?.map((rx) => (
        <div key={rx.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(rx.prescribed_at).toLocaleDateString("pt-BR")}
            <span className="ml-auto text-xs">{rx.doctor_name}</span>
          </div>
          <div className="space-y-2">
            {rx.prescription_items?.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2">
                <Pill className="w-3.5 h-3.5 mt-0.5 text-primary" />
                <div>
                  <span className="text-sm font-medium text-foreground">{item.medication_name}</span>
                  <div className="text-xs text-muted-foreground">
                    {[item.dosage, item.posology, item.duration].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {rx.notes && <p className="text-xs italic text-muted-foreground mt-2">{rx.notes}</p>}
        </div>
      ))}
    </div>
  );
};

export default MedicationHistory;
