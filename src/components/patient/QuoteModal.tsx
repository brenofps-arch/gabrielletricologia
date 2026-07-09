import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateQuotePDF } from "@/lib/generateQuotePDF";

interface QuoteItem {
  procedure_name: string;
  description: string;
  value: string;
  installments: string;
}

const SUGGESTIONS = [
  "Mesoterapia Capilar",
  "MMP",
  "Mesoject Gun",
  "Microlyzer",
  "PRP",
  "LEDterapia",
  "Programa de Acompanhamento 4 meses",
  "Programa de Acompanhamento 6 meses",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  onSuccess: () => void;
}

const DEFAULT_PAYMENT = "Dinheiro, Pix, débito ou crédito";

const QuoteModal = ({ open, onOpenChange, patientId, patientName, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState(30);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT);
  const [items, setItems] = useState<QuoteItem[]>([
    { procedure_name: "", description: "", value: "", installments: "" },
  ]);

  const addItem = () =>
    setItems([...items, { procedure_name: "", description: "", value: "", installments: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof QuoteItem, value: string) => {
    const updated = [...items];
    updated[i][field] = value;
    setItems(updated);
  };

  const total = items.reduce((sum, it) => sum + (parseFloat(it.value) || 0), 0);

  const handleSubmit = async (generatePDF: boolean) => {
    const validItems = items.filter((i) => i.procedure_name.trim());
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um procedimento.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login."); setLoading(false); return; }

    const { data: quote, error } = await supabase.from("quotes").insert({
      patient_id: patientId,
      user_id: user.id,
      validity_days: validityDays,
      payment_methods: paymentMethods,
      image_use_clause: false,
      notes,
      total_value: total,
    }).select().single();

    if (error || !quote) {
      toast.error("Erro ao salvar orçamento.");
      setLoading(false);
      return;
    }

    const { error: itemsError } = await supabase.from("quote_items").insert(
      validItems.map((item) => ({
        quote_id: quote.id,
        procedure_name: item.procedure_name,
        description: item.description || null,
        value: parseFloat(item.value) || 0,
      }))
    );

    if (itemsError) {
      toast.error("Erro ao salvar itens do orçamento.");
    } else {
      toast.success("Orçamento salvo com sucesso!");
      if (generatePDF) {
        generateQuotePDF({
          patientName,
          date: new Date().toLocaleDateString("pt-BR"),
          validityDays,
          paymentMethods,
          items: validItems.map((i) => ({
            procedure_name: i.procedure_name,
            description: i.description || null,
            value: parseFloat(i.value) || 0,
            installments: i.installments || null,
          })),
          notes,
        });
      }
      setItems([{ procedure_name: "", description: "", value: "", installments: "" }]);
      setNotes("");
      setValidityDays(30);
      setPaymentMethods(DEFAULT_PAYMENT);
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Gerar Orçamento</DialogTitle>
        </DialogHeader>

        <div className="mb-3">
          <p className="text-xs text-muted-foreground font-body mb-2">Sugestões rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const emptyIdx = items.findIndex((i) => !i.procedure_name.trim());
                  if (emptyIdx >= 0) updateItem(emptyIdx, "procedure_name", s);
                  else setItems([...items, { procedure_name: s, description: "", value: "", installments: "" }]);
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground hover:bg-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                {items.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(i)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="Procedimento"
                value={item.procedure_name}
                onChange={(e) => updateItem(i, "procedure_name", e.target.value)}
              />
              <Textarea
                placeholder="Descrição (opcional)"
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={item.value}
                    onChange={(e) => updateItem(i, "value", e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Parcelamento (ex: até 6x com juros)"
                    value={item.installments}
                    onChange={(e) => updateItem(i, "installments", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 mt-2">
          <Plus className="w-3.5 h-3.5" /> Adicionar Item
        </Button>

        <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">Total</span>
          <span className="text-lg font-heading font-semibold text-primary">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>

        <div className="mt-4">
          <Label className="font-body text-sm">Validade (dias)</Label>
          <Input
            type="number"
            min="1"
            value={validityDays}
            onChange={(e) => setValidityDays(parseInt(e.target.value) || 30)}
            className="mt-1 w-32"
          />
        </div>

        <div className="mt-3">
          <Label className="font-body text-sm">Formas de pagamento</Label>
          <Textarea
            value={paymentMethods}
            onChange={(e) => setPaymentMethods(e.target.value)}
            rows={2}
            className="mt-1"
          />
        </div>

        <div className="mt-3">
          <Label className="font-body text-sm">Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Orientações adicionais..."
            className="mt-1"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={loading}>Salvar</Button>
          <Button onClick={() => handleSubmit(true)} disabled={loading} className="gap-1.5">
            <FileDown className="w-4 h-4" /> Salvar e Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteModal;
