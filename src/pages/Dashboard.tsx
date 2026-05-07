import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { Target, TrendingUp, Wallet, AlertCircle, BarChart3, Cake, DollarSign, Users, ArrowRight } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from "recharts";
import { Link } from "react-router-dom";

type Row = {
  id: string; vencimento: string; valor: number; status: string;
  invoices: { numero: string } | null;
  clients: { id: string; nome: string } | null;
};

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

function daysUntilBirthday(iso: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const [, m, d] = iso.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

const MES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<{ data_faturamento: string; valor: number; client_id: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; nome: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; nome: string; data_nascimento: string | null; cargo: string | null }[]>([]);
  const [meta, setMeta] = useState<{ valor_meta: number; dias_uteis: number } | null>(null);

  const load = async () => {
    const monthStart = todayISO().slice(0, 7) + "-01";
    const [rec, inv, g, cli, emp] = await Promise.all([
      supabase.from("receivables").select("id, vencimento, valor, status, invoices(numero), clients(id, nome)").order("vencimento", { ascending: true }),
      supabase.from("invoices").select("data_faturamento, valor, client_id").gte("data_faturamento", monthStart),
      supabase.from("goals").select("valor_meta, dias_uteis").eq("mes", monthStart).maybeSingle(),
      supabase.from("clients").select("id, nome"),
      supabase.from("employees").select("id, nome, data_nascimento, cargo").eq("status", "ativo"),
    ]);
    setRows((rec.data as any) || []);
    setInvoices(inv.data || []);
    setMeta(g.data as any);
    setClients(cli.data || []);
    setEmployees(emp.data || []);
  };
  useEffect(() => { load(); }, []);

  const today = todayISO();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7iso = in7.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const totalReceber = rows.filter(r => r.status !== "pago").reduce((s, r) => s + Number(r.valor), 0);
  const recebidoMes = rows.filter(r => r.status === "pago" && r.vencimento >= monthStart).reduce((s, r) => s + Number(r.valor), 0);
  const aVencer7 = rows.filter(r => r.status === "pendente" && r.vencimento >= today && r.vencimento <= in7iso);
  const atrasados = rows.filter(r => r.status !== "pago" && r.vencimento < today);
  const totalAtrasado = atrasados.reduce((s, r) => s + Number(r.valor), 0);

  const faturadoMes = invoices.reduce((s, i) => s + Number(i.valor), 0);
  const faturadoHoje = invoices.filter(i => i.data_faturamento === today).reduce((s, i) => s + Number(i.valor), 0);

  const now = new Date();
  const totalDU = meta?.dias_uteis || businessDaysInMonth(now.getFullYear(), now.getMonth());
  const metaMes = Number(meta?.valor_meta || 0);
  const metaDiaria = totalDU > 0 ? metaMes / totalDU : 0;
  const faltaMeta = Math.max(metaDiaria - faturadoHoje, 0);
  const faltaMetaMes = Math.max(metaMes - faturadoMes, 0);
  const pctMes = metaMes > 0 ? Math.min((faturadoMes / metaMes) * 100, 100) : 0;
  const pctDia = metaDiaria > 0 ? Math.min((faturadoHoje / metaDiaria) * 100, 100) : 0;

  // Daily chart
  const dailyMap = new Map<string, number>();
  invoices.forEach(i => dailyMap.set(i.data_faturamento, (dailyMap.get(i.data_faturamento) || 0) + Number(i.valor)));
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const chartData = Array.from({ length: lastDay }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const iso = `${monthStart.slice(0,8)}${day}`;
    return { dia: day, valor: dailyMap.get(iso) || 0, isToday: iso === today, isFuture: iso > today };
  });

  // Próximos recebimentos (next 5 not paid)
  const proximos = rows.filter(r => r.status !== "pago").slice(0, 5);

  // Top clientes do mês (by invoices)
  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(i => map.set(i.client_id, (map.get(i.client_id) || 0) + Number(i.valor)));
    const nameById = new Map(clients.map(c => [c.id, c.nome]));
    return Array.from(map.entries())
      .sort((a,b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total]) => ({ id, nome: nameById.get(id) || "—", total }));
  }, [invoices, clients]);

  // Aniversários próximos
  const aniversarios = useMemo(() => {
    return employees
      .filter(e => e.data_nascimento)
      .map(e => ({ ...e, dias: daysUntilBirthday(e.data_nascimento!) }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5);
  }, [employees]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">Acompanhamento de meta e faturamento em tempo real</p>
      </header>

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* META DO DIA */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success font-semibold">
            <span className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center"><Target className="w-3.5 h-3.5" /></span>
            Meta do Dia
          </div>
          <div className="flex items-end justify-between mt-3 gap-3">
            <div>
              <div className="text-xl font-bold leading-tight">{brl(metaDiaria)}</div>
              <div className="text-xs text-muted-foreground">Meta diária</div>
              <div className="text-lg font-bold mt-1">{brl(faturadoHoje)}</div>
              <div className="text-xs text-muted-foreground">Faturado hoje</div>
            </div>
            <RingProgress value={pctDia} color="hsl(var(--success))" />
          </div>
          <Progress value={pctDia} color="bg-success" className="mt-3" />
          {metaDiaria > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {faltaMeta > 0 ? <>Faltam <span className="text-success font-semibold">{brl(faltaMeta)}</span> para atingir a meta</> : <span className="text-success font-semibold">Meta diária atingida! 🎉</span>}
            </p>
          )}
        </Card>

        {/* ACUMULADO DO MÊS */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-semibold">
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5" /></span>
            Acumulado do Mês
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="text-xl font-bold">{brl(faturadoMes)}</div>
              <div className="text-xs text-muted-foreground">Faturado</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{brl(metaMes)}</div>
              <div className="text-xs text-muted-foreground">Meta do mês</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Progress value={pctMes} color="bg-primary" />
            <span className="text-xs font-semibold text-primary w-10 text-right">{pctMes.toFixed(0)}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metaMes > 0 ? <>Faltam <span className="text-primary font-semibold">{brl(faltaMetaMes)}</span> para atingir a meta</> : <Link to="/meta" className="text-primary underline">Definir meta mensal</Link>}
          </p>
        </Card>

        {/* RECEBIMENTOS */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning font-semibold">
            <span className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5" /></span>
            Recebimentos
          </div>
          <div className="flex items-end justify-between mt-3">
            <div>
              <div className="text-xl font-bold">{brl(recebidoMes)}</div>
              <div className="text-xs text-muted-foreground">Recebido no mês</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold">{brl(totalReceber)}</div>
              <div className="text-xs text-muted-foreground">A receber</div>
            </div>
          </div>
          {aVencer7.length > 0 && (
            <div className="flex items-center gap-1.5 mt-4 text-xs text-warning bg-warning/10 rounded-md px-2 py-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {aVencer7.length} {aVencer7.length === 1 ? "título vencendo" : "títulos vencendo"} nos próximos 7 dias
            </div>
          )}
        </Card>

        {/* EM ATRASO */}
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-destructive font-semibold">
            <span className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5" /></span>
            Em Atraso
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-destructive">{brl(totalAtrasado)}</div>
            <div className="text-xs text-muted-foreground mt-1">{atrasados.length} {atrasados.length === 1 ? "título em atraso" : "títulos em atraso"}</div>
          </div>
          <Link to="/dashboard" className="mt-4 inline-flex items-center justify-center w-full text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/15 rounded-md py-2 transition-colors">
            Ver detalhes
          </Link>
        </Card>
      </div>

      {/* MIDDLE ROW: Chart + Aniversários */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 shadow-card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary"><BarChart3 className="w-3.5 h-3.5" /></span>
              <h3 className="font-semibold uppercase text-xs tracking-wider">Faturamento Diário</h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">{MES_PT[now.getMonth()]}/{now.getFullYear()}</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                {metaDiaria > 0 && (
                  <ReferenceLine y={metaDiaria} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                )}
                <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? "hsl(var(--primary))" : d.isFuture ? "hsl(var(--muted))" : "hsl(var(--success))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <LegendDot color="hsl(var(--success))" label="Faturado" />
            <LegendDot color="hsl(var(--primary))" label="Hoje" />
            <span className="flex items-center gap-1.5"><span className="w-4 h-px border-t border-dashed border-muted-foreground" /> Meta diária</span>
          </div>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-accent-foreground"><Cake className="w-3.5 h-3.5" /></span>
            <h3 className="font-semibold uppercase text-xs tracking-wider">Próximos Aniversários</h3>
          </div>
          {aniversarios.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum funcionário cadastrado.</p>
          ) : (
            <ul className="space-y-3">
              {aniversarios.map(a => {
                const [, m, d] = a.data_nascimento!.split("-");
                return (
                  <li key={a.id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-accent-foreground font-bold text-xs shrink-0">
                      {d}/{m}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{a.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.cargo || "—"}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{a.dias === 0 ? "Hoje 🎂" : a.dias === 1 ? "Amanhã" : `${a.dias}d`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to="/funcionarios" className="mt-4 flex items-center justify-center gap-1 text-xs text-primary font-semibold hover:underline">
            Ver funcionários <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
      </div>

      {/* BOTTOM: Próximos recebimentos + Top clientes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="p-5 shadow-card xl:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center text-success"><DollarSign className="w-3.5 h-3.5" /></span>
            <h3 className="font-semibold uppercase text-xs tracking-wider">Próximos Recebimentos</h3>
          </div>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum recebimento pendente.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground uppercase">
                    <th className="text-left font-medium py-2 px-1">Cliente</th>
                    <th className="text-left font-medium py-2 px-1">Nota</th>
                    <th className="text-left font-medium py-2 px-1">Vencimento</th>
                    <th className="text-right font-medium py-2 px-1">Valor</th>
                    <th className="text-center font-medium py-2 px-1">Dias</th>
                    <th className="text-right font-medium py-2 px-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proximos.map(r => {
                    const dias = Math.round((new Date(r.vencimento).getTime() - new Date(today).getTime()) / 86400000);
                    const atrasado = dias < 0;
                    return (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-2.5 px-1 font-medium">{r.clients?.nome}</td>
                        <td className="py-2.5 px-1 text-muted-foreground">{r.invoices?.numero}</td>
                        <td className="py-2.5 px-1 text-muted-foreground">{fmtDate(r.vencimento)}</td>
                        <td className="py-2.5 px-1 text-right font-semibold">{brl(Number(r.valor))}</td>
                        <td className={`py-2.5 px-1 text-center text-xs font-medium ${atrasado ? "text-destructive" : "text-muted-foreground"}`}>{dias}</td>
                        <td className="py-2.5 px-1 text-right">
                          {atrasado ? <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20">Atrasado</Badge>
                            : <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/20">A Vencer</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Link to="/dashboard" className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
            Ver todas contas a receber <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>

        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Users className="w-3.5 h-3.5" /></span>
            <h3 className="font-semibold uppercase text-xs tracking-wider">Top Clientes (Mês)</h3>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem faturamento no mês.</p>
          ) : (
            <ul className="space-y-3">
              {topClientes.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "gradient-gold text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0 font-medium text-sm truncate">{c.nome}</div>
                  <div className="font-semibold text-sm">{brl(c.total)}</div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/clientes" className="mt-4 flex items-center justify-center gap-1 text-xs text-primary font-semibold hover:underline">
            Ver ranking completo <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Progress({ value, color = "bg-primary", className = "" }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`flex-1 bg-secondary rounded-full h-1.5 overflow-hidden ${className}`}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function RingProgress({ value, color }: { value: number; color: string }) {
  const r = 26, c = 2 * Math.PI * r;
  const offset = c - (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} stroke="hsl(var(--secondary))" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="6" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{value.toFixed(0)}%</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
