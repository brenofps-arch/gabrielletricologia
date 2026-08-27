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
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Pencil,
  FileText,
  Layers,
  ArrowUpRight,
  User,
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
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
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
  const [periodFilter, setPeriodFilter] = useState("this_month"); // this_month, last_month, all
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
    first_installment_paid: true, // Se true, a 1ª parcela fica como 'paid' e as demais como 'pending'
  });

  // Busca lista de pagamentos com dados do paciente
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
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

  // Busca orçamentos para visão de protocolos
  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(`
          *,
          patients (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filtro de pagamentos
  const filteredPayments = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (periodFilter === "this_month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (periodFilter === "last_month") {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = startOfMonth(prevMonth);
      end = endOfMonth(prevMonth);
    }

    return payments.filter((p: any) => {
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
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;

      // Filtro de método
      const matchesMethod =
        methodFilter === "all" || p.payment_method?.toLowerCase().includes(methodFilter.toLowerCase());

      // Filtro de período
      let matchesPeriod = true;
      if (start && end && p.payment_date) {
        try {
          const pDate = parseISO(p.payment_date);
          matchesPeriod = isWithinInterval(pDate, { start, end });
        } catch {
          matchesPeriod = true;
        }
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesPeriod;
    });
  }, [payments, searchTerm, statusFilter, methodFilter, periodFilter]);

  // Cálculos de Resumo Financeiro
  const metrics = useMemo(() => {
    let totalReceived = 0;
    let totalPending = 0;
    let totalCreditCard = 0;
    let totalPix = 0;
    let totalCash = 0;

    filteredPayments.forEach((p: any) => {
      const val = Number(p.amount) || 0;
      if (p.status === "paid") {
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
      queryClient.invalidateQueries({ queryKey: ["payments"] });
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

  // Marcar como pago
  const handleMarkAsPaid = async (paymentId: string) => {
    const { error } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (error) {
      toast.error("Erro ao atualizar pagamento.");
    } else {
      toast.success("Pagamento marcado como recebido!");
      queryClient.invalidateQueries({ queryKey: ["payments-all"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    }
  };

  // Excluir pagamento
  const handleDeletePayment = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("payments").delete().eq("id", deleteTarget);
    if (error) {
      toast.error("Erro ao excluir pagamento.");
    } else {
      toast.success("Pagamento excluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["payments-all"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    }
    setDeleteTarget(null);
  };

  // Abrir modal de edição
  const handleOpenEdit = (p: any) => {
    setEditingPayment(p);
    setForm({
      patient_id: p.patient_id,
      amount: p.amount.toString(),
      payment_method: p.payment_method,
      payment_date: p.payment_date,
      description: p.description || "",
      notes: p.notes || "",
      status: p.status,
      is_installment: false,
      installment_count: "3",
      first_installment_paid: false,
    });
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
            Gerencie entradas, pagamentos de consultas, parcelamento de protocolos e fluxo de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Total Recebido</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-foreground tracking-tight">
            {metrics.totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            Entradas confirmadas no período
          </p>
        </div>

        {/* Pendente / A Receber */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">A Receber / Pendente</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-heading text-amber-600 tracking-tight">
            {metrics.totalPending.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="text-xs text-muted-foreground">
            Parcelas futuras e pagamentos em aberto
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
            À vista ou parcelado
          </p>
        </div>

        {/* Entradas Pix / Dinheiro */}
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
            Liquidez imediata (Pix: {metrics.totalPix.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
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
                <SelectItem value="this_month">Mês Atual ({format(new Date(), "MMMM", { locale: ptBR })})</SelectItem>
                <SelectItem value="last_month">Mês Anterior</SelectItem>
                <SelectItem value="all">Todo o Histórico</SelectItem>
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
                <SelectItem value="pending">Pendentes</SelectItem>
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
                <p className="text-base font-medium text-foreground">Nenhuma entrada encontrada</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Registre pagamentos de consultas ou parcelas de protocolos para acompanhar seu fluxo financeiro.
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
                {filteredPayments.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Informações da Transação */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          p.status === "paid" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {p.status === "paid" ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.patients?.name ? (
                            <Link
                              to={`/pacientes/${p.patients.id}`}
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1 group"
                            >
                              <span>{p.patients.name}</span>
                              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-foreground">Paciente não identificado</span>
                          )}

                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {p.payment_method}
                          </span>

                          {p.status === "paid" ? (
                            <span className="text-[11px] font-medium text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Recebido
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
                          {p.status === "paid" ? "Liquidado" : "A vencer"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        {p.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1"
                            onClick={() => handleMarkAsPaid(p.id)}
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
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Visão de Parcelamentos */}
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
                            onClick={() => handleMarkAsPaid(p.id)}
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

        {/* Tab 3: Protocolos & Orçamentos */}
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
                {quotes.map((q: any) => (
                  <div key={q.id} className="p-4 rounded-xl border border-border bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/pacientes/${q.patients?.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        <User className="w-3.5 h-3.5 text-primary" />
                        {q.patients?.name || "Paciente"}
                      </Link>
                      <span className="text-sm font-bold text-foreground">
                        {Number(q.total_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      📅 Gerado em {new Date(q.created_at).toLocaleDateString("pt-BR")} · Validade: {q.validity_days} dias
                    </p>
                    {q.payment_methods && (
                      <p className="text-xs text-foreground/80 bg-muted/40 p-2 rounded border border-border/50">
                        💳 Condições: {q.payment_methods}
                      </p>
                    )}
                  </div>
                ))}
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
