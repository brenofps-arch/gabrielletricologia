import { useState } from "react";
import { ClipboardList, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const complaints = [
  { id: "queda", label: "Queda Capilar", suggestedTime: 60 },
  { id: "oleosidade", label: "Oleosidade Excessiva", suggestedTime: 30 },
  { id: "alopecia", label: "Alopecia", suggestedTime: 90 },
  { id: "dermatite", label: "Dermatite Seborreica", suggestedTime: 45 },
  { id: "calvicie", label: "Calvície Feminina", suggestedTime: 60 },
  { id: "pos_parto", label: "Queda Pós-Parto", suggestedTime: 45 },
  { id: "outro", label: "Outro", suggestedTime: 45 },
];

const Triagem = () => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const maxTime = selected.length > 0
    ? Math.max(...selected.map((id) => complaints.find((c) => c.id === id)?.suggestedTime || 45))
    : 0;

  const handleSubmit = () => {
    if (name && phone && selected.length > 0) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-mint/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-secondary-foreground" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-foreground">Triagem Enviada!</h2>
          <p className="text-muted-foreground max-w-md">
            A pré-consulta de <strong>{name}</strong> foi registrada. Tempo sugerido: <strong>{maxTime} minutos</strong>.
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-4">
            Nova Triagem
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">Triagem Inteligente</h1>
        <p className="text-muted-foreground font-body mt-1">Formulário de pré-consulta com sugestão automática de tempo.</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Nome do Paciente</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Telefone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">Queixas Principais</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {complaints.map((c) => {
              const isSelected = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setSelected((prev) =>
                      isSelected ? prev.filter((s) => s !== c.id) : [...prev, c.id]
                    )
                  }
                  className={`p-3 rounded-lg text-sm font-medium text-left transition-all border ${
                    isSelected
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Observações</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-rose-gold-light/50 border border-primary/20">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Tempo Sugerido: {maxTime} minutos</p>
              <p className="text-xs text-muted-foreground">Baseado nas queixas selecionadas</p>
            </div>
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!name || !phone || selected.length === 0}>
          <ClipboardList className="w-4 h-4 mr-2" />
          Enviar Triagem
        </Button>
      </div>
    </div>
  );
};

export default Triagem;
