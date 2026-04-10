import { useState } from "react";
import { Search, Plus, ChevronRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const patients = [
  { id: 1, name: "Ana Carolina Silva", phone: "(11) 99999-1234", lastVisit: "08/04/2026", condition: "Queda Capilar", sessions: 4 },
  { id: 2, name: "Beatriz Oliveira", phone: "(11) 98888-5678", lastVisit: "05/04/2026", condition: "Alopecia Areata", sessions: 8 },
  { id: 3, name: "Carla Mendes", phone: "(11) 97777-9012", lastVisit: "02/04/2026", condition: "Dermatite Seborreica", sessions: 3 },
  { id: 4, name: "Diana Ferreira", phone: "(11) 96666-3456", lastVisit: "28/03/2026", condition: "Oleosidade Excessiva", sessions: 2 },
  { id: 5, name: "Elena Santos", phone: "(11) 95555-7890", lastVisit: "25/03/2026", condition: "Queda Pós-Parto", sessions: 6 },
  { id: 6, name: "Fernanda Alves", phone: "(11) 94444-2345", lastVisit: "20/03/2026", condition: "Calvície Feminina", sessions: 10 },
];

const Pacientes = () => {
  const [search, setSearch] = useState("");
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground font-body mt-1">{patients.length} pacientes cadastrados.</p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Novo Paciente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_150px_150px_180px_80px_40px] gap-4 px-5 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider font-body">
          <span>Paciente</span>
          <span>Telefone</span>
          <span>Última Visita</span>
          <span>Condição</span>
          <span>Sessões</span>
          <span />
        </div>
        {filtered.map((patient) => (
          <div
            key={patient.id}
            className="grid grid-cols-[1fr_150px_150px_180px_80px_40px] gap-4 px-5 py-4 border-b border-border/50 items-center hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{patient.name}</span>
            </div>
            <span className="text-sm text-muted-foreground">{patient.phone}</span>
            <span className="text-sm text-muted-foreground">{patient.lastVisit}</span>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-mint-light text-secondary-foreground w-fit">
              {patient.condition}
            </span>
            <span className="text-sm text-foreground font-medium">{patient.sessions}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Pacientes;
