import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Users, Target, LogOut, ListChecks, UserCog, DollarSign, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import BirthdayBanner from "@/components/BirthdayBanner";
import logo from "@/assets/logo-smartbordados.jpg";

const items = [
  { to: "/", label: "Visão Geral", icon: LayoutDashboard },
  { to: "/faturar", label: "Faturar", icon: FileText },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/custos", label: "Custos", icon: Wallet },
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
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-52">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-52 glass-sidebar flex-col p-4 z-50">
        <div className="px-2 py-4 mb-4 flex items-center justify-center">
          <img src={logo} alt="Smart Bordados" className="w-full max-w-[160px] object-contain drop-shadow-sm rounded-xl" />
        </div>
        <nav className="flex-1 space-y-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to} className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                active 
                  ? "gradient-primary text-primary-foreground shadow-elevated scale-[1.02]" 
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 hover:pl-4"
              )}>
                <Icon className={cn("w-4 h-4 transition-transform duration-300", active && "scale-110")} /> {label}
              </Link>
            );
          })}
        </nav>
        <Button variant="ghost" onClick={logout} className="justify-start gap-2 text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </Button>
      </aside>

      {/* Mobile top bar with logo */}
      <header className="md:hidden sticky top-0 z-40 bg-sidebar text-sidebar-foreground px-4 py-2 flex items-center justify-between">
        <img src={logo} alt="Smart Bordados" className="h-10 object-contain rounded-lg" />
        <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground/70 hover:text-destructive"><LogOut className="w-4 h-4" /></Button>
      </header>

      <main className="p-4 md:p-4 max-w-[1600px] mx-auto animate-fade-in-up">
        <BirthdayBanner />
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border flex overflow-x-auto z-50 no-scrollbar">
        {items.map(({ to, label, icon: Icon }) => {
          const active = loc.pathname === to;
          return (
            <Link key={to} to={to} className={cn(
              "flex-1 min-w-[72px] flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors",
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
