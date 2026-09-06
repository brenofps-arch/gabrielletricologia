import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateQuotePDF } from "@/lib/generateQuotePDF";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  onSuccess: () => void;
}

const DEFAULT_PAYMENT = "Débito ou crédito até 6x";
const DEFAULT_PIX_KEY = "43.680.391.0001-45";

const emptyForm = {
  includedItems: "",
  packageName: "",
  priceFull: "",
  price3x: "",
  price6x: "",
  pixKey: DEFAULT_PIX_KEY,
  paymentMethods: DEFAULT_PAYMENT,
  validityDays: 30,
  notes: "",
};

const QuoteModal = ({ open, onOpenChange, patientId, patientName, onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const handleSubmit = async (generatePDF: boolean) => {
    if (!form.includedItems.trim()) {
      toast.error("Descreva o que está incluso no orçamento.");
      return;
    }
    if (!form.priceFull || isNaN(Number(form.priceFull))) {
      toast.error("Informe o valor à vista.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login."); setLoading(false); return; }

    const priceFull = parseFloat(form.priceFull);
    const price3x = form.price3x ? parseFloat(form.price3x) : null;
    const price6x = form.price6x ? parseFloat(form.price6x) : null;

    const { error } = await supabase.from("quotes").insert({
      patient_id: patientId,
      user_id: user.id,
      validity_days: form.validityDays,
      payment_methods: form.paymentMethods,
      included_items: form.includedItems,
      package_name: form.packageName || null,
      price_full: priceFull,
      price_3x: price3x,
      price_6x: price6x,
      pix_key: form.pixKey || null,
      image_use_clause: false,
      notes: form.notes || null,
      total_value: priceFull,
    });

    if (error) {
      toast.error("Erro ao salvar orçamento.");
    } else {
      toast.success("Orçamento salvo com sucesso!");
      if (generatePDF) {
        try {
          await generateQuotePDF({
            patientName,
            date: new Date().toLocaleDateString("pt-BR"),
            validityDays: form.validityDays,
            includedItems: form.includedItems,
            packageName: form.packageName,
            priceFull,
            price3x,
            price6x,
            pixKey: form.pixKey || null,
            paymentMethods: form.paymentMethods,
            notes: form.notes,
          });
        } catch (pdfError) {
          console.error("Erro ao gerar PDF do orçamento:", pdfError);
          toast.error("Orçamento salvo, mas houve um erro ao gerar o PDF.");
        }
      }
      setForm(emptyForm);
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Gerar Orçamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="font-body text-sm">O que está incluso *</Label>
            <Textarea
              value={form.includedItems}
              onChange={(e) => setForm({ ...form, includedItems: e.target.value })}
              placeholder={"Ex:\n6 reavaliações presenciais\n3 sessões de MMP (Intradermoterapia Capilar)\n3 sessões de PRP (Plasma Rico em Plaquetas)"}
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Um item por linha. As reavaliações listadas aqui fazem parte do mesmo pacote das sessões de procedimento — padronize como "X sessões de [Sigla] ([Nome completo do procedimento])".
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <Label className="font-body text-sm font-semibold">Investimento</Label>
            <div className="mt-2 space-y-2">
              <Input
                placeholder="Nome do pacote (ex: 3 sessões de MMP + 3 sessões de PRP)"
                value={form.packageName}
                onChange={(e) => setForm({ ...form, packageName: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">À vista (R$) *</Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={form.priceFull}
                    onChange={(e) => setForm({ ...form, priceFull: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Em 3x (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={form.price3x}
                    onChange={(e) => setForm({ ...form, price3x: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Em 6x (R$)</Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="0,00"
                    value={form.price6x}
                    onChange={(e) => setForm({ ...form, price6x: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <Label className="font-body text-sm font-semibold">Formas de Pagamento</Label>
            <div>
              <Label className="text-xs text-muted-foreground">Chave PIX (CNPJ)</Label>
              <Input
                placeholder="Ex: 43.680.391.0001-45"
                value={form.pixKey}
                onChange={(e) => setForm({ ...form, pixKey: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Outras formas</Label>
              <Textarea
                value={form.paymentMethods}
                onChange={(e) => setForm({ ...form, paymentMethods: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Label className="font-body text-sm">Validade (dias)</Label>
            <Input
              type="number"
              min="1"
              value={form.validityDays}
              onChange={(e) => setForm({ ...form, validityDays: parseInt(e.target.value) || 30 })}
              className="mt-1 w-32"
            />
          </div>

          <div>
            <Label className="font-body text-sm">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Orientações adicionais..."
              className="mt-1"
            />
          </div>
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
