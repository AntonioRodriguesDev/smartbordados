import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cake, X } from "lucide-react";
import { Link } from "react-router-dom";
import { daysUntilBirthday } from "@/lib/costs";

type Emp = { id: string; nome: string; data_nascimento: string | null; cargo: string | null };

const STORAGE_KEY = "birthday-banner-dismissed";

function isDismissedToday(): boolean {
  const v = localStorage.getItem(STORAGE_KEY);
  if (!v) return false;
  const today = new Date().toISOString().slice(0, 10);
  return v === today;
}

export default function BirthdayBanner() {
  const [items, setItems] = useState<(Emp & { dias: number })[]>([]);
  const [hidden, setHidden] = useState(isDismissedToday());

  useEffect(() => {
    if (hidden) return;
    supabase.from("employees").select("id, nome, data_nascimento, cargo").eq("status", "ativo")
      .then(({ data }) => {
        const list = (data || [])
          .filter(e => e.data_nascimento)
          .map(e => ({ ...e, dias: daysUntilBirthday(e.data_nascimento!) }))
          .filter(e => e.dias <= 14)
          .sort((a, b) => a.dias - b.dias);
        setItems(list);
      });
  }, [hidden]);

  if (hidden || items.length === 0) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10));
    setHidden(true);
  };

  const label = (d: number) => d === 0 ? "Hoje 🎂" : d === 1 ? "Amanhã" : `em ${d} dias`;

  return (
    <div className="mb-3 rounded-xl border border-sidebar-border bg-sidebar/80 backdrop-blur-xl shadow-card relative overflow-hidden">
      <div className="flex items-center gap-3 p-2.5 pr-9">
        <div className="w-9 h-9 rounded-lg gradient-gold flex items-center justify-center text-primary-foreground shrink-0 shadow-gold/20 shadow-lg">
          <Cake className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/70 whitespace-nowrap">Aniversários</span>
          {items.slice(0, 6).map(e => (
            <Link key={e.id} to="/funcionarios" className="flex items-center gap-1.5 text-xs whitespace-nowrap hover:underline text-sidebar-foreground">
              <span className="font-semibold">{e.nome.split(" ")[0]}</span>
              <span className="opacity-40">·</span>
              <span className={e.dias === 0 ? "text-primary font-bold animate-pulse" : "text-sidebar-foreground/90"}>{label(e.dias)}</span>
            </Link>
          ))}
          {items.length > 6 && <span className="text-[10px] text-sidebar-foreground/60">+{items.length - 6}</span>}
        </div>
        <button onClick={dismiss} className="absolute top-1.5 right-1.5 p-1 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-white/10 transition-colors" aria-label="Fechar">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
