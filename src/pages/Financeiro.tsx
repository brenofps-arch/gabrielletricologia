import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Wallet,
  DollarSign,
  CreditCard,
  TrendingUp,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  Pencil,
  FileText,
  Layers,
  ArrowUpRight,
  User,
  Users,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAYMENT_METHODS = [
  "Pix",
  "Cartão de crédito",
  "Cartão de débito",
  "Dinheiro",
  "Transferência bancária",
  "Boleto",
  "Outro",
];

const QUICK_DESCRIPTIONS = [
  "Consulta Tricológica (1ª Vez)",
  "Consulta de Retorno",
  "Protocolo MMP Capilar",
  "Protocolo Mesoterapia Capilar",
  "Sessão de LEDterapia",
  "Protocolo Capilar Completo",
  "Procedimento em Consultório",
];

const Financeiro = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all"); // 'all', 'this_month', 'last_month'
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state para Novo Pagamento / Parcelamento
  const [form, setForm] = useState({
    patient_id: "",
    amount: "",
    payment_method: "Pix",
    payment_date: new Date().toISOString().split("T")[0],
    description: "",
    notes: "",
    status: "paid",
    is_installment: false,
    installment_count: "3",
    first_installment_paid: true,
  });

  // Busca lista de pagamentos com dados do paciente
  const { data: payments = [], isLoading: loadingPayments, refetch: refetchPayments } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          patients (
            id,
            name,
            phone
          )
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Busca lista de pacientes para o seletor
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, phone")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Busca orçamentos para sincronização de valores pagos
  const { data: quotes = [], refetch: refetchQuotes } = useQuery({
    queryKey: ["quotes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          patients (
            id,
            name,
            phone
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Consolidação automática: une pagamentos de `payments` e pagamentos registrados em `quotes`
  const allTransactions = useMemo(() => {
    const list: any[] = [...payments];
    const registeredQuoteIds = new Set(
      payments.filter((p: any) => p.quote_id).map((p: any) => p.quote_id)
    );

    quotes.forEach((q: any) => {
      const hasPayment = registeredQuoteIds.has(q.id);
      const paidVal = Number(q.paid_amount) || 0;
      const totalVal = Number(q.total_value) || 0;

      // Se o orçamento possui valor pago ou status de pago, mas não está registrado na tabela de pagamentos:
      if (!hasPayment) {
        if (paidVal > 0 || q.payment_status === "paid" || q.payment_status === "partial") {
          const amount = paidVal > 0 ? paidVal : totalVal;
          list.push({
            id: `quote-${q.id}`,
            patient_id: q.patient_id,
            quote_id: q.id,
            amount: amount,
            payment_method: q.payment_method || q.payment_methods || "Orçamento / Protocolo",
            payment_date: q.payment_date || q.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
            description: `Orçamento / Protocolo (${new Date(q.created_at).toLocaleDateString("pt-BR")})`,
            notes: q.payment_notes || q.notes,
            status: q.payment_status === "pending" ? "pending" : "paid",
            paid_at: q.payment_status === "pending" ? null : q.created_at,
            patients: q.patients,
            source: "quote",
          });
        } else if (q.payment_status === "pending" && totalVal > 0) {
          list.push({
            id: `quote-${q.id}`,
            patient_id: q.patient_id,
            quote_id: q.id,
            amount: totalVal,
            payment_method: q.payment_method || q.payment_methods || "Orçamento",
            payment_date: q.payment_date || q.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
            description: `Orçamento / Protocolo (${new Date(q.created_at).toLocaleDateString("pt-BR")})`,
            notes: q.notes,
            status: "pending",
            paid_at: null,
            patients: q.patients,
            source: "quote",
          });
        }
      }
    });

    return list.sort((a, b) => (b.payment_date || "").localeCompare(a.payment_date || ""));
  }, [payments, quotes]);

  // Filtro das transações consolidadas
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const currentMonthStr = format(now, "yyyy-MM");
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = format(prevMonth, "yyyy-MM");

    return allTransactions.filter((p: any) => {
      // Filtro de texto
      const patientName = p.patients?.name?.toLowerCase() || "";
      const desc = p.description?.toLowerCase() || "";
      const notes = p.notes?.toLowerCase() || "";
      const matchesSearch =
        !searchTerm.trim() ||
        patientName.includes(searchTerm.toLowerCase()) ||
        desc.includes(searchTerm.toLowerCase()) ||
        notes.includes(searchTerm.toLowerCase());

      // Filtro de status
      const isPaid =
        p.status === "paid" ||
        p.status === "partial" ||
        p.status === "pago" ||
        p.status === "pago parcial" ||
        (Boolean(p.paid_at) && p.status !== "pending" && p.status !== "cancelled");

      let matchesStatus = true;
      if (statusFilter === "paid") matchesStatus = isPaid;
      else if (statusFilter === "pending") matchesStatus = !isPaid && p.status !== "cancelled";

      // Filtro de método
      const matchesMethod =
        methodFilter === "all" || p.payment_method?.toLowerCase().includes(methodFilter.toLowerCase());

      // Filtro de período seguro (sem bug de timezone)
      let matchesPeriod = true;
      const pDateStr = (p.payment_date || "").slice(0, 7);
      if (periodFilter === "this_month") {
        matchesPeriod = pDateStr === currentMonthStr;
      } else if (periodFilter === "last_month") {
        matchesPeriod = pDateStr === prevMonthStr;
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesPeriod;
    });
  }, [allTransactions, searchTerm, statusFilter, methodFilter, periodFilter]);

  // Cálculos de Resumo Financeiro
  const metrics = useMemo(() => {
    let totalReceived = 0;
    let totalPending = 0;
    let totalCreditCard = 0;
    let totalPix = 0;
    let totalCash = 0;

    filteredPayments.forEach((p: any) => {
      const val = Number(p.amount) || 0;
      const isPaid =
        p.status === "paid" ||
        p.status === "partial" ||
        p.status === "pago" ||
        p.status === "pago parcial" ||
        (Boolean(p.paid_at) && p.status !== "pending" && p.status !== "cancelled") ||
        (!p.status && val > 0);

      if (isPaid) {
        totalReceived += val;
        const method = (p.payment_method || "").toLowerCase();
        if (method.includes("crédito") || method.includes("cartão")) {
          totalCreditCard += val;
        } else if (method.includes("pix")) {
          totalPix += val;
        } else if (method.includes("dinheiro")) {
          totalCash += val;
        }
      } else if (p.status === "pending") {
        totalPending += val;
      }
    });

    const totalQuotesValue = quotes.reduce((acc, q: any) => acc + (Number(q.total_value) || 0), 0);

    return {
      totalReceived,
      totalPending,
      totalCreditCard,
      totalPix,
      totalCash,
      totalQuotesValue,
      count: filteredPayments.length,
    };
  }, [filteredPayments, quotes]);

  // Balanço agrupado por Paciente
  const patientBalances = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; paid: number; pending: number; count: number }>();

    allTransactions.forEach((t: any) => {
      const pId = t.patient_id || t.patients?.id;
      if (!pId) return;
      const pName = t.patients?.name || "Paciente";
      const pPhone = t.patients?.phone || "";

      if (!map.has(pId)) {
        map.set(pId, { id: pId, name: pName, phone: pPhone, paid: 0, pending: 0, count: 0 });
      }

      const entry = map.get(pId)!;
      const val = Number(t.amount) || 0;
      const isPaid =
        t.status === "paid" ||
        t.status === "partial" ||
        t.status === "pago" ||
        Boolean(t.paid_at) ||
        (t.status !== "pending" && t.status !== "cancelled");

      if (isPaid) {
        entry.paid += val;
      } else if (t.status === "pending") {
        entry.pending += val;
      }
      entry.count += 1;
    });

    const list = Array.from(map.values());
    if (searchTerm.trim()) {
      return list.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list.sort((a, b) => b.paid - a.paid);
  }, [allTransactions, searchTerm]);

  // Salvar Novo Pagamento / Parcelamento
  const handleSavePayment = async () => {
    if (!form.patient_id) {
      toast.error("Selecione o paciente.");
      return;
    }
    const totalVal = parseFloat(form.amount.replace(",", "."));
    if (isNaN(totalVal) || totalVal <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!form.payment_method) {
      toast.error("Informe a forma de pagamento.");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login para registrar pagamentos.");
      setSaving(false);
      return;
    }

    try {
      if (editingPayment) {
        if (editingPayment.source === "quote") {
          // Atualiza o orçamento diretamente
          await supabase
            .from("quotes")
            .update({
              paid_amount: totalVal,
              payment_status: form.status,
              payment_method: form.payment_method,
              payment_date: form.payment_date,
              payment_notes: form.notes || null,
            })
            .eq("id", editingPayment.quote_id);
        } else {
          // Atualização de pagamento existente
          const { error } = await supabase
            .from("payments")
            .update({
              patient_id: form.patient_id,
              amount: totalVal,
              payment_method: form.payment_method,
              payment_date: form.payment_date,
              description: form.description || null,
              notes: form.notes || null,
              status: form.status,
              paid_at: form.status === "paid" ? new Date().toISOString() : null,
            })
            .eq("id", editingPayment.id);

          if (error) throw error;
        }
        toast.success("Pagamento atualizado com sucesso!");
      } else if (form.is_installment) {
        // Lançamento de Parcelas Múltiplas (ex: Cartão de Crédito em 3x)
        const count = parseInt(form.installment_count) || 2;
        const installmentValue = Math.round((totalVal / count) * 100) / 100;
        const baseDate = new Date(form.payment_date + "T12:00:00");

        const installmentsToInsert = [];
        for (let i = 1; i <= count; i++) {
          const installmentDate = new Date(baseDate);
          installmentDate.setMonth(baseDate.getMonth() + (i - 1));
          const dateStr = installmentDate.toISOString().split("T")[0];

          const isFirstPaid = i === 1 && form.first_installment_paid;
          const status = form.status === "paid" || isFirstPaid ? "paid" : "pending";

          const desc = form.description?.trim()
            ? `${form.description.trim()} (Parcela ${i}/${count})`
            : `Parcela ${i}/${count} (${form.payment_method})`;

          installmentsToInsert.push({
            user_id: user.id,
            patient_id: form.patient_id,
            amount: installmentValue,
            payment_method: `${form.payment_method} (${count}x)`,
            payment_date: dateStr,
            description: desc,
            notes: form.notes ? `${form.notes} [Plano de ${count}x de R$ ${installmentValue.toFixed(2)}]` : null,
            status,
            paid_at: status === "paid" ? new Date().toISOString() : null,
          });
        }

        const { error } = await supabase.from("payments").insert(installmentsToInsert);
        if (error) throw error;
        toast.success(`${count} parcelas geradas com sucesso!`);
      } else {
        // Lançamento Único (À vista)
        const { error } = await supabase.from("payments").insert({
          user_id: user.id,
          patient_id: form.patient_id,
          amount: totalVal,
          payment_method: form.payment_method,
          payment_date: form.payment_date,
          description: form.description || "Pagamento de Consulta / Procedimento",
          notes: form.notes || null,
          status: form.status,
          paid_at: form.status === "paid" ? new Date().toISOString() : null,
        });

        if (error) throw error;
        toast.success("Pagamento registrado com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ["payments-all"] });
      queryClient.invalidateQueries({ queryKey: ["quotes-all"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setShowNewModal(false);
      setEditingPayment(null);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar pagamento.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      patient_id: "",
      amount: "",
      payment_method: "Pix",
      payment_date: new Date().toISOString().split("T")[0],
      description: "",
      notes: "",
      status: "paid",
      is_installment: false,
      installment_count: "3",
      first_installment_paid: true,
    });
  };

  // Marcar como pago com 1 clique
  const handleMarkAsPaid = async (item: any) => {
    try {
      if (item.source === "quote") {
        await supabase
          .from("quotes")
          .update({ payment_status: "paid", paid_amount: item.amount, payment_date: new Date().toISOString().split("T")[0] })
          .eq("id", item.quote_id);
      } else {
        await supabase
          .from("payments")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", item.id);
      }
      toast.success("Pagamento marcado como recebido!");
      queryClient.invalidateQueries({ queryKey: ["payments-all"] });
      queryClient.invalidateQueries({ queryKey: ["quotes-all"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch {
      toast.error("Erro ao atualizar pagamento.");
    }
  };

  // Excluir pagamento
  const handleDeletePayment = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.startsWith("quote-")) {
        const quoteId = deleteTarget.replace("quote-", "");
        await supabase.from("quotes").update({ payment_status: "pending", paid_amount: 0 }).eq("id", quoteId);
      } else {
        await supabase.from("payments").delete().eq("id", deleteTarget);
      }
      toast.success("Lançamento excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["payments-all"] });
      queryClient.invalidateQueries({ queryKey: ["quotes-all"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    } catch {
      toast.error("Erro ao excluir pagamento.");
    }
    setDeleteTarget(null);
  };

  // Abrir modal de edição
  const handleOpenEdit = (p: any) => {
    setEditingPayment(p);
    setForm({
      patient_id: p.patient_id,
      amount: p.amount.toString(),
      payment_method: p.payment_method || "Pix",
      payment_date: p.payment_date,
      description: p.description || "",
      notes: p.notes || "",
      status: p.status || "paid",
      is_installment: false,
      installment_count: "3",
      first_installment_paid: false,
    });
    setShowNewModal(true);
  };

  // Abrir modal para paciente específico
  const handleNewForPatient = (patientId: string) => {
    resetForm();
    setForm((prev) => ({ ...prev, patient_id: patientId }));
    setEditingPayment(null);
    setShowNewModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-primary" />
            Controle Financeiro
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-0.5">
            Gestão unificada de entradas, pagamentos de consultas, parcelamento de protocolos e recebimentos de pacientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPayments();
              refetchQuotes();
              toast.success("Dados financeiros atualizados!");
            }}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setEditingPayment(null);
              setShowNewModal(true);
            }}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova Entrada / Pagamento
          </Button>
        </div>
      </div>

      {/* Cards de Métricas e Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recebido */}
        <div className="bg-card border-2 border-green-500/20 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden bg-green-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Total Recebido</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-green-800 tracking-tight">
            {metrics.totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {metrics.count} recebimento(s) contabilizado(s)
          </p>
        </div>

        {/* Pendente / A Receber */}
        <div className="bg-card border-2 border-amber-500/20 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">A Receber / Pendente</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-amber-700 tracking-tight">
            {metrics.totalPending.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            Parcelas futuras e valores em aberto
          </p>
        </div>

        {/* Entradas no Cartão */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Cartão de Crédito</span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-foreground tracking-tight">
            {metrics.totalCreditCard.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            Recebido em cartão (à vista / parcelado)
          </p>
        </div>

        {/* Entradas Pix & Dinheiro */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary-foreground uppercase tracking-wider">Pix & Dinheiro</span>
            <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary-foreground">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-foreground tracking-tight">
            {(metrics.totalPix + metrics.totalCash).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            Liquidez direta (Pix: {metrics.totalPix.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por paciente ou descrição */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Filtro de Período */}
          <div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o Histórico (Completo)</SelectItem>
                <SelectItem value="this_month">Mês Atual ({format(new Date(), "MMMM", { locale: ptBR })})</SelectItem>
                <SelectItem value="last_month">Mês Anterior</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Status */}
          <div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="paid">Recebidos / Pagos</SelectItem>
                <SelectItem value="pending">Pendentes / A Receber</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Forma de Pagamento */}
          <div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Formas</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="débito">Cartão de Débito</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferência">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs de Visualização */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="transactions" className="gap-2">
            <FileText className="w-4 h-4" /> Extrato de Entradas ({filteredPayments.length})
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-2">
            <Users className="w-4 h-4" /> Balanço por Paciente ({patientBalances.length})
          </TabsTrigger>
          <TabsTrigger value="installments" className="gap-2">
            <Layers className="w-4 h-4" /> Parcelamentos & Cartão
          </TabsTrigger>
          <TabsTrigger value="protocols" className="gap-2">
            <TrendingUp className="w-4 h-4" /> Protocolos & Orçamentos ({quotes.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Extrato Geral de Entradas */}
        <TabsContent value="transactions" className="mt-4">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            {loadingPayments ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Carregando transações...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <p className="text-base font-medium text-foreground">Nenhuma entrada encontrada com os filtros atuais</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Alterne para 'Todo o Histórico' ou registre pagamentos de consultas para acompanhar o fluxo.
                </p>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowNewModal(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Lançar Pagamento
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredPayments.map((p: any) => {
                  const isPaid =
                    p.status === "paid" ||
                    p.status === "partial" ||
                    p.status === "pago" ||
                    p.status === "pago parcial" ||
                    (Boolean(p.paid_at) && p.status !== "pending" && p.status !== "cancelled");

                  return (
                    <div
                      key={p.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                    >
                      {/* Informações da Transação */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isPaid ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {p.patients?.name ? (
                              <Link
                                to={`/pacientes/${p.patients.id || p.patient_id}`}
                                className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                              >
                                <span>{p.patients.name}</span>
                                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-foreground">Paciente</span>
                            )}

                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {p.payment_method || "Pix"}
                            </span>

                            {isPaid ? (
                              <span className="text-[11px] font-medium text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Recebido / Pago
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pendente
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-foreground/80 mt-1 font-body">
                            {p.description || "Pagamento registrado"}
                          </p>

                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            📅 {new Date(p.payment_date + "T12:00:00").toLocaleDateString("pt-BR")}
                            {p.notes && ` · 📝 ${p.notes}`}
                          </p>
                        </div>
                      </div>

                      {/* Valor e Ações */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                        <div className="text-right">
                          <p className="text-base font-bold font-heading text-foreground">
                            {Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {isPaid ? "Liquidado" : "A vencer"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {!isPaid && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1"
                              onClick={() => handleMarkAsPaid(p)}
                              title="Marcar como recebido"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Receber
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(p)}
                            title="Editar lançamento"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(p.id)}
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Balanço por Paciente */}
        <TabsContent value="balances" className="mt-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Resumo Financeiro por Paciente
                </h3>
                <p className="text-xs text-muted-foreground font-body">
                  Consolidação do total já pago e valores em aberto de cada paciente.
                </p>
              </div>
            </div>

            {patientBalances.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
                <p className="text-sm">Nenhum paciente com lançamentos financeiros.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {patientBalances.map((pb) => (
                  <div key={pb.id} className="p-4 rounded-xl border border-border/80 bg-background space-y-3 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          to={`/pacientes/${pb.id}`}
                          className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                        >
                          <span>{pb.name}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                        </Link>
                        {pb.phone && <p className="text-xs text-muted-foreground">{pb.phone}</p>}
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {pb.count} {pb.count === 1 ? "registro" : "registros"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                      <div className="bg-green-50/60 p-2 rounded border border-green-200/60">
                        <span className="text-green-700 font-medium block">Total Pago</span>
                        <span className="text-sm font-bold text-green-800">
                          {pb.paid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <div className="bg-amber-50/60 p-2 rounded border border-amber-200/60">
                        <span className="text-amber-700 font-medium block">Pendente</span>
                        <span className="text-sm font-bold text-amber-800">
                          {pb.pending.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs gap-1"
                        onClick={() => handleNewForPatient(pb.id)}
                      >
                        <Plus className="w-3.5 h-3.5" /> Lançar Pagamento
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Visão de Parcelamentos */}
        <TabsContent value="installments" className="mt-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Controle de Parcelas & Cartões
                </h3>
                <p className="text-xs text-muted-foreground font-body">
                  Acompanhe parcelas futuras de tratamentos parcelados no cartão de crédito ou carnê.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {filteredPayments.filter((p: any) => p.payment_method?.includes("x") || p.description?.includes("Parcela")).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Layers className="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
                  <p className="text-sm font-medium">Nenhum pagamento parcelado no período.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao registrar uma entrada com a opção "Parcelar", as parcelas mensais aparecerão organizadas aqui.
                  </p>
                </div>
              ) : (
                filteredPayments
                  .filter((p: any) => p.payment_method?.includes("x") || p.description?.includes("Parcela"))
                  .map((p: any) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-lg border border-border/80 bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{p.patients?.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {p.payment_method}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.description} · Vencimento: {new Date(p.payment_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">
                          {Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        {p.status === "paid" ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                            Pago
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => handleMarkAsPaid(p)}
                          >
                            Baixar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Protocolos & Orçamentos */}
        <TabsContent value="protocols" className="mt-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Protocolos e Orçamentos Gerados
                </h3>
                <p className="text-xs text-muted-foreground font-body">
                  Acompanhe os tratamentos propostos para os pacientes e os valores totais.
                </p>
              </div>
            </div>

            {quotes.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
                <p className="text-sm">Nenhum orçamento gerado ainda.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {quotes.map((q: any) => {
                  const paid = Number(q.paid_amount) || 0;
                  const total = Number(q.total_value) || 0;
                  const isPaid = q.payment_status === "paid" || paid >= total;

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-border bg-background space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/pacientes/${q.patients?.id || q.patient_id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <User className="w-3.5 h-3.5 text-primary" />
                          {q.patients?.name || "Paciente"}
                        </Link>
                        <span className="text-sm font-bold text-foreground">
                          {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">
                          Pago: <strong className="text-green-700">{paid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isPaid ? "bg-green-100 text-green-800" : paid > 0 ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {isPaid ? "Quitado" : paid > 0 ? "Parcial" : "Pendente"}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        📅 Gerado em {new Date(q.created_at).toLocaleDateString("pt-BR")} · Validade: {q.validity_days} dias
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Novo Pagamento / Parcelamento */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">
              {editingPayment ? "Editar Lançamento Financeiro" : "Registrar Nova Entrada / Pagamento"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados do recebimento para incluir no controle financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seleção do Paciente */}
            <div>
              <Label className="text-xs font-semibold">Paciente *</Label>
              <Select
                value={form.patient_id}
                onValueChange={(val) => setForm({ ...form, patient_id: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o paciente..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {patients.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor e Data */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 500,00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Data do Pagamento *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <Label className="text-xs font-semibold">Forma de Pagamento *</Label>
              <Select
                value={form.payment_method}
                onValueChange={(val) => setForm({ ...form, payment_method: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a forma..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Opção de Parcelamento (apenas ao criar novo) */}
            {!editingPayment && (
              <div className="bg-muted/30 border border-border/80 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">Pagamento Parcelado no Cartão / Protocolo</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Gera automaticamente as parcelas mensais no controle.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.is_installment}
                    onChange={(e) => setForm({ ...form, is_installment: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>

                {form.is_installment && (
                  <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/60 animate-fade-in">
                    <div>
                      <Label className="text-xs font-medium">Número de Parcelas</Label>
                      <Select
                        value={form.installment_count}
                        onValueChange={(val) => setForm({ ...form, installment_count: val })}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                            <SelectItem key={n} value={n.toString()}>
                              {n}x {form.amount && !isNaN(Number(form.amount))
                                ? `de ${(Number(form.amount) / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">1ª Parcela já paga hoje?</Label>
                      <Select
                        value={form.first_installment_paid ? "yes" : "no"}
                        onValueChange={(val) => setForm({ ...form, first_installment_paid: val === "yes" })}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Sim (1ª Recebida hoje)</SelectItem>
                          <SelectItem value="no">Não (Todas Pendentes)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status (quando não parcelado) */}
            {!form.is_installment && (
              <div>
                <Label className="text-xs font-semibold">Status do Pagamento</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Recebido / Pago</SelectItem>
                    <SelectItem value="pending">Pendente / A Receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Descrição com sugestões rápidas */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Descrição / Procedimento</Label>
                <span className="text-[11px] text-muted-foreground">Sugestões rápidas</span>
              </div>
              <div className="flex flex-wrap gap-1 pb-1.5">
                {QUICK_DESCRIPTIONS.map((sug) => (
                  <button
                    type="button"
                    key={sug}
                    onClick={() => setForm({ ...form, description: sug })}
                    className="text-[11px] px-2 py-0.5 rounded border border-border/70 bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/40 text-muted-foreground transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Ex: Consulta 1ª vez / Protocolo Capilar 4 sessões"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Observações */}
            <div>
              <Label className="text-xs font-semibold">Observações Adicionais</Label>
              <Textarea
                placeholder="Notas internas sobre o pagamento, comprovante, etc..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={saving}>
              {saving ? "Salvando..." : editingPayment ? "Salvar Alterações" : "Registrar Entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento financeiro?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de pagamento? O valor será removido do controle financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Financeiro;
