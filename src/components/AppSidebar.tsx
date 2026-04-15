import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoGS from "@/assets/logo-gs.jpeg";
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageCircle,
  ClipboardList,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/pacientes", icon: Users, label: "Pacientes" },
  { to: "/triagem", icon: ClipboardList, label: "Triagem" },
  { to: "/mensagens", icon: MessageCircle, label: "Mensagens" },
  { to: "/configuracoes", icon: Settings, label: "Configurações" },
];

const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-30">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={logoGS} alt="Logo Dra. Gabrielle Sagrillo" className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h1 className="font-heading text-lg font-semibold text-foreground">Dra. Gabrielle</h1>
            <p className="text-xs text-muted-foreground font-body">Medicina Capilar</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-body font-medium transition-all duration-200 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center gap-3 px-4 py-3">
          <img src={logoGS} alt="Logo GS" className="w-9 h-9 rounded-full object-cover" />
          <div>
            <p className="text-sm font-medium text-foreground font-body">Dra. Gabrielle</p>
            <p className="text-xs text-muted-foreground">CRM 18090-ES</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-body font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
