import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatPhone, formatCPF } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface EditPatientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    condition: string | null;
    diagnosis: string | null;
    birth_date: string | null;
    referral_source: string | null;
    cpf: string | null;
  };
}

const EditPatientModal = ({ open, onOpenChange, patient }: EditPatientModalProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", condition: "", diagnosis: "", birth_date: "", referral_source: "", cpf: "",
  });

  useEffect(() => {
    if (open && patient) {
      setForm({
        name: patient.name || "",
        phone: patient.phone || "",
        email: patient.email || "",
        condition: patient.condition || "",
        diagnosis: patient.diagnosis || "",
        birth_date: patient.birth_date || "",
        referral_source: patient.referral_source || "",
        cpf: patient.cpf || "",
      });
    }
  }, [open, patient]);


  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("patients")
      .update({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        condition: form.condition || null,
        diagnosis: form.diagnosis || null,
        birth_date: form.birth_date || null,
        referral_source: form.referral_source || null,
        cpf: form.cpf || null,
      })
      .eq("id", patient.id);


    if (error) {
      toast.error("Erro ao atualizar paciente.");
    } else {
      toast.success("Paciente atualizado!");
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Editar Paciente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome completo *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} placeholder="(27) 99999 0000" className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="mt-1" />
          </div>
          <div>
            <Label>Data de Nascimento</Label>
            <Input value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} type="date" className="mt-1" />
          </div>
          <div>
            <Label>CPF</Label>
            <Input className="mt-1" placeholder="000.000.000-00"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} />
          </div>
          <div>
            <Label>Queixa inicial</Label>
            <Input value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder="Ex: Queda capilar há 6 meses" className="mt-1" />
          </div>
          <div>
            <Label>Diagnóstico</Label>
            <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Preenchido após a consulta" className="mt-1" />
          </div>

          <div>
            <Label>Como nos conheceu?</Label>
            <Select value={form.referral_source} onValueChange={(v) => setForm({ ...form, referral_source: v })}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPatientModal;
