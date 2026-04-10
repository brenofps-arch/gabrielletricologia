import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, FileDown, AlertTriangle, User, Phone, Mail, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ConsultationTimeline from "@/components/patient/ConsultationTimeline";
import NewConsultationModal from "@/components/patient/NewConsultationModal";
import PrescriptionModal from "@/components/patient/PrescriptionModal";
import MedicationHistory from "@/components/patient/MedicationHistory";

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConsultation, setShowConsultation] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  const { data: patient, isLoading: loadingPatient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ["consultations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select("*")
        .eq("patient_id", id!)
        .order("consultation_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const saveNotes = async () => {
    const { error } = await supabase.from("patients").update({ important_notes: notesValue }).eq("id", id!);
    if (error) toast.error("Erro ao salvar notas.");
    else {
      toast.success("Notas atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
      setEditingNotes(false);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["consultations", id] });
    queryClient.invalidateQueries({ queryKey: ["prescriptions", id] });
  };

  if (loadingPatient) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Paciente não encontrado.</p>
        <Button variant="link" onClick={() => navigate("/pacientes")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pacientes")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-semibold text-foreground">{patient.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground font-body">
            {patient.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>}
            {patient.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{patient.email}</span>}
            {patient.birth_date && <span className="flex items-center gap-1"><Cake className="w-3.5 h-3.5" />{new Date(patient.birth_date).toLocaleDateString("pt-BR")}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setShowPrescription(true)}>
            <FileDown className="w-4 h-4" /> Gerar Receita
          </Button>
          <Button className="gap-1.5" onClick={() => setShowConsultation(true)}>
            <Plus className="w-4 h-4" /> Nova Evolução
          </Button>
        </div>
      </div>

      {/* Important Notes Banner */}
      <div className="bg-rose-gold-light/50 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="w-4 h-4 text-primary" />
            Notas Importantes (Alergias / Observações)
          </div>
          <Button variant="ghost" size="sm" onClick={() => {
            if (editingNotes) saveNotes();
            else { setNotesValue(patient.important_notes || ""); setEditingNotes(true); }
          }}>
            {editingNotes ? "Salvar" : "Editar"}
          </Button>
        </div>
        {editingNotes ? (
          <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} placeholder="Ex: Alergia a sulfas, gestante, uso de anticoagulantes..." className="bg-card" />
        ) : (
          <p className="text-sm text-muted-foreground font-body">
            {patient.important_notes || "Nenhuma nota registrada. Clique em 'Editar' para adicionar."}
          </p>
        )}
      </div>

      {/* Condition badge */}
      {patient.condition && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint-light text-secondary-foreground">{patient.condition}</span>
          <span className="text-xs text-muted-foreground">{patient.sessions_count} sessões realizadas</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="timeline">Histórico de Consultas</TabsTrigger>
          <TabsTrigger value="medications">Farmacoterapia</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <ConsultationTimeline consultations={consultations} />
        </TabsContent>
        <TabsContent value="medications" className="mt-4">
          <MedicationHistory patientId={patient.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewConsultationModal open={showConsultation} onOpenChange={setShowConsultation} patientId={patient.id} onSuccess={refresh} />
      <PrescriptionModal open={showPrescription} onOpenChange={setShowPrescription} patientId={patient.id} patientName={patient.name} onSuccess={refresh} />
    </div>
  );
};

export default PatientDetail;
