import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, FlaskConical, Trash2, FileText, Image as ImageIcon, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  patientId: string;
}

const LAB_EXAMS_BUCKET = "lab-exams";

const LabExamHistory = ({ patientId }: Props) => {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    exam_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["lab_exams", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_exams")
        .select("*")
        .eq("patient_id", patientId)
        .order("exam_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setFile(null);
    setForm({ exam_date: new Date().toISOString().split("T")[0], notes: "" });
  };

  const handleSave = async () => {
    if (!file) { toast.error("Selecione um arquivo."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logada para enviar exames.");
      setSaving(false);
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${user.id}/${patientId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage.from(LAB_EXAMS_BUCKET).upload(filePath, file);
    if (uploadError) {
      toast.error("Erro ao enviar o arquivo.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("lab_exams").insert({
      user_id: user.id,
      patient_id: patientId,
      file_path: filePath,
      file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
      exam_date: form.exam_date || null,
      notes: form.notes || null,
    });

    if (error) {
      toast.error("Erro ao registrar o exame.");
      await supabase.storage.from(LAB_EXAMS_BUCKET).remove([filePath]);
    } else {
      toast.success("Exame enviado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["lab_exams", patientId] });
      setShowNew(false);
      resetForm();
    }
    setSaving(false);
  };

  const handleOpen = async (examId: string, filePath: string) => {
    setOpeningId(examId);
    const { data, error } = await supabase.storage.from(LAB_EXAMS_BUCKET).createSignedUrl(filePath, 300);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao abrir o exame.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const exam = exams.find((e) => e.id === deleteTarget);
    const { error } = await supabase.from("lab_exams").delete().eq("id", deleteTarget);
    if (error) {
      toast.error("Erro ao excluir exame.");
    } else {
      if (exam) await supabase.storage.from(LAB_EXAMS_BUCKET).remove([exam.file_path]);
      toast.success("Exame excluído.");
      queryClient.invalidateQueries({ queryKey: ["lab_exams", patientId] });
    }
    setDeleteTarget(null);
  };

  const fileIcon = (type: string | null) => {
    if (type?.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-primary" />;
    return <FileText className="w-4 h-4 text-primary" />;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar Exame
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando...</div>
        ) : exams.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum exame enviado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exams.map((e) => (
              <div key={e.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">{fileIcon(e.file_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{e.file_name}</span>
                      {e.exam_date && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {new Date(e.exam_date + "T12:00").toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {formatSize(e.file_size)}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => handleOpen(e.id, e.file_path)}
                    disabled={openingId === e.id}
                  >
                    {openingId === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setDeleteTarget(e.id)}
                    title="Excluir exame"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de novo exame */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Adicionar Exame Laboratorial</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Arquivo *</Label>
              <Input
                className="mt-1"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Data do exame</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Ex: Hemograma completo, ferritina baixa..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir exame */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exame?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este arquivo de exame? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default LabExamHistory;
