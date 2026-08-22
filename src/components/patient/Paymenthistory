import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Wallet, Trash2 } from "lucide-react";
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

const PaymentHistory = ({ patientId }: Props) => {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    amount: "",
    payment_method: "",
    payment_date: new Date().toISOString().split("T")[0],
    description: "",
    notes: "",
  });

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

  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) { toast.error("Informe o valor."); return; }
    if (!form.payment_method) { toast.error("Informe a forma de pagamento."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      user_id: user!.id,
      patient_id: patientId,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      payment_date: form.payment_date,
      description: form.description || null,
      notes: form.notes || null,
    });
    if (error) toast.error("Erro ao registrar pagamento.");
    else {
      toast.success("Pagamento registrado!");
      queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
      setShowNew(false);
      setForm({ amount: "", payment_method: "", payment_date: new Date().toISOString().split("T")[0], description: "", notes: "" });
    }
    setSaving(false);
  };

  const handleDeleteStep1 = (id: string) => { setDeleteTarget(id); setDeleteStep(1); };
  const handleDeleteStep2 = () => setDeleteStep(2);
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("payments").delete().eq("id", deleteTarget);
    if (error) toast.error("Erro ao excluir pagamento.");
    else {
      toast.success("Pagamento excluído.");
      queryClient.invalidateQueries({ queryKey: ["payments", patientId] });
    }
    setDeleteTarget(null);
    setDeleteStep(1);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Resumo total */}
        <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
          <div>
            <p className="text-xs text-green-700 font-medium uppercase tracking-wider">Total recebido</p>
            <p className="text-2xl font-heading font-semibold text-green-800">
              {totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs text-green-600 mt-0.5">{payments.length} {payments.length === 1 ? "pagamento registrado" : "pagamentos registrados"}</p>
          </div>
          <Button onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Novo pagamento
          </Button>
        </div>

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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {p.payment_method}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {new Date(p.payment_date + "T12:00").toLocaleDateString("pt-BR")}
                    {p.description ? ` · ${p.description}` : ""}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDeleteStep1(p.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de novo pagamento */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Novo Pagamento Avulso</DialogTitle>
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
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input className="mt-1" type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
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

      {/* Excluir — passo 1 */}
      <AlertDialog open={!!deleteTarget && deleteStep === 1}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este registro de pagamento?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setDeleteStep(1); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStep2} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, quero excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir — passo 2 */}
      <AlertDialog open={!!deleteTarget && deleteStep === 2}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteStep(1); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirme novamente</AlertDialogTitle>
            <AlertDialogDescription>
              Segundo aviso: este pagamento será excluído permanentemente. Confirma?
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
    </>
  );
};

export default PaymentHistory;
