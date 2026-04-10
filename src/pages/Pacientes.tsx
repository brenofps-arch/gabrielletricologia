import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Pacientes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "", condition: "" });
  const [saving, setSaving] = useState(false);

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
    });

    if (error) toast.error("Erro ao cadastrar paciente.");
    else {
      toast.success("Paciente cadastrado!");
      setNewForm({ name: "", phone: "", email: "", condition: "" });
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    }
    setSaving(false);
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
        <div className="grid grid-cols-[1fr_150px_180px_80px_40px] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">
          <span>Paciente</span>
          <span>Telefone</span>
          <span>Condição</span>
          <span>Sessões</span>
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
              className="grid grid-cols-[1fr_150px_180px_80px_40px] gap-4 px-5 py-4 border-b border-border/50 items-center hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{patient.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">{patient.phone || "—"}</span>
              {patient.condition ? (
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint-light text-secondary-foreground w-fit">
                  {patient.condition}
                </span>
              ) : <span className="text-sm text-muted-foreground">—</span>}
              <span className="text-sm text-foreground font-medium">{patient.sessions_count}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
              <Input value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} placeholder="(11) 99999-0000" className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} type="email" className="mt-1" />
            </div>
            <div>
              <Label>Condição</Label>
              <Input value={newForm.condition} onChange={(e) => setNewForm({ ...newForm, condition: e.target.value })} placeholder="Ex: Queda Capilar" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pacientes;
