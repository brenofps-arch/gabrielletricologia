import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  onApply: (result: { lines: string; total: number }) => void;
}

const ProcedureMenu = ({ onApply }: Props) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["procedure_prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("procedure_prices")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const changeQty = (id: string, delta: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const selected = items.filter((i) => (quantities[i.id] ?? 0) > 0);
  const total = selected.reduce((sum, i) => sum + Number(i.price) * (quantities[i.id] ?? 0), 0);

  const apply = () => {
    const lines = selected
      .map((i) => {
        const qty = quantities[i.id];
        return `${qty} ${qty === 1 ? "sessão" : "sessões"} de ${i.name}`;
      })
      .join("\n");
    onApply({ lines, total: Math.round(total * 100) / 100 });
  };

  return (
    <div className="bg-muted/20 border border-border/80 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ListChecks className="w-4 h-4" />
          <span>Cardápio de procedimentos</span>
        </div>
        <Link to="/configuracoes" className="text-xs text-primary hover:underline" target="_blank" rel="noopener">
          Editar valores
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          O cardápio está vazio. Cadastre os procedimentos e o valor de cada sessão em Configurações.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => {
            const qty = quantities[i.id] ?? 0;
            return (
              <div key={i.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${qty > 0 ? "bg-primary/5" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(Number(i.price))} por sessão</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.id, -1)} disabled={qty === 0}>
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium">{qty}</span>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.id, 1)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <span className="w-24 text-right text-sm text-muted-foreground">{qty > 0 ? formatBRL(Number(i.price) * qty) : ""}</span>
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
            <div>
              <p className="text-xs text-muted-foreground">Total à vista</p>
              <p className="text-lg font-heading font-semibold text-foreground">{formatBRL(total)}</p>
            </div>
            <Button type="button" size="sm" onClick={apply} disabled={total <= 0}>
              Aplicar ao orçamento
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcedureMenu;
