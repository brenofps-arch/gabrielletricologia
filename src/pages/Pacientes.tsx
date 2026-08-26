import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, ChevronRight, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatPhone, formatCPF } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Pacientes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "", condition: "", birth_date: "", referral_source: "", cpf: "" });
  const [saving, setSaving] = useState(false);

  // Exclusão — dupla confirmação
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login primeiro."); setSaving(false); return; }

    const { error } = await supabase.from("patients").insert({
      user_id: user.id,
      name: newForm.name.trim(),
      phone: newForm.phone || null,
      email: newForm.email || null,
      condition: newForm.condition || null,
      birth_date: newForm.birth_date || null,
      referral_source: newForm.referral_source || null,
      cpf: newForm.cpf || null,
    });

    if (error) toast.error("Erro ao cadastrar paciente.");
    else {
      toast.success("Paciente cadastrado!");
      setNewForm({ name: "", phone: "", email: "", condition: "", birth_date: "", referral_source: "", cpf: "" });
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    }
    setSaving(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // não navegar para o detalhe
    setDeleteTarget({ id, name });
    setDeleteStep(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("patients").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Erro ao excluir paciente.");
    else {
      toast.success("Paciente excluído.");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    }
    setDeleteTarget(null);
    setDeleteStep(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground font-body mt-1">{patients.length} pacientes cadastrados.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4" />
          Novo Paciente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_150px_180px_80px_40px_36px] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">
          <span>Paciente</span>
          <span>Telefone</span>
          <span>Diagnóstico</span>
          <span>Sessões</span>
          <span />
          <span />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhum paciente encontrado.</div>
        ) : (
          filtered.map((patient) => (
            <div
              key={patient.id}
              onClick={() => navigate(`/pacientes/${patient.id}`)}
              className="grid grid-cols-[1fr_150px_180px_80px_40px_36px] gap-4 px-5 py-4 border-b border-border/50 items-center hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{patient.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">{patient.phone ? formatPhone(patient.phone) : "—"}</span>
              {patient.condition ? (
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint-light text-secondary-foreground w-fit">
                  {patient.condition}
                </span>
              ) : <span className="text-sm text-muted-foreground">—</span>}
              <span className="text-sm text-foreground font-medium">{patient.sessions_count}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={(e) => handleDeleteClick(e, patient.id, patient.name)}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Excluir paciente"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* New Patient Modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome completo *</Label>
              <Input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: formatPhone(e.target.value) })} placeholder="(11) 99999 0000" className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} type="email" className="mt-1" />
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input value={newForm.birth_date} onChange={(e) => setNewForm({ ...newForm, birth_date: e.target.value })} type="date" className="mt-1" />
            </div>
            <div>
              <Label>CPF</Label>
              <Input className="mt-1" placeholder="000.000.000-00"
                value={newForm.cpf}
                onChange={(e) => setNewForm({ ...newForm, cpf: formatCPF(e.target.value) })} />
            </div>
            <div>
              <Label>Queixa inicial</Label>
              <Input value={newForm.condition} onChange={(e) => setNewForm({ ...newForm, condition: e.target.value })} placeholder="Ex: Queda capilar há 6 meses" className="mt-1" />
            </div>
            <div>
              <Label>Como nos conheceu?</Label>
              <Select value={newForm.referral_source} onValueChange={(v) => setNewForm({ ...newForm, referral_source: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a origem..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicacao">👥 Indicação de paciente</SelectItem>
                  <SelectItem value="google">🔍 Google / Busca online</SelectItem>
                  <SelectItem value="anuncio">📢 Anúncio (Instagram / Facebook)</SelectItem>
                  <SelectItem value="instagram_organico">📸 Instagram (perfil orgânico)</SelectItem>
                  <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                  <SelectItem value="indicacao_medico">🩺 Indicação de médico</SelectItem>
                  <SelectItem value="retorno">🔄 Retorno de paciente antigo</SelectItem>
                  <SelectItem value="outro">➕ Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir — passo 1 */}
      <AlertDialog open={!!deleteTarget && deleteStep === 1}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{deleteTarget?.name}</strong> e todo o histórico vinculado. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDeleteStep(2)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, quero excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir — passo 2 */}
      <AlertDialog open={!!deleteTarget && deleteStep === 2}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Última confirmação</AlertDialogTitle>
            <AlertDialogDescription>
              Segunda confirmação obrigatória. Excluir <strong>{deleteTarget?.name}</strong> é permanente e irrecuperável. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Pacientes;
