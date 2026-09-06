import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  FileDown, FileText, Trash2, CheckCircle2, Clock, XCircle,
  CreditCard, BadgePercent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { generateQuotePDF } from "@/lib/generateQuotePDF";

interface Props {
  patientId: string;
  patientName: string;
}

const statusLabel: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pendente",    color: "bg-yellow-100 text-yellow-800",  icon: <Clock className="w-3.5 h-3.5" /> },
  paid:      { label: "Pago",        color: "bg-green-100 text-green-800",    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  partial:   { label: "Pago parcial",color: "bg-blue-100 text-blue-800",      icon: <BadgePercent className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelado",   color: "bg-red-100 text-red-800",        icon: <XCircle className="w-3.5 h-3.5" /> },
};

const paymentMethods = [
  "Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito",
  "Transferência bancária", "Outro",
];

const QuoteHistory = ({ patientId, patientName }: Props) => {
  const queryClient = useQueryClient();

  // Exclusão — dois estágios
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);

  // Modal de pagamento
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payForm, setPayForm] = useState({
    payment_status: "paid",
    payment_method: "",
    payment_date: new Date().toISOString().split("T")[0],
    paid_amount: "",
    payment_notes: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(*)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Exclusão ──────────────────────────────────────────────
  const handleDeleteClick = (id: string) => {
    setDeleteTarget(id);
    setDeleteStep(1);
  };

  const handleDeleteStep1 = () => setDeleteStep(2);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("quotes").delete().eq("id", deleteTarget);
    if (error) toast.error("Erro ao excluir orçamento.");
    else {
      toast.success("Orçamento excluído.");
      queryClient.invalidateQueries({ queryKey: ["quotes", patientId] });
    }
    setDeleteTarget(null);
    setDeleteStep(1);
  };

  // ── Pagamento ─────────────────────────────────────────────
  const openPayModal = (q: any) => {
    setPayTarget(q);
    setPayForm({
      payment_status: q.payment_status || "paid",
      payment_method: q.payment_method || "",
      payment_date: q.payment_date || new Date().toISOString().split("T")[0],
      paid_amount: q.paid_amount != null ? String(q.paid_amount) : String(q.total_value),
      payment_notes: q.payment_notes || "",
    });
  };

  const savePay = async () => {
    if (!payForm.payment_method) { toast.error("Informe a forma de pagamento."); return; }
    if (!payForm.paid_amount || isNaN(Number(payForm.paid_amount))) {
      toast.error("Informe o valor pago."); return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Atualizar status no orçamento
    const { error: qErr } = await supabase.from("quotes").update({
      payment_status: payForm.payment_status,
      payment_method: payForm.payment_method,
      payment_date: payForm.payment_date,
      paid_amount: Number(payForm.paid_amount),
      payment_notes: payForm.payment_notes,
    }).eq("id", payTarget.id);

    if (qErr) { toast.error("Erro ao salvar pagamento."); setSaving(false); return; }

    // 2. Registrar no histórico geral de pagamentos
    const isPaidStatus = payForm.payment_status === "paid" || payForm.payment_status === "partial";
    const { error: pErr } = await supabase.from("payments").insert({
      user_id: user!.id,
      patient_id: patientId,
      quote_id: payTarget.id,
      amount: Number(payForm.paid_amount),
      payment_method: payForm.payment_method,
      payment_date: payForm.payment_date,
      status: isPaidStatus ? "paid" : "pending",
      paid_at: isPaidStatus ? new Date().toISOString() : null,
      description: `Pagamento de Orçamento / Protocolo (${new Date(payTarget.created_at).toLocaleDateString("pt-BR")})`,
      notes: payForm.payment_notes || null,
    });

    if (pErr) toast.error("Pagamento salvo no orçamento, mas falhou ao registrar no histórico.");
    else toast.success("Pagamento registrado com sucesso!");

    queryClient.invalidateQueries({ queryKey: ["quotes", patientId] });
    queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
    queryClient.invalidateQueries({ queryKey: ["payments-all"] });
    queryClient.invalidateQueries({ queryKey: ["quotes-all"] });
    setPayTarget(null);
    setSaving(false);
  };

  // ── Render ────────────────────────────────────────────────
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  if (quotes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum orçamento gerado ainda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {quotes.map((q: any) => {
          const st = statusLabel[q.payment_status || "pending"];
          return (
            <div key={q.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(q.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Validade: {q.validity_days} dias
                    {q.package_name ? ` · ${q.package_name}` : ""}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-lg font-heading font-semibold text-primary">
                    {Number(q.total_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${st.color}`}>
                    {st.icon} {st.label}
                  </span>
                </div>
              </div>

              {q.included_items ? (
                <ul className="text-sm text-muted-foreground space-y-1 mb-3 list-disc list-inside">
                  {q.included_items.split("\n").filter(Boolean).map((line: string, i: number) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                  {q.quote_items?.map((it: any) => (
                    <li key={it.id} className="flex justify-between">
                      <span>{it.procedure_name}</span>
                      <span>{Number(it.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </li>
                  ))}
                </ul>
              )}

              {q.payment_method && (
                <p className="text-xs text-muted-foreground mb-3">
                  Pago em {q.payment_date ? new Date(q.payment_date + "T12:00").toLocaleDateString("pt-BR") : "—"} via {q.payment_method}
                  {q.payment_notes ? ` · ${q.payment_notes}` : ""}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => generateQuotePDF({
                    patientName,
                    date: new Date(q.created_at).toLocaleDateString("pt-BR"),
                    validityDays: q.validity_days,
                    includedItems: q.included_items || (q.quote_items ?? []).map((it: any) => it.procedure_name).join("\n"),
                    packageName: q.package_name || "",
                    priceFull: q.price_full != null ? Number(q.price_full) : Number(q.total_value),
                    price3x: q.price_3x != null ? Number(q.price_3x) : null,
                    price6x: q.price_6x != null ? Number(q.price_6x) : null,
                    pixKey: q.pix_key || null,
                    paymentMethods: q.payment_methods || "",
                    notes: q.notes,
                  })}>
                  <FileDown className="w-3.5 h-3.5" /> Baixar PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => openPayModal(q)}>
                  <CreditCard className="w-3.5 h-3.5" />
                  {q.payment_status === "paid" ? "Ver pagamento" : "Registrar pagamento"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 ml-auto"
                  onClick={() => handleDeleteClick(q.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Confirmação de exclusão — passo 1 ── */}
      <AlertDialog open={!!deleteTarget && deleteStep === 1}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStep1} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, quero excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmação de exclusão — passo 2 ── */}
      <AlertDialog open={!!deleteTarget && deleteStep === 2}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirme novamente</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir este orçamento permanentemente. Esta é sua segunda e última confirmação. Não há como desfazer.
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

      {/* ── Modal de pagamento ── */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Status do pagamento</Label>
              <Select value={payForm.payment_status}
                onValueChange={(v) => setPayForm({ ...payForm, payment_status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago (total)</SelectItem>
                  <SelectItem value="partial">Pago parcialmente</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor pago (R$) *</Label>
              <Input className="mt-1" type="number" min="0" step="0.01"
                value={payForm.paid_amount}
                onChange={(e) => setPayForm({ ...payForm, paid_amount: e.target.value })}
                placeholder="Ex: 350,00" />
            </div>
            <div>
              <Label>Forma de pagamento *</Label>
              <Select value={payForm.payment_method}
                onValueChange={(v) => setPayForm({ ...payForm, payment_method: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input className="mt-1" type="date"
                value={payForm.payment_date}
                onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" rows={2} placeholder="Ex: parcelado em 2x, recibo entregue..."
                value={payForm.payment_notes}
                onChange={(e) => setPayForm({ ...payForm, payment_notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button onClick={savePay} disabled={saving}>
              {saving ? "Salvando..." : "Salvar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuoteHistory;
