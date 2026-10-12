import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Mode = "avulso" | "plano";

interface Props {
  onApply: (result: { lines: string; total: number }) => void;
}

const ProcedureMenu = ({ onApply }: Props) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [modes, setModes] = useState<Record<string, Mode>>({});

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

  // Procedimentos sem valor de plano só podem ser cobrados avulso.
  const unitPrice = (i: (typeof items)[number]) => {
    const hasPlan = i.plan_price !== null && i.plan_price !== undefined;
    return modes[i.id] === "plano" && hasPlan ? Number(i.plan_price) : Number(i.price);
  };

  const selected = items.filter((i) => (quantities[i.id] ?? 0) > 0);
  const total = selected.reduce((sum, i) => sum + unitPrice(i) * (quantities[i.id] ?? 0), 0);

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
            const hasPlan = i.plan_price !== null && i.plan_price !== undefined;
            const mode: Mode = modes[i.id] === "plano" && hasPlan ? "plano" : "avulso";
            return (
              <div key={i.id} className={`rounded-lg px-2 py-2 ${qty > 0 ? "bg-primary/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{i.name}</p>
                  <div className="flex items-center gap-1.5">
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.id, -1)} disabled={qty === 0}>
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(i.id, 1)}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <span className="w-24 text-right text-sm text-muted-foreground">{qty > 0 ? formatBRL(unitPrice(i) * qty) : ""}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {(["avulso", "plano"] as Mode[]).map((m) => {
                    const disabled = m === "plano" && !hasPlan;
                    const value = m === "plano" ? (hasPlan ? Number(i.plan_price) : null) : Number(i.price);
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={disabled}
                        onClick={() => setModes((cur) => ({ ...cur, [i.id]: m }))}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          mode === m
                            ? "bg-primary text-primary-foreground border-primary font-medium"
                            : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:hover:bg-muted/40 disabled:hover:text-muted-foreground"
                        }`}
                      >
                        {m === "avulso" ? "Avulso" : "Plano"}: {value === null ? "—" : formatBRL(value)}
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted-foreground">por sessão</span>
                </div>
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
