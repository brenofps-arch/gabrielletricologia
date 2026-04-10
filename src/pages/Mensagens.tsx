import { useState, useEffect } from "react";
import { MessageCircle, Webhook, Send, Settings2, CheckCircle2, Phone, Clock, User, Bot, ArrowRight, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversation = {
  id: string;
  phone_number: string;
  contact_name: string | null;
  last_message: string | null;
  conversation_state: string;
  is_active: boolean;
  updated_at: string;
};

type Message = {
  id: string;
  direction: string;
  message_text: string | null;
  message_type: string;
  status: string | null;
  created_at: string;
};

const stateLabels: Record<string, string> = {
  greeting: "Saudação",
  collecting_info: "Coletando Info",
  scheduling: "Agendando",
  confirmed: "Confirmado",
  general: "Geral",
};

const Mensagens = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [manualMessage, setManualMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  // Webhook URL for display
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  useEffect(() => {
    fetchConversations();

    // Realtime subscription for new conversations
    const channel = supabase
      .channel("whatsapp-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        fetchConversations();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        if (selectedConversation && (payload.new as any).conversation_id === selectedConversation.id) {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id]);

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
    } else {
      setConversations(data || []);
    }
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      setMessages(data || []);
    }
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    fetchMessages(conv.id);
  };

  const sendManualMessage = async () => {
    if (!manualMessage.trim() || !selectedConversation) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          phone: selectedConversation.phone_number,
          message: manualMessage,
          conversation_id: selectedConversation.id,
        },
      });

      if (error) throw error;

      toast({ title: "Mensagem enviada!", description: "A mensagem foi enviada via WhatsApp." });
      setManualMessage("");
      fetchMessages(selectedConversation.id);
    } catch (err) {
      console.error("Send error:", err);
      toast({ title: "Erro ao enviar", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: "URL copiada!", description: "Cole no painel da Meta (WhatsApp Business API)." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Mensageria</h1>
        <p className="text-muted-foreground font-body mt-1">Conversas WhatsApp com secretária IA e integrações.</p>
      </div>

      <Tabs defaultValue="conversas" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="conversas" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="configuracao" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversas" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[500px]">
            {/* Conversation list */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-heading font-semibold text-foreground">Conversas</h2>
                <Button variant="ghost" size="icon" onClick={fetchConversations} className="h-8 w-8">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="divide-y divide-border/50 max-h-[450px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bot className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
                    <p className="text-xs text-muted-foreground mt-1">As conversas aparecerão aqui quando pacientes enviarem mensagens no WhatsApp.</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                        selectedConversation?.id === conv.id ? "bg-primary/5 border-l-2 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground truncate">
                          {conv.contact_name || conv.phone_number}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {stateLabels[conv.conversation_state] || conv.conversation_state}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(new Date(conv.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {selectedConversation.contact_name || selectedConversation.phone_number}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {selectedConversation.phone_number}
                      </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-0 text-xs">
                      {stateLabels[selectedConversation.conversation_state]}
                    </Badge>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[350px]">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-xl px-3.5 py-2.5 ${
                            msg.direction === "outbound"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-line">{msg.message_text}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`text-[10px] ${msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                            {msg.direction === "outbound" && (
                              <Bot className="w-3 h-3 text-primary-foreground/40" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-12">
                        Nenhuma mensagem nesta conversa.
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-border flex gap-2">
                    <Textarea
                      placeholder="Enviar mensagem manual..."
                      className="min-h-[40px] max-h-[80px] resize-none text-sm"
                      value={manualMessage}
                      onChange={(e) => setManualMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendManualMessage();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={sendManualMessage}
                      disabled={sending || !manualMessage.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div>
                    <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Selecione uma conversa para visualizar</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ou configure o WhatsApp na aba Configuração para começar.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="configuracao" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Setup Guide */}
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-heading font-semibold text-foreground">Configuração do Webhook</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">1. URL do Webhook</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Cole esta URL no painel da Meta (WhatsApp Business API) como Callback URL:
                  </p>
                  <div className="flex gap-2">
                    <Input value={webhookUrl} readOnly className="text-xs font-mono" />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl} className="shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">2. Verify Token</p>
                  <p className="text-xs text-muted-foreground">
                    Configure o token de verificação nos secrets do projeto com o nome <code className="bg-muted px-1 py-0.5 rounded text-xs">WHATSAPP_VERIFY_TOKEN</code>.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">3. Secrets Necessários</p>
                  <div className="space-y-1.5">
                    {[
                      { name: "WHATSAPP_ACCESS_TOKEN", desc: "Token de acesso da Meta API" },
                      { name: "WHATSAPP_PHONE_NUMBER_ID", desc: "ID do número do WhatsApp Business" },
                      { name: "WHATSAPP_VERIFY_TOKEN", desc: "Token para verificação do webhook" },
                      { name: "WHATSAPP_OWNER_USER_ID", desc: "Seu ID de usuário (auth.uid)" },
                    ].map((secret) => (
                      <div key={secret.name} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40">
                        <code className="text-xs font-mono text-primary shrink-0">{secret.name}</code>
                        <span className="text-xs text-muted-foreground">{secret.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="space-y-5">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Bot className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-heading font-semibold text-foreground">Como Funciona</h2>
                </div>

                <div className="space-y-3">
                  {[
                    { step: "1", title: "Paciente envia mensagem", desc: "Via WhatsApp para o número da clínica" },
                    { step: "2", title: "IA processa a mensagem", desc: "A secretária virtual entende a intenção e coleta dados" },
                    { step: "3", title: "Agendamento automático", desc: "A IA verifica horários disponíveis e agenda a consulta" },
                    { step: "4", title: "Confirmação enviada", desc: "Paciente recebe confirmação com data e horário" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-heading font-semibold text-foreground">Links Úteis</h2>
                </div>
                <div className="space-y-2">
                  <a href="https://business.facebook.com" target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ArrowRight className="w-3.5 h-3.5" />
                    Meta Business Suite
                  </a>
                  <a href="https://developers.facebook.com" target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ArrowRight className="w-3.5 h-3.5" />
                    Meta for Developers
                  </a>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Mensagens;
