import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ProcedurePricesSettings = () => {
  const queryClient = useQueryClient();

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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["procedure_prices"] });

  const addItem = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("procedure_prices").insert({
      user_id: user.id,
      name: "Novo procedimento",
      price: 0,
      sort_order: items.length,
    });
    if (error) toast.error(`Erro ao adicionar: ${error.message}`);
    else refresh();
  };

  const updateItem = async (id: string, patch: { name?: string; price?: number }) => {
    const { error } = await supabase.from("procedure_prices").update(patch).eq("id", id);
    if (error) toast.error(`Erro ao salvar: ${error.message}`);
    else {
      toast.success("Cardápio atualizado.");
      refresh();
    }
  };

  const removeItem = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}" do cardápio?`)) return;
    const { error } = await supabase.from("procedure_prices").delete().eq("id", id);
    if (error) toast.error(`Erro ao remover: ${error.message}`);
    else refresh();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <Tag className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-heading font-semibold text-foreground">Valor das sessões</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre cada procedimento e o valor de uma sessão. Ao gerar um orçamento, basta escolher o procedimento e a
        quantidade de sessões. Alterar um valor aqui vale para os próximos orçamentos; os já gerados não mudam.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-2">
          {items.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="flex-1">Procedimento</span>
              <span className="w-36">Valor por sessão</span>
              <span className="w-8" />
            </div>
          )}
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2">
              <Input
                defaultValue={i.name}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== i.name) updateItem(i.id, { name });
                }}
                className="flex-1"
              />
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={Number(i.price)}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v !== Number(i.price)) updateItem(i.id, { price: v });
                  }}
                  className="pl-9"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(i.id, i.name)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
                title="Remover do cardápio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-1" onClick={addItem}>
            <Plus className="w-4 h-4" /> Adicionar procedimento
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProcedurePricesSettings;
