import { Settings, User, Bell, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Configuracoes = () => {
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
            <Input defaultValue="Dra. Maria Santos" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Especialidade</label>
            <Input defaultValue="Tricologia" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Email</label>
            <Input defaultValue="dra.maria@tricocare.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Telefone</label>
            <Input defaultValue="(11) 99999-0000" />
          </div>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Salvar Alterações</Button>
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
