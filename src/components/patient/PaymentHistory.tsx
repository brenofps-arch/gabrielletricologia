import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Wallet, Trash2, CheckCircle2, CircleDashed, Paperclip, ExternalLink, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  patientId: string;
}

const paymentMethods = [
  "Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito",
  "Transferência bancária", "Outro",
];

const CREDIT_CARD_METHOD = "Cartão de crédito";
const RECEIPTS_BUCKET = "payment-receipts";
const MAX_RECEIPT_SIZE = 15 * 1024 * 1024;

const PaymentHistory = ({ patientId }: Props) => {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const emptyForm = {
    amount: "",
    payment_method: "",
    payment_date: new Date().toISOString().split("T")[0],
    description: "",
    notes: "",
    status: "paid",
    credit_installment_type: "avista",
    installments: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("patient_id", patientId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["payment_receipts", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_receipts")
        .select("*")
        .eq("patient_id", patientId)
        .order("receipt_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [uploading, setUploading] = useState(false);
  const [receiptDeleteTarget, setReceiptDeleteTarget] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptPayment, setReceiptPayment] = useState("none");
  const [receiptNotes, setReceiptNotes] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);
  const quickPaymentRef = useRef<any>(null);

  const uploadReceipt = async (file: File, opts: { paymentId: string | null; date: string | null; notes: string | null }) => {
    if (file.size > MAX_RECEIPT_SIZE) {
      toast.error("O arquivo é grande demais (máximo 15 MB).");
      return false;
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login primeiro.");
      setUploading(false);
      return false;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = `${user.id}/${patientId}/${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from(RECEIPTS_BUCKET).upload(filePath, file);
    if (uploadError) {
      toast.error(`Erro ao enviar o arquivo: ${uploadError.message}`);
      setUploading(false);
      return false;
    }
    const { error } = await supabase.from("payment_receipts").insert({
      user_id: user.id,
      patient_id: patientId,
      payment_id: opts.paymentId,
      file_path: filePath,
      file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
      receipt_date: opts.date,
      notes: opts.notes,
    });
    setUploading(false);
    if (error) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([filePath]);
      toast.error(`Erro ao registrar o comprovante: ${error.message}`);
      return false;
    }
    toast.success("Comprovante anexado.");
    queryClient.invalidateQueries({ queryKey: ["payment_receipts", patientId] });
    return true;
  };

  const openReceipt = async (filePath: string) => {
    const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const deleteReceipt = async () => {
    if (!receiptDeleteTarget) return;
    const rec = receipts.find((r: any) => r.id === receiptDeleteTarget);
    const { error } = await supabase.from("payment_receipts").delete().eq("id", receiptDeleteTarget);
    if (error) toast.error("Erro ao excluir o comprovante.");
    else {
      if (rec) await supabase.storage.from(RECEIPTS_BUCKET).remove([rec.file_path]);
      toast.success("Comprovante excluído.");
      queryClient.invalidateQueries({ queryKey: ["payment_receipts", patientId] });
    }
    setReceiptDeleteTarget(null);
  };

  const handleQuickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pay = quickPaymentRef.current;
    e.target.value = "";
    if (!file || !pay) return;
    await uploadReceipt(file, { paymentId: pay.id, date: pay.payment_date, notes: null });
  };

  const handleSaveReceipt = async () => {
    if (!receiptFile) { toast.error("Escolha o arquivo do comprovante."); return; }
    const ok = await uploadReceipt(receiptFile, {
      paymentId: receiptPayment === "none" ? null : receiptPayment,
      date: receiptDate || null,
      notes: receiptNotes.trim() || null,
    });
    if (ok) {
      setShowReceipt(false);
      setReceiptFile(null);
      setReceiptPayment("none");
      setReceiptNotes("");
    }
  };

  const receiptsByPayment = (paymentId: string) => receipts.filter((r: any) => r.payment_id === paymentId);
  const paymentLabel = (paymentId: string | null) => {
    if (!paymentId) return null;
    const pay = payments.find((x: any) => x.id === paymentId);
    if (!pay) return null;
    return `${Number(pay.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ${new Date(pay.payment_date + "T12:00").toLocaleDateString("pt-BR")}`;
  };

  const totalPaid = payments.reduce((sum: number, p: any) => sum + (p.status === "paid" ? Number(p.amount) : 0), 0);
  const totalPending = payments.reduce((sum: number, p: any) => sum + (p.status === "pending" ? Number(p.amount) : 0), 0);

  const isCreditCard = form.payment_method === CREDIT_CARD_METHOD;
  const isDividido = isCreditCard && form.credit_installment_type === "dividido";

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) { toast.error("Informe o valor."); return; }
    if (!form.payment_method) { toast.error("Informe a forma de pagamento."); return; }
    if (isDividido && (!form.installments || Number(form.installments) < 2)) {
      toast.error("Informe a quantidade de parcelas.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      user_id: user!.id,
      patient_id: patientId,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      payment_date: form.payment_date,
      status: form.status,
      description: form.description || null,
      notes: form.notes || null,
      installments: isDividido ? Number(form.installments) : null,
    });
    if (error) toast.error("Erro ao registrar pagamento.");
    else {
      toast.success("Pagamento registrado!");
      queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
      setShowNew(false);
      setForm(emptyForm);
    }
    setSaving(false);
  };

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Erro ao atualizar pagamento.");
    else {
      toast.success("Marcado como pago!");
      queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("payments").delete().eq("id", deleteTarget);
    if (error) toast.error("Erro ao excluir pagamento.");
    else {
      toast.success("Pagamento excluído.");
      queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
    }
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-xs text-green-700 font-medium uppercase tracking-wider">Recebido</p>
            <p className="text-2xl font-heading font-semibold text-green-800">
              {totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wider">Pendente</p>
            <p className="text-2xl font-heading font-semibold text-amber-800">
              {totalPending.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setShowReceipt(true)} className="gap-1.5">
            <Paperclip className="w-4 h-4" /> Anexar comprovante
          </Button>
          <Button onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo pagamento
          </Button>
        </div>
        <input ref={quickInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleQuickFile} />

        {/* Lista */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum pagamento registrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {p.payment_method}
                      {p.payment_method === CREDIT_CARD_METHOD && (p.installments > 1 ? ` · ${p.installments}x` : " · à vista")}
                    </span>
                    {p.status === "paid" ? (
                      <span className="text-[10px] flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Pago
                      </span>
                    ) : (
                      <span className="text-[10px] flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <CircleDashed className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {new Date(p.payment_date + "T12:00").toLocaleDateString("pt-BR")}
                    {p.description ? ` · ${p.description}` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {receiptsByPayment(p.id).map((r: any) => (
                    <Button key={r.id} variant="outline" size="sm" className="h-8 gap-1 text-xs text-primary"
                      onClick={() => openReceipt(r.file_path)} title={`Abrir comprovante: ${r.file_name}`}>
                      <Receipt className="w-3.5 h-3.5" /> Comprovante
                    </Button>
                  ))}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={uploading}
                    onClick={() => { quickPaymentRef.current = p; quickInputRef.current?.click(); }}
                    title="Anexar comprovante a este pagamento">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  {p.status === "pending" && (
                    <Button variant="ghost" size="sm" className="text-green-700 hover:text-green-800 hover:bg-green-50"
                      onClick={() => markPaid(p.id)} title="Marcar como pago">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => setDeleteTarget(p.id)} title="Excluir pagamento">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comprovantes anexados */}
        <div className="pt-2">
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-primary" /> Comprovantes ({receipts.length})
          </h3>
          {receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum comprovante anexado ainda.</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-2.5 bg-card">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.receipt_date ? new Date(r.receipt_date + "T12:00").toLocaleDateString("pt-BR") : "Sem data"}
                      {paymentLabel(r.payment_id) ? ` · pagamento ${paymentLabel(r.payment_id)}` : ""}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openReceipt(r.file_path)}>
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                      onClick={() => setReceiptDeleteTarget(r.id)} title="Excluir comprovante">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de comprovante */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Anexar comprovante</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Arquivo (imagem ou PDF) *</Label>
              <Input className="mt-1" type="file" accept="image/*,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>Data do comprovante</Label>
              <Input className="mt-1" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div>
              <Label>Vincular a um pagamento</Label>
              <Select value={receiptPayment} onValueChange={setReceiptPayment}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {payments.map((pay: any) => (
                    <SelectItem key={pay.id} value={pay.id}>
                      {Number(pay.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {new Date(pay.payment_date + "T12:00").toLocaleDateString("pt-BR")} · {pay.payment_method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Input className="mt-1" placeholder="Ex.: Pix de entrada" value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Cancelar</Button>
            <Button onClick={handleSaveReceipt} disabled={uploading} className="gap-1.5">
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploading ? "Enviando..." : "Anexar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir comprovante */}
      <AlertDialog open={!!receiptDeleteTarget} onOpenChange={(o) => { if (!o) setReceiptDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comprovante?</AlertDialogTitle>
            <AlertDialogDescription>O arquivo será apagado definitivamente do histórico do paciente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setReceiptDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteReceipt} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de novo pagamento */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <Label>Valor (R$) *</Label>
              <Input className="mt-1" type="number" min="0" step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Ex: 250,00" />
            </div>
            <div>
              <Label>Forma de pagamento *</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v, credit_installment_type: "avista", installments: "" })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isCreditCard && (
              <div>
                <Label>Crédito à vista ou dividido? *</Label>
                <Select value={form.credit_installment_type} onValueChange={(v) => setForm({ ...form, credit_installment_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="dividido">Dividido</SelectItem>
                  </SelectContent>
                </Select>
                {isDividido && (
                  <Input className="mt-2" type="number" min="2" step="1" placeholder="Quantidade de parcelas"
                    value={form.installments}
                    onChange={(e) => setForm({ ...form, installments: e.target.value })} />
                )}
              </div>
            )}
            <div>
              <Label>Data do pagamento / vencimento *</Label>
              <Input className="mt-1" type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input className="mt-1" placeholder="Ex: Sessão de laserterapia"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" rows={2} placeholder="Informações adicionais..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir pagamento */}
      <AlertDialog open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro de pagamento?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PaymentHistory;
