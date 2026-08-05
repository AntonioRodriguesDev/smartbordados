import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import Dashboard from "./Dashboard";
import Faturar from "./Faturar";
import Faturamentos from "./Faturamentos";
import Clientes from "./Clientes";
import Previsao from "./Previsao";
import Meta from "./Meta";
import Funcionarios from "./Funcionarios";
import Financeiro from "./Financeiro";
import Custos from "./Custos";
import Precos from "./Precos";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";

const Index = () => {
  const { session, loading } = useAuth();

  // auto-update overdue
  useEffect(() => {
    if (!session) return;
    supabase.from("receivables")
      .update({ status: "atrasado" })
      .lt("vencimento", todayISO())
      .eq("status", "pendente")
      .then(() => {});
  }, [session]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <AppShell>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="faturar" element={<Faturar />} />
        <Route path="faturamentos" element={<Faturamentos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="previsao" element={<Previsao />} />
        <Route path="meta" element={<Meta />} />
        <Route path="funcionarios" element={<Funcionarios />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="custos" element={<Custos />} />
      </Routes>
    </AppShell>
  );
};

export default Index;
