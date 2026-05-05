import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Previsao() {
  const [data, setData] = useState<{ vencimento: string; valor: number; clients: any }[]>([]);

  useEffect(() => {
    supabase.from("receivables")
      .select("vencimento, valor, clients(nome)")
      .neq("status", "pago")
      .gte("vencimento", todayISO())
      .order("vencimento")
      .then(({ data }) => setData((data as any) || []));
  }, []);

  const byDate = new Map<string, number>();
  data.forEach(d => byDate.set(d.vencimento, (byDate.get(d.vencimento) || 0) + Number(d.valor)));
  const chart = Array.from(byDate.entries()).map(([d, v]) => ({ data: d.slice(5), valor: v }));
  const total = data.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Previsão de Caixa</h1>
        <p className="text-muted-foreground text-sm">Entradas previstas — total: <span className="font-semibold text-primary">{brl(total)}</span></p>
      </header>

      {chart.length > 0 && (
        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-3">Recebimentos futuros</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-4 shadow-card">
        <h3 className="font-semibold mb-3">Por data</h3>
        {byDate.size === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Sem entradas previstas.</p>}
        <div className="space-y-2">
          {Array.from(byDate.entries()).map(([date, v]) => (
            <div key={date} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <span className="font-medium">{fmtDate(date)}</span>
              <span className="font-bold text-primary">{brl(v)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
