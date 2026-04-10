import { MessageCircle, Webhook, Send, Settings2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const automations = [
  { trigger: "Oi / Olá / Bom dia", response: "Olá! 👋 Bem-vinda à Clínica TricoCare. Como posso ajudá-la? Responda:\n1️⃣ Agendar consulta\n2️⃣ Remarcar consulta\n3️⃣ Falar com a secretária", active: true },
  { trigger: "1 / Agendar", response: "Para agendar, preciso de algumas informações:\n📋 Qual sua queixa principal?\n(queda capilar, oleosidade, alopecia, etc.)", active: true },
  { trigger: "Confirmar consulta", response: "✅ Consulta confirmada! Enviaremos um lembrete 24h antes. Até lá!", active: true },
  { trigger: "Cancelar", response: "Entendido. Para cancelar sua consulta, por favor informe a data agendada. Lembre-se: cancelamentos devem ser feitos com 24h de antecedência.", active: false },
];

const webhookEndpoints = [
  { method: "POST", path: "/sync-google-calendar", description: "Sincronizar novos agendamentos do Google Calendar" },
  { method: "POST", path: "/send-whatsapp-confirm", description: "Disparar confirmação automática de consulta via WhatsApp" },
];

const Mensagens = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Mensageria</h1>
        <p className="text-muted-foreground font-body mt-1">Configure respostas automáticas e integrações WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Respostas Automáticas</h2>
            </div>

            <div className="space-y-3">
              {automations.map((auto, i) => (
                <div key={i} className={`p-4 rounded-lg border transition-colors ${auto.active ? "border-border bg-muted/30" : "border-border/50 bg-muted/10 opacity-60"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-medium text-foreground">Gatilho: "{auto.trigger}"</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${auto.active ? "bg-mint/30 text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {auto.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-line pl-5">{auto.response}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-5">
              <Webhook className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Webhooks</h2>
            </div>

            <div className="space-y-3">
              {webhookEndpoints.map((ep, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">{ep.method}</span>
                    <span className="text-xs font-mono text-foreground">{ep.path}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ep.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-heading font-semibold text-foreground">Integração</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL (Make/n8n)</label>
                <Input placeholder="https://hook.make.com/..." className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API WhatsApp Token</label>
                <Input placeholder="Token da Evolution API / Z-API" className="text-sm" type="password" />
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm" size="sm">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Salvar Configuração
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mensagens;
