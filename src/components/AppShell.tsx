import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Target, TrendingUp, LogOut, Wallet, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const items = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/faturar", label: "Faturar", icon: FileText },
  { to: "/faturamentos", label: "Lançamentos", icon: ListChecks },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/meta", label: "Meta", icon: Target },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const logout = async () => { await supabase.auth.signOut(); nav("/auth"); };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-60">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-sidebar border-r border-sidebar-border flex-col p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm">Ateliê</div>
            <div className="text-xs text-muted-foreground">Financeiro</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground shadow-elevated" : "text-sidebar-foreground hover:bg-sidebar-accent"
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

      <main className="p-4 md:p-8 max-w-6xl mx-auto">{children}</main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border grid grid-cols-5 z-50">
        {items.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to;
          return (
            <Link key={to} to={to} className={cn(
              "flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium",
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
