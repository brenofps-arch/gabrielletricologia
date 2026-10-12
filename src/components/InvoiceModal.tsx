import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Dados fixos da GRS, iguais aos das notas emitidas pelo contador.
const SERVICE_CODE = "04.03.01 - Hospitais e congêneres";
const NBS_CODE = "123012100 - Serviços de clínica médica";
const SERVICE_PLACE = "Vitória/ES";
const PORTAL_URL = "https://www.nfse.gov.br/EmissorNacional/Login";

const DESCRIPTION_PRESETS = [
  "Consulta médica.",
  "Consulta médica e procedimentos médicos.",
];

export interface InvoiceRecord {
  id: string;
  payment_id: string | null;
  quote_id: string | null;
  invoice_number: string;
  access_key: string | null;
  amount: number;
  service_description: string | null;
  issued_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any | null;
  invoice: InvoiceRecord | null;
  onChanged: () => void;
}

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plainAmount = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CopyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || "—"}</p>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      disabled={!value}
      title="Copiar"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(`${label} copiado.`);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
    >
      <Copy className="w-4 h-4" />
    </Button>
  </div>
);

const InvoiceModal = ({ open, onOpenChange, transaction, invoice, onChanged }: Props) => {
  const [description, setDescription] = useState(DESCRIPTION_PRESETS[0]);
  const [number, setNumber] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const patientId: string | undefined = transaction?.patient_id;

  const { data: patient } = useQuery({
    queryKey: ["invoice-patient", patientId],
    enabled: open && !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf, email")
        .eq("id", patientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!open) return;
    setDescription(invoice?.service_description || DESCRIPTION_PRESETS[0]);
    setNumber(invoice?.invoice_number || "");
    setAccessKey(invoice?.access_key || "");
    setIssuedAt(invoice?.issued_at || new Date().toISOString().slice(0, 10));
  }, [open, invoice]);

  if (!transaction) return null;

  const amount = Number(transaction.amount) || 0;
  const competence = transaction.payment_date
    ? new Date(`${transaction.payment_date}T12:00:00`).toLocaleDateString("pt-BR")
    : "";

  const handleSave = async () => {
    if (!number.trim()) {
      toast.error("Informe o número da NFS-e emitida.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Faça login primeiro.");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("invoices").insert({
      user_id: user.id,
      patient_id: transaction.patient_id,
      payment_id: transaction.source === "quote" ? null : transaction.id,
      quote_id: transaction.quote_id ?? null,
      invoice_number: number.trim(),
      access_key: accessKey.trim() || null,
      amount,
      service_description: description.trim() || null,
      issued_at: issuedAt,
    });
    setSaving(false);
    if (error) {
      toast.error(`Erro ao registrar a nota: ${error.message}`);
      return;
    }
    toast.success("NFS-e registrada.");
    onChanged();
    onOpenChange(false);
  };

  const handleRemove = async () => {
    if (!invoice) return;
    if (!confirm("Remover o registro desta nota? A nota continua existindo no portal.")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
      return;
    }
    toast.success("Registro removido.");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {invoice ? "Nota fiscal registrada" : "Gerar nota fiscal (NFS-e)"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {invoice
              ? "Esta nota já foi emitida e está vinculada a este pagamento."
              : "Copie os dados abaixo no Emissor Nacional e, depois de emitir, registre o número da nota aqui."}
          </DialogDescription>
        </DialogHeader>

        {invoice ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-green-200 bg-green-50/60 p-3">
              <CopyRow label="Número da NFS-e" value={invoice.invoice_number} />
              <CopyRow label="Valor" value={formatBRL(Number(invoice.amount))} />
              <CopyRow label="Emissão" value={new Date(`${invoice.issued_at}T12:00:00`).toLocaleDateString("pt-BR")} />
              <CopyRow label="Descrição" value={invoice.service_description || ""} />
              {invoice.access_key && <CopyRow label="Chave de acesso" value={invoice.access_key} />}
            </div>
            <Button type="button" variant="outline" className="gap-2 text-destructive" onClick={handleRemove}>
              <Trash2 className="w-4 h-4" /> Remover registro
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!patient?.cpf && (
              <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-2.5">
                O paciente não tem CPF cadastrado. Preencha o CPF na ficha dele antes de emitir a nota.
              </p>
            )}

            <div className="rounded-xl border border-border p-3">
              <CopyRow label="Tomador (nome)" value={patient?.name || transaction.patients?.name || ""} />
              <CopyRow label="CPF do tomador" value={patient?.cpf || ""} />
              <CopyRow label="Valor do serviço" value={plainAmount(amount)} />
              <CopyRow label="Competência" value={competence} />
              <CopyRow label="Código de tributação" value={SERVICE_CODE} />
              <CopyRow label="NBS" value={NBS_CODE} />
              <CopyRow label="Local da prestação" value={SERVICE_PLACE} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Descrição do serviço</Label>
              <div className="flex flex-wrap gap-1.5">
                {DESCRIPTION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDescription(d)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      description === d
                        ? "bg-primary text-primary-foreground border-primary font-medium"
                        : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(description);
                    toast.success("Descrição copiada.");
                  } catch {
                    toast.error("Não foi possível copiar.");
                  }
                }}
              >
                <Copy className="w-3.5 h-3.5" /> Copiar descrição
              </Button>
            </div>

            <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="w-full gap-2">
                <ExternalLink className="w-4 h-4" /> Abrir o Emissor Nacional
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground -mt-2">
              Entre com o CNPJ da GRS, escolha "Emissão completa" e use os dados acima. Sem imposto retido.
            </p>

            <div className="rounded-xl border border-border p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Depois de emitir, registre a nota</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Número da NFS-e *</Label>
                  <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Ex.: 23" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de emissão</Label>
                  <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chave de acesso (opcional)</Label>
                <Input value={accessKey} onChange={(e) => setAccessKey(e.target.value)} className="h-9" />
              </div>
              <Button type="button" className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Registrar nota emitida"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModal;
