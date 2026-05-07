import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Target, LogOut, ListChecks, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-smartbordados.png";

const items = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/faturar", label: "Faturar", icon: FileText },
  { to: "/faturamentos", label: "Lançamentos", icon: ListChecks },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/funcionarios", label: "Funcionários", icon: UserCog },
  { to: "/meta", label: "Meta", icon: Target },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const logout = async () => { await supabase.auth.signOut(); nav("/auth"); };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex-col p-4">
        <div className="px-2 py-4 mb-4 flex items-center justify-center">
          <img src={logo} alt="Smart Bordados" className="w-full max-w-[180px] object-contain" />
        </div>
        <nav className="flex-1 space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active ? "gradient-primary text-primary-foreground shadow-elevated" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}>
                <Icon className="w-4 h-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" onClick={logout} className="justify-start gap-2">
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </aside>

      {/* Mobile top bar with logo */}
      <header className="md:hidden sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <img src={logo} alt="Smart Bordados" className="h-10 object-contain" />
        <Button variant="ghost" size="icon" onClick={logout}><LogOut className="w-4 h-4" /></Button>
      </header>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border grid grid-cols-6 z-50">
        {items.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to;
          return (
            <Link key={to} to={to} className={cn(
              "flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}>
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
