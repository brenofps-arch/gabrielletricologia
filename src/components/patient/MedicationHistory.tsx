import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Calendar, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  patientId: string;
  consultations?: Tables<"consultations">[];
}

const today = () => new Date().toISOString().slice(0, 10);

const MedicationHistory = ({ patientId, consultations = [] }: Props) => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(today());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

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

  const openAdd = () => {
    setDate(today());
    setText("");
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!text.trim()) {
      toast.error("Descreva o que foi prescrito.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("prescriptions").insert({
      patient_id: patientId,
      user_id: user.id,
      prescribed_at: `${date || today()}T12:00:00Z`,
      notes: text.trim(),
    });
    setSaving(false);
    if (error) {
      console.error("Erro ao salvar prescrição:", error);
      toast.error(`Erro ao salvar prescrição: ${error.message}`);
      return;
    }
    toast.success("Prescrição registrada!");
    setShowAdd(false);
    queryClient.invalidateQueries({ queryKey: ["prescriptions", patientId] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este registro de prescrição?")) return;
    const { error } = await supabase.from("prescriptions").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover o registro.");
      return;
    }
    toast.success("Registro removido.");
    queryClient.invalidateQueries({ queryKey: ["prescriptions", patientId] });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>;

  const isEmpty = (!prescriptions || prescriptions.length === 0) && consultationsWithPrescription.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={openAdd}>
          <Plus className="w-4 h-4" /> Adicionar prescrição
        </Button>
      </div>

      {isEmpty && (
        <div className="text-center py-12 text-muted-foreground">
          <Pill className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-body text-sm">Nenhum medicamento prescrito ainda.</p>
        </div>
      )}

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
      {prescriptions?.map((rx) => {
        const hasItems = (rx.prescription_items?.length ?? 0) > 0;
        return (
          <div key={rx.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(rx.prescribed_at).toLocaleDateString("pt-BR")}
              {hasItems ? (
                <span className="ml-auto text-xs">{rx.doctor_name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDelete(rx.id)}
                  className="ml-auto p-1 rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
                  title="Remover registro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {hasItems ? (
              <>
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
              </>
            ) : (
              <div className="flex items-start gap-2">
                <Pill className="w-3.5 h-3.5 mt-0.5 text-primary" />
                <p className="text-sm text-foreground font-body whitespace-pre-line">{rx.notes}</p>
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Adicionar prescrição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-body text-sm">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-44" />
            </div>
            <div>
              <Label className="font-body text-sm">O que foi prescrito *</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"Ex:\n1) Minoxidil 1 mg (0.0.1)\n2) Dutasterida 0,5 mg (3x/semana)"}
                className="mt-1 min-h-[140px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MedicationHistory;
