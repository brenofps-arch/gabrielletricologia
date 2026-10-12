import { useEffect, useState } from "react";
import { User, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Configuracoes = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", specialty: "", email: "", phone: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("name, specialty, email, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          name: data.name || "",
          specialty: data.specialty || "",
          email: data.email || user.email || "",
          phone: data.phone || "",
        });
      } else {
        setForm((f) => ({ ...f, email: user.email || "" }));
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...form }, { onConflict: "id" });
    setSaving(false);
    if (error) toast.error("Erro ao salvar perfil.");
    else toast.success("Perfil atualizado!");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Configurações</h1>
        <p className="text-muted-foreground font-body mt-1">Gerencie seu perfil e preferências.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-heading font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Nome</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Especialidade</label>
            <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} disabled={loading} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={loading} type="email" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Telefone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={loading} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-heading font-semibold text-foreground">Notificações</h2>
        </div>
        <div className="space-y-3">
          {["Novas consultas agendadas", "Confirmações de pacientes", "Mensagens no WhatsApp", "Lembretes de retorno"].map((item) => (
            <label key={item} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer">
              <span className="text-sm text-foreground">{item}</span>
              <input type="checkbox" defaultChecked className="accent-primary w-4 h-4" />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
