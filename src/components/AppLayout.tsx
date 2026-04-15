import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "./AppSidebar";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Top bar with hamburger */}
      <div
        className={`fixed top-0 right-0 left-0 h-14 bg-card border-b border-border z-20 flex items-center px-4 transition-all duration-300 ${
          sidebarOpen ? "lg:pl-[272px]" : ""
        }`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <main
        className={`pt-14 p-6 transition-all duration-300 ${
          sidebarOpen ? "lg:ml-64" : ""
        }`}
      >
        <div className="pt-2">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
