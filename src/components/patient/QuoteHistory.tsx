import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateQuotePDF } from "@/lib/generateQuotePDF";

interface Props {
  patientId: string;
  patientName: string;
}

const QuoteHistory = ({ patientId, patientName }: Props) => {
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

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (quotes.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum orçamento gerado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((q: any) => (
        <div key={q.id} className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                {new Date(q.created_at).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground">
                Validade: {q.validity_days} dias · {q.quote_items.length} {q.quote_items.length === 1 ? "item" : "itens"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-heading font-semibold text-primary">
                {Number(q.total_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 mb-3">
            {q.quote_items.map((it: any) => (
              <li key={it.id} className="flex justify-between">
                <span>{it.procedure_name}</span>
                <span>{Number(it.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() =>
              generateQuotePDF({
                patientName,
                date: new Date(q.created_at).toLocaleDateString("pt-BR"),
                validityDays: q.validity_days,
                paymentMethods: q.payment_methods || "",
                items: q.quote_items.map((it: any) => ({
                  procedure_name: it.procedure_name,
                  description: it.description,
                  value: Number(it.value),
                })),
                notes: q.notes,
              })
            }
          >
            <FileDown className="w-3.5 h-3.5" /> Baixar PDF
          </Button>
        </div>
      ))}
    </div>
  );
};

export default QuoteHistory;