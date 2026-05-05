import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { TrendingUp, Wallet, Clock, AlertCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Input } from "@/components/ui/input";

type Row = {
  id: string; vencimento: string; valor: number; status: string;
  invoices: { numero: string } | null;
  clients: { nome: string } | null;
};

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<{ data_faturamento: string; valor: number }[]>([]);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState<{ valor_meta: number; dias_uteis: number } | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("receivables")
      .select("id, vencimento, valor, status, invoices(numero), clients(nome)")
      .order("vencimento", { ascending: true });
    setRows((data as any) || []);

    const monthStart = todayISO().slice(0, 7) + "-01";
    const { data: inv } = await supabase.from("invoices")
      .select("data_faturamento, valor")
      .gte("data_faturamento", monthStart);
    setInvoices(inv || []);

    const { data: g } = await supabase.from("goals").select("valor_meta, dias_uteis").eq("mes", monthStart).maybeSingle();
    setMeta(g as any);
  };
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7iso = in7.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const totalReceber = rows.filter(r => r.status !== "pago").reduce((s, r) => s + Number(r.valor), 0);
  const recebidoMes = rows.filter(r => r.status === "pago" && r.vencimento >= monthStart).reduce((s, r) => s + Number(r.valor), 0);
  const aVencer = rows.filter(r => r.status === "pendente" && r.vencimento >= today && r.vencimento <= in7iso).reduce((s, r) => s + Number(r.valor), 0);
  const atrasado = rows.filter(r => r.status === "atrasado" || (r.status === "pendente" && r.vencimento < today)).reduce((s, r) => s + Number(r.valor), 0);

  // chart: faturamento diário do mês
  const dailyMap = new Map<string, number>();
  invoices.forEach(i => dailyMap.set(i.data_faturamento, (dailyMap.get(i.data_faturamento) || 0) + Number(i.valor)));
  const chartData = Array.from(dailyMap.entries()).sort().map(([d, v]) => ({ dia: d.slice(8), valor: v }));

  // group by date
  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || r.clients?.nome.toLowerCase().includes(q) || r.invoices?.numero.toLowerCase().includes(q);
  });
  const byDate = new Map<string, Row[]>();
  filtered.forEach(r => {
    const arr = byDate.get(r.vencimento) || [];
    arr.push(r);
    byDate.set(r.vencimento, arr);
  });

  const statusBadge = (s: string, venc: string) => {
    if (s === "pago") return <Badge className="bg-success text-success-foreground">Pago</Badge>;
    if (s === "atrasado" || venc < today) return <Badge className="bg-destructive text-destructive-foreground">Atrasado</Badge>;
    return <Badge className="bg-warning text-warning-foreground">A vencer</Badge>;
  };

  const togglePago = async (id: string, current: string) => {
    const novo = current === "pago" ? "pendente" : "pago";
    await supabase.from("receivables").update({ status: novo, pago_em: novo === "pago" ? today : null }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">Acompanhe seus recebimentos em tempo real</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KCard icon={Wallet} label="Total a receber" value={brl(totalReceber)} tone="primary" />
        <KCard icon={TrendingUp} label="Recebido no mês" value={brl(recebidoMes)} tone="success" />
        <KCard icon={Clock} label="A vencer (7d)" value={brl(aVencer)} tone="warning" />
        <KCard icon={AlertCircle} label="Atrasado" value={brl(atrasado)} tone="destructive" />
      </div>

      {meta && meta.valor_meta > 0 && (() => {
        const faturado = invoices.reduce((s, i) => s + Number(i.valor), 0);
        const pct = (faturado / Number(meta.valor_meta)) * 100;
        return (
          <Card className="p-5 shadow-card gradient-primary text-primary-foreground">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-xs opacity-80">Meta de faturamento</div>
                <div className="text-2xl font-bold">{brl(faturado)} <span className="text-sm opacity-80">/ {brl(Number(meta.valor_meta))}</span></div>
              </div>
              <div className="text-3xl font-bold">{pct.toFixed(0)}%</div>
            </div>
            <div className="w-full bg-primary-foreground/20 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-primary-foreground transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </Card>
        );
      })()}

      {chartData.length > 0 && (
        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-3">Faturamento diário do mês</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-semibold">Contas a receber</h3>
          <Input placeholder="Buscar cliente ou nota..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>
        {byDate.size === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum recebimento registrado.</p>}
        <div className="space-y-4">
          {Array.from(byDate.entries()).map(([date, items]) => {
            const total = items.reduce((s, r) => s + Number(r.valor), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">{fmtDate(date)}</span>
                  <span className="text-xs font-bold text-primary">{brl(total)}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(r => (
                    <button key={r.id} onClick={() => togglePago(r.id, r.status)}
                      className="w-full flex items-center justify-between p-3 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors text-left">
                      <div>
                        <div className="font-medium text-sm">{r.clients?.nome}</div>
                        <div className="text-xs text-muted-foreground">NF {r.invoices?.numero}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{brl(Number(r.valor))}</span>
                        {statusBadge(r.status, r.vencimento)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function KCard({ icon: Icon, label, value, tone }: any) {
  const toneClass: any = {
    primary: "text-primary bg-accent",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4 shadow-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${toneClass[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </Card>
  );
}
