import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { Target, TrendingUp, AlertCircle, BarChart3, Cake, DollarSign, Users, ArrowRight, Check } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from "recharts";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [, m, d] = iso.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

const MES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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

  const marcarPago = async (id: string) => {
    if (!confirm("Confirmar o recebimento deste valor?")) return;
    const { error } = await supabase.from("receivables").update({ status: "pago", pago_em: todayISO() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Recebimento confirmado");
    load();
  };

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

  const dailyMap = new Map<string, number>();
  invoices.forEach(i => dailyMap.set(i.data_faturamento, (dailyMap.get(i.data_faturamento) || 0) + Number(i.valor)));
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const chartData = Array.from({ length: lastDay }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const iso = `${monthStart.slice(0, 8)}${day}`;
    return { dia: day, valor: dailyMap.get(iso) || 0, isToday: iso === today, isFuture: iso > today };
  });

  const proximos = rows.filter(r => r.status !== "pago").slice(0, 5);

  const topClientes = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(i => map.set(i.client_id, (map.get(i.client_id) || 0) + Number(i.valor)));
    const nameById = new Map(clients.map(c => [c.id, c.nome]));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, total]) => ({ id, nome: nameById.get(id) || "—", total }));
  }, [invoices, clients]);

  const aniversarios = useMemo(() => {
    return employees
      .filter(e => e.data_nascimento)
      .map(e => ({ ...e, dias: daysUntilBirthday(e.data_nascimento!) }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 4);
  }, [employees]);

  return (
    <div className="space-y-4 pb-10">
      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* META DO DIA */}
        <Card className="p-3 glass shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden relative">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-success font-bold relative z-10">
            <span className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center transition-transform group-hover:rotate-6"><Target className="w-3.5 h-3.5" /></span>
            Meta do Dia
          </div>
          <div className="flex items-center justify-between mt-3 gap-3 relative z-10">
            <div className="min-w-0">
              <div className="text-xl font-black tracking-tighter truncate">{brl(metaDiaria)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Meta Diária</div>
              <div className="text-lg font-bold mt-1.5 truncate text-success">{brl(faturadoHoje)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Faturado Hoje</div>
            </div>
            <RingProgress value={pctDia} color="hsl(var(--success))" />
          </div>
          <Progress value={pctDia} color="bg-success" className="mt-3 h-1.5" />
          {metaDiaria > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1.5 relative z-10">
              {faltaMeta > 0 ? (
                <>Faltam <span className="text-success font-bold px-1 py-0.5 bg-success/5 rounded">{brl(faltaMeta)}</span></>
              ) : (
                <span className="text-success font-bold flex items-center gap-1">Meta atingida! 🚀</span>
              )}
            </p>
          )}
        </Card>

        {/* ACUMULADO DO MÊS */}
        <Card className="p-3 glass shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden relative">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-bold relative z-10">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center transition-transform group-hover:rotate-6"><TrendingUp className="w-3.5 h-3.5" /></span>
            Acumulado do Mês
          </div>
          <div className="mt-3 space-y-2 relative z-10">
            <div>
              <div className="text-xl font-black tracking-tighter truncate">{brl(faturadoMes)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Total Faturado</div>
            </div>
            <div>
              <div className="text-base font-bold tracking-tight truncate text-foreground/80">{brl(metaMes)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Meta Mensal</div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 relative z-10">
            <Progress value={pctMes} color="bg-primary" className="h-1.5" />
            <span className="text-[10px] font-black text-primary w-8 text-right">{pctMes.toFixed(0)}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 font-medium relative z-10">
            {metaMes > 0 ? (
              <>Faltam <span className="text-primary font-bold px-1 py-0.5 bg-primary/5 rounded">{brl(faltaMetaMes)}</span></>
            ) : (
              <Link to="/meta" className="text-primary underline hover:text-primary/80 transition-colors">Definir meta</Link>
            )}
          </p>
        </Card>

        {/* RECEBIMENTOS */}
        <Card className="p-3 glass shadow-card hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden relative">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-warning font-bold">
              <span className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center transition-transform group-hover:rotate-6"><DollarSign className="w-3.5 h-3.5" /></span>
              Fluxo de Caixa
            </div>
            <Link to="/financeiro" className="text-[10px] text-primary font-bold uppercase tracking-widest hover:underline transition-all">Detalhes</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 relative z-10">
            <div>
              <div className="text-lg font-black tracking-tighter truncate text-warning">{brl(recebidoMes)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Recebido</div>
            </div>
            <div>
              <div className="text-lg font-black tracking-tighter truncate">{brl(totalReceber)}</div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">A Receber</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between relative z-10">
            <div>
              <div className="text-lg font-black tracking-tighter text-destructive leading-none">{brl(totalAtrasado)}</div>
              <div className="text-[9px] text-destructive/80 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> Em Atraso ({atrasados.length})
              </div>
            </div>
            {aVencer7.length > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-warning font-bold uppercase bg-warning/5 rounded-md px-1.5 py-0.5 leading-tight border border-warning/10">
                {aVencer7.length} Urgentes
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* MIDDLE ROW: Chart + Aniversários */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="p-3 glass shadow-card xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><BarChart3 className="w-3.5 h-3.5" /></span>
              <h3 className="font-bold uppercase text-[10px] tracking-widest text-foreground/70">Faturamento Diário</h3>
            </div>
            <div className="flex items-center gap-2.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              <LegendDot color="hsl(var(--success))" label="Faturado" />
              <LegendDot color="hsl(var(--primary))" label="Hoje" />
              <span className="flex items-center gap-1.5"><span className="w-3 h-px border-t border-dashed border-muted-foreground" /> Meta</span>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={1} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                {metaDiaria > 0 && <ReferenceLine y={metaDiaria} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />}
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? "hsl(var(--primary))" : d.isFuture ? "hsl(var(--muted))" : "hsl(var(--success))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3 glass shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent-foreground"><Cake className="w-3.5 h-3.5" /></span>
              <h3 className="font-bold uppercase text-[10px] tracking-widest text-foreground/70">Aniversários</h3>
            </div>
            <Link to="/funcionarios" className="text-[10px] text-primary font-bold uppercase tracking-widest hover:underline flex items-center gap-1">
              Ver <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {aniversarios.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Sem cadastro.</p>
          ) : (
            <ul className="space-y-2">
              {aniversarios.map(a => {
                const [, m, d] = a.data_nascimento!.split("-");
                return (
                  <li key={a.id} className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center text-accent-foreground font-bold text-[10px] shrink-0">
                      {d}/{m}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate">{a.nome}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{a.cargo || "—"}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{a.dias === 0 ? "Hoje 🎂" : a.dias === 1 ? "Amanhã" : `${a.dias}d`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* BOTTOM: Próximos recebimentos + Top clientes */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        <Card className="p-3 shadow-card xl:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center text-success"><DollarSign className="w-3 h-3" /></span>
              <h3 className="font-semibold uppercase text-[10px] tracking-wider">Próximos Recebimentos</h3>
            </div>
            <Link to="/financeiro" className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-0.5">
              Ver todos <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
          {proximos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum recebimento pendente.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground uppercase">
                    <th className="text-left font-medium py-1.5 px-1">Cliente</th>
                    <th className="text-left font-medium py-1.5 px-1">Nota</th>
                    <th className="text-left font-medium py-1.5 px-1">Vencimento</th>
                    <th className="text-right font-medium py-1.5 px-1">Valor</th>
                    <th className="text-center font-medium py-1.5 px-1">Status</th>
                    <th className="text-right font-medium py-1.5 px-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {proximos.map(r => {
                    const dias = Math.round((new Date(r.vencimento).getTime() - new Date(today).getTime()) / 86400000);
                    const atrasado = dias < 0;
                    return (
                      <tr key={r.id} className="border-t border-border/60">
                        <td className="py-1.5 px-1 font-medium truncate max-w-[140px]">{r.clients?.nome}</td>
                        <td className="py-1.5 px-1 text-muted-foreground">{r.invoices?.numero}</td>
                        <td className="py-1.5 px-1 text-muted-foreground whitespace-nowrap">{fmtDate(r.vencimento)}</td>
                        <td className="py-1.5 px-1 text-right font-semibold whitespace-nowrap">{brl(Number(r.valor))}</td>
                        <td className="py-1.5 px-1 text-center">
                          {atrasado ? <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 text-[10px] px-1.5">Atrasado</Badge>
                            : <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/20 text-[10px] px-1.5">A Vencer</Badge>}
                        </td>
                        <td className="py-1.5 px-1 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-success hover:text-success hover:bg-success/10" onClick={() => marcarPago(r.id)} title="Marcar como recebido">
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-3 shadow-card">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Users className="w-3 h-3" /></span>
              <h3 className="font-semibold uppercase text-[10px] tracking-wider">Top Clientes</h3>
            </div>
            <Link to="/clientes" className="text-[10px] text-primary font-semibold hover:underline flex items-center gap-0.5">
              Ver <ArrowRight className="w-2.5 h-2.5" />
            </Link>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem faturamento.</p>
          ) : (
            <ul className="space-y-2">
              {topClientes.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "gradient-gold text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0 font-medium text-xs truncate">{c.nome}</div>
                  <div className="font-semibold text-xs whitespace-nowrap">{brl(c.total)}</div>
                </li>
              ))}
            </ul>
          )}
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
  const r = 22, c = 2 * Math.PI * r;
  const offset = c - (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} stroke="hsl(var(--secondary))" strokeWidth="5" fill="none" />
        <circle cx="28" cy="28" r={r} stroke={color} strokeWidth="5" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className="transition-all" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">{value.toFixed(0)}%</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
