import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { TrendingUp, Wallet, Clock, Target, Sparkles } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Input } from "@/components/ui/input";

type Row = {
  id: string; vencimento: string; valor: number; status: string;
  invoices: { numero: string } | null;
  clients: { nome: string } | null;
};

// Business days helper (Mon-Fri) within a month, optionally up to a date.
function businessDaysInMonth(year: number, month0: number, untilDay?: number) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const stop = untilDay ?? last;
  let count = 0;
  for (let d = 1; d <= stop; d++) {
    const wd = new Date(year, month0, d).getDay();
    if (wd >= 1 && wd <= 5) count++;
  }
  return count;
}

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

  // Faturamento acumulado do mês
  const faturadoMes = invoices.reduce((s, i) => s + Number(i.valor), 0);
  // Faturado HOJE
  const faturadoHoje = invoices.filter(i => i.data_faturamento === today).reduce((s, i) => s + Number(i.valor), 0);

  // Meta diária
  const now = new Date();
  const totalDU = meta?.dias_uteis || businessDaysInMonth(now.getFullYear(), now.getMonth());
  const metaMes = Number(meta?.valor_meta || 0);
  const metaDiaria = totalDU > 0 ? metaMes / totalDU : 0;
  const duAteHoje = businessDaysInMonth(now.getFullYear(), now.getMonth(), now.getDate());
  const duRestantes = Math.max(totalDU - duAteHoje, 0);
  const esperadoAteHoje = metaDiaria * duAteHoje;
  const diferenca = faturadoMes - esperadoAteHoje;
  const restanteMeta = Math.max(metaMes - faturadoMes, 0);
  const metaDiariaRevisada = duRestantes > 0 ? restanteMeta / duRestantes : 0;
  const pctMes = metaMes > 0 ? (faturadoMes / metaMes) * 100 : 0;
  const pctDia = metaDiaria > 0 ? (faturadoHoje / metaDiaria) * 100 : 0;

  // Daily chart (with ref line for daily goal)
  const dailyMap = new Map<string, number>();
  invoices.forEach(i => dailyMap.set(i.data_faturamento, (dailyMap.get(i.data_faturamento) || 0) + Number(i.valor)));
  const chartData = Array.from(dailyMap.entries()).sort().map(([d, v]) => ({ dia: d.slice(8), valor: v }));

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
        <p className="text-muted-foreground text-sm">Acompanhe a meta diária e seu faturamento em tempo real</p>
      </header>

      {/* META DIÁRIA - hero card */}
      {metaMes > 0 ? (
        <Card className="p-6 shadow-elevated overflow-hidden relative gradient-primary text-primary-foreground">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider opacity-90">
              <Target className="w-4 h-4" /> Meta de hoje
            </div>
            <div className="flex items-end justify-between mt-2 flex-wrap gap-3">
              <div>
                <div className="text-4xl md:text-5xl font-bold tracking-tight">{brl(faturadoHoje)}</div>
                <div className="text-sm opacity-90 mt-1">de <strong>{brl(metaDiaria)}</strong> previstos hoje</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{pctDia.toFixed(0)}%</div>
                <div className="text-xs opacity-80">do dia</div>
              </div>
            </div>
            <div className="w-full bg-primary-foreground/20 rounded-full h-3 overflow-hidden mt-4">
              <div className="h-full bg-primary-foreground transition-all" style={{ width: `${Math.min(pctDia, 100)}%` }} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-xs">
              <Mini label="Faturado no mês" value={brl(faturadoMes)} />
              <Mini label={`Esperado até hoje (${duAteHoje} DU)`} value={brl(esperadoAteHoje)} />
              <Mini label={diferenca >= 0 ? "Acima da meta" : "Abaixo da meta"} value={brl(Math.abs(diferenca))} highlight={diferenca >= 0 ? "good" : "bad"} />
              <Mini label={`Falta p/ meta (${duRestantes} DU)`} value={brl(metaDiariaRevisada) + "/dia"} />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 shadow-card border-dashed">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="w-5 h-5 text-primary" />
            Defina sua meta mensal em <a href="/meta" className="text-primary font-medium underline">Meta</a> para acompanhar a meta diária.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KCard icon={Sparkles} label="Faturado no mês" value={brl(faturadoMes)} tone="accent" />
        <KCard icon={Wallet} label="Total a receber" value={brl(totalReceber)} tone="primary" />
        <KCard icon={TrendingUp} label="Recebido no mês" value={brl(recebidoMes)} tone="success" />
        <KCard icon={Clock} label="A vencer (7d)" value={brl(aVencer)} tone="warning" />
      </div>

      {/* Meta mensal compacta */}
      {metaMes > 0 && (
        <Card className="p-5 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Meta mensal</div>
              <div className="text-xl font-bold">{brl(faturadoMes)} <span className="text-sm font-normal text-muted-foreground">/ {brl(metaMes)}</span></div>
            </div>
            <div className="text-2xl font-bold text-primary">{pctMes.toFixed(0)}%</div>
          </div>
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div className="h-full gradient-primary transition-all" style={{ width: `${Math.min(pctMes, 100)}%` }} />
          </div>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-3">Faturamento diário do mês</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                {metaDiaria > 0 && (
                  <ReferenceLine y={metaDiaria} stroke="hsl(var(--accent))" strokeDasharray="4 4" label={{ value: "Meta diária", fill: "hsl(var(--accent))", fontSize: 11, position: "right" }} />
                )}
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

function Mini({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
  return (
    <div className="bg-primary-foreground/10 rounded-lg p-3 backdrop-blur">
      <div className="opacity-80">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${highlight === "good" ? "" : ""}`}>
        {highlight === "good" && "▲ "}{highlight === "bad" && "▼ "}{value}
      </div>
    </div>
  );
}

function KCard({ icon: Icon, label, value, tone }: any) {
  const toneClass: any = {
    primary: "text-primary bg-primary/10",
    accent: "text-accent-foreground gradient-gold",
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
