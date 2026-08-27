import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, FileDown, AlertTriangle, Phone, Mail, Cake, Pencil, Receipt, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { formatPhone } from "@/lib/utils";import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ConsultationTimeline from "@/components/patient/ConsultationTimeline";
import NewConsultationModal from "@/components/patient/NewConsultationModal";
import PrescriptionModal from "@/components/patient/PrescriptionModal";
import MedicationHistory from "@/components/patient/MedicationHistory";
import EditPatientModal from "@/components/patient/EditPatientModal";
import QuoteModal from "@/components/patient/QuoteModal";
import QuoteHistory from "@/components/patient/QuoteHistory";
import PaymentHistory from "@/components/patient/PaymentHistory";
import AnamnesisModal, { AnamnesisData, anamnesisLabels } from "@/components/patient/AnamnesisModal";

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConsultation, setShowConsultation] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showAnamnesis, setShowAnamnesis] = useState(false);
  const [openConsultationAfterAnamnesis, setOpenConsultationAfterAnamnesis] = useState(false);
  const [anamnesisCollapsed, setAnamnesisCollapsed] = useState(true);


  // Exclusão do paciente — dupla confirmação
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

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

  const handleDeletePatient = async () => {
    const { error } = await supabase.from("patients").delete().eq("id", id!);
    if (error) toast.error("Erro ao excluir paciente.");
    else {
      toast.success("Paciente excluído com sucesso.");
      navigate("/pacientes");
    }
    setDeleteStep(0);
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["patient", id] });
    queryClient.invalidateQueries({ queryKey: ["consultations", id] });
    queryClient.invalidateQueries({ queryKey: ["prescriptions", id] });
    queryClient.invalidateQueries({ queryKey: ["quotes", id] });
  };

  const anamnesis = (patient?.anamnesis ?? null) as AnamnesisData | null;
  const hasCompletedAnamnesis = Boolean(
    patient?.anamnesis_completed_at ||
    (anamnesis && Object.values(anamnesis).some((v) => typeof v === "string" && v.trim().length > 0))
  );

  const handleNewConsultation = () => {
    // Se for a primeira consulta ou a anamnese ainda não estiver concluída, abre o modal de Anamnese
    if (!hasCompletedAnamnesis || consultations.length === 0) {
      setOpenConsultationAfterAnamnesis(true);
      setShowAnamnesis(true);
    } else {
      setShowConsultation(true);
    }
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
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground font-body flex-wrap">
            {patient.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{formatPhone(patient.phone)}</span>}
            {patient.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{patient.email}</span>}
            {patient.birth_date && <span className="flex items-center gap-1"><Cake className="w-3.5 h-3.5" />{new Date(patient.birth_date).toLocaleDateString("pt-BR")}</span>}
            {patient.cpf && <span className="flex items-center gap-1 text-xs">CPF: {patient.cpf}</span>}
            {patient.referral_source && (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                {{
                  indicacao: "👥 Indicação de paciente",
                  google: "🔍 Google",
                  anuncio: "📢 Anúncio",
                  instagram_organico: "📸 Instagram orgânico",
                  tiktok: "🎵 TikTok",
                  indicacao_medico: "🩺 Indicação médica",
                  retorno: "🔄 Retorno",
                  outro: "➕ Outro",
                }[patient.referral_source] ?? patient.referral_source}
              </span>
            )}
          </div>

        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="icon" onClick={() => setShowEdit(true)} title="Editar paciente">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setDeleteStep(1)} title="Excluir paciente"
            className="text-destructive border-destructive/30 hover:bg-destructive/5">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setShowPrescription(true)}>
            <FileDown className="w-4 h-4" /> Gerar Receita
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => setShowQuote(true)}>
            <Receipt className="w-4 h-4" /> Gerar Orçamento
          </Button>
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleNewConsultation}>
            <Plus className="w-4 h-4" /> Inserir Evolução
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

      {/* Queixa inicial — guia para a primeira consulta */}
      {patient.condition && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Queixa inicial</p>
          <p className="text-sm text-foreground font-body">{patient.condition}</p>
        </div>
      )}

      {/* Anamnese do paciente */}
      <div className="bg-card border border-border rounded-xl p-4 transition-all">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => hasCompletedAnamnesis && setAnamnesisCollapsed(!anamnesisCollapsed)}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span>Anamnese do Paciente</span>
              {patient.anamnesis_completed_at && (
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-mint-light text-secondary-foreground">
                  Concluída em {new Date(patient.anamnesis_completed_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {hasCompletedAnamnesis && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setAnamnesisCollapsed(!anamnesisCollapsed)}
                >
                  {anamnesisCollapsed ? (
                    <>
                      <ChevronDown className="w-4 h-4" /> Ver Anamnese
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4" /> Recolher
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAnamnesis(true)}>
                  Editar Anamnese
                </Button>
              </>
            )}
          </div>
        </div>

        {hasCompletedAnamnesis && anamnesis ? (
          !anamnesisCollapsed && (
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 pt-3 mt-3 border-t border-border/60 text-sm animate-fade-in">
              {(Object.keys(anamnesisLabels) as (keyof AnamnesisData)[])
                .filter((k) => anamnesis[k]?.trim())
                .map((k) => (
                  <div key={k} className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground">{anamnesisLabels[k]}</p>
                    <p className="text-sm font-medium text-foreground font-body mt-0.5">{anamnesis[k]}</p>
                  </div>
                ))}
            </div>
          )
        ) : (
          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground font-body">
            <span>Ainda não preenchida. Será solicitada automaticamente ao clicar em <strong>Inserir evolução</strong>.</span>
            <Button size="sm" variant="outline" onClick={() => { setOpenConsultationAfterAnamnesis(false); setShowAnamnesis(true); }}>
              Preencher anamnese
            </Button>
          </div>
        )}
      </div>

      {/* Diagnóstico + sessões */}
      <div className="flex items-center gap-2 flex-wrap">
        {patient.diagnosis && (
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint-light text-secondary-foreground">
            Diagnóstico: {patient.diagnosis}
          </span>
        )}
        {patient.sessions_count > 0 && (
          <span className="text-xs text-muted-foreground">{patient.sessions_count} sessões realizadas</span>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="timeline">Histórico de Consultas ({consultations.length})</TabsTrigger>
          <TabsTrigger value="medications">Farmacoterapia</TabsTrigger>
          <TabsTrigger value="quotes">Orçamentos</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4">
          <ConsultationTimeline consultations={consultations} onNewConsultation={handleNewConsultation} />
        </TabsContent>
        <TabsContent value="medications" className="mt-4">
          <MedicationHistory patientId={patient.id} />
        </TabsContent>
        <TabsContent value="quotes" className="mt-4">
          <QuoteHistory patientId={patient.id} patientName={patient.name} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentHistory patientId={patient.id} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewConsultationModal
        open={showConsultation}
        onOpenChange={setShowConsultation}
        patientId={patient.id}
        anamnesis={hasCompletedAnamnesis ? anamnesis : null}
        onSuccess={refresh}
      />
      <PrescriptionModal open={showPrescription} onOpenChange={setShowPrescription} patientId={patient.id} patientName={patient.name} onSuccess={refresh} />
      <QuoteModal open={showQuote} onOpenChange={setShowQuote} patientId={patient.id} patientName={patient.name} onSuccess={refresh} />
      {patient && <EditPatientModal open={showEdit} onOpenChange={setShowEdit} patient={patient} />}
      <AnamnesisModal
        open={showAnamnesis}
        onOpenChange={(o) => { setShowAnamnesis(o); if (!o) setOpenConsultationAfterAnamnesis(false); }}
        patientId={patient.id}
        initialData={anamnesis}
        initialDate={patient.anamnesis_completed_at}
        onSaved={() => {
          if (openConsultationAfterAnamnesis) {
            setOpenConsultationAfterAnamnesis(false);
            setShowConsultation(true);
          }
        }}
      />


      {/* ── Excluir paciente — passo 1 ── */}
      <AlertDialog open={deleteStep === 1}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{patient.name}</strong> e todo o seu histórico (consultas, receitas, orçamentos). Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteStep(0)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDeleteStep(2)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, quero excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Excluir paciente — passo 2 ── */}
      <AlertDialog open={deleteStep === 2}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ TEM CERTEZA?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é sua última chance. Todos os dados de <strong>{patient.name}</strong> serão excluídos permanentemente e não poderão ser recuperados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteStep(0)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePatient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientDetail;
