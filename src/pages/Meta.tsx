import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Plus, Trash2, CalendarDays } from "lucide-react";
import {
  DEFAULT_WEEKDAYS,
  WEEKDAY_LABELS,
  businessDaysInMonth,
} from "@/lib/calendar";

type Holiday = { id: string; data: string; descricao: string | null };

export default function Meta() {
  const today = new Date();
  const monthISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const [meta, setMeta] = useState<any>(null);
  const [valor, setValor] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>(DEFAULT_WEEKDAYS);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [novoFeriado, setNovoFeriado] = useState({ data: "", descricao: "" });
  const [diasUteisManual, setDiasUteisManual] = useState<number | null>(null);
  const [faturado, setFaturado] = useState(0);

  const holidaySet = new Set(holidays.map(h => h.data));
  const diasUteisCalc = businessDaysInMonth(today.getFullYear(), today.getMonth(), undefined, weekdays, holidaySet);
  const diasUteis = diasUteisManual ?? diasUteisCalc;

  const load = async () => {
    const [g, inv, ws, hol] = await Promise.all([
      supabase.from("goals").select("*").eq("mes", monthISO).maybeSingle(),
      supabase.from("invoices").select("valor").gte("data_faturamento", monthISO),
      supabase.from("work_settings").select("weekdays").maybeSingle(),
      supabase.from("holidays").select("id, data, descricao").order("data"),
    ]);
    if (g.data) { setMeta(g.data); setValor(String(g.data.valor_meta)); setDiasUteisManual(g.data.dias_uteis); }
    setFaturado((inv.data || []).reduce((s, i) => s + Number(i.valor), 0));
    if (ws.data?.weekdays) setWeekdays(ws.data.weekdays);
    setHolidays((hol.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { user_id: user.id, mes: monthISO, valor_meta: parseFloat(valor.replace(",", ".")), dias_uteis: diasUteis };
    const { error } = await supabase.from("goals").upsert(payload, { onConflict: "user_id,mes" });
    if (error) return toast.error(error.message);
    toast.success("Meta salva!");
    load();
  };

  const toggleWeekday = async (dow: number) => {
    const next = weekdays.includes(dow) ? weekdays.filter(d => d !== dow) : [...weekdays, dow].sort();
    setWeekdays(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("work_settings").upsert(
      { user_id: user.id, weekdays: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) toast.error(error.message);
    else toast.success("Dias úteis atualizados");
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoFeriado.data) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("holidays").insert({
      user_id: user.id,
      data: novoFeriado.data,
      descricao: novoFeriado.descricao || null,
    });
    if (error) return toast.error(error.message);
    setNovoFeriado({ data: "", descricao: "" });
    toast.success("Feriado adicionado");
    load();
  };

  const removeHoliday = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Feriado removido");
    load();
  };

  const valorMeta = meta ? Number(meta.valor_meta) : 0;
  const metaDiaria = diasUteis ? valorMeta / diasUteis : 0;
  const elapsed = businessDaysInMonth(today.getFullYear(), today.getMonth(), today.getDate(), weekdays, holidaySet);
  const metaEsperada = metaDiaria * elapsed;
  const diff = faturado - metaEsperada;
  const pct = valorMeta ? (faturado / valorMeta) * 100 : 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold">Meta de Faturamento</h1>
        <p className="text-muted-foreground text-sm">Acompanhe o desempenho do mês</p>
      </header>

      <Card className="p-6 shadow-card">
        <form onSubmit={save} className="grid grid-cols-2 gap-3 items-end">
          <div className="col-span-2 sm:col-span-1">
            <Label>Meta do mês (R$)</Label>
            <Input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label>Dias úteis ({diasUteisCalc} calculados)</Label>
            <Input type="number" value={diasUteis} onChange={e => setDiasUteisManual(+e.target.value)} required />
          </div>
          <Button type="submit" className="col-span-2" size="lg">Salvar Meta</Button>
        </form>
      </Card>

      {/* Calendário de trabalho */}
      <Card className="p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Calendário de Trabalho</h2>
        </div>

        <div>
          <Label className="text-sm">Dias da semana considerados úteis</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {WEEKDAY_LABELS.map((label, i) => {
              const active = weekdays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="text-sm">Feriados / Folgas</Label>
          <form onSubmit={addHoliday} className="grid grid-cols-[auto_1fr_auto] gap-2 mt-2">
            <Input
              type="date"
              value={novoFeriado.data}
              onChange={e => setNovoFeriado(f => ({ ...f, data: e.target.value }))}
              required
            />
            <Input
              placeholder="Descrição (opcional)"
              value={novoFeriado.descricao}
              onChange={e => setNovoFeriado(f => ({ ...f, descricao: e.target.value }))}
            />
            <Button type="submit" size="icon" variant="secondary"><Plus className="w-4 h-4" /></Button>
          </form>

          {holidays.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-60 overflow-auto">
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-3 py-1.5">
                  <div>
                    <span className="font-medium">{fmtDate(h.data)}</span>
                    {h.descricao && <span className="text-muted-foreground ml-2">— {h.descricao}</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeHoliday(h.id)} className="h-7 w-7">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {meta && (
        <>
          <Card className="p-6 shadow-card text-center gradient-primary text-primary-foreground">
            <div className="text-sm opacity-80">Faturado / Meta</div>
            <div className="text-4xl font-bold mt-2">{pct.toFixed(1)}%</div>
            <div className="text-sm opacity-80 mt-1">{brl(faturado)} de {brl(valorMeta)}</div>
            <div className="w-full bg-primary-foreground/20 rounded-full h-2 mt-4 overflow-hidden">
              <div className="h-full bg-primary-foreground transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 shadow-card">
              <div className="text-xs text-muted-foreground">Meta diária</div>
              <div className="text-xl font-bold">{brl(metaDiaria)}</div>
            </Card>
            <Card className="p-4 shadow-card">
              <div className="text-xs text-muted-foreground">Esperado até hoje ({elapsed} d.u.)</div>
              <div className="text-xl font-bold">{brl(metaEsperada)}</div>
            </Card>
            <Card className={`p-4 shadow-card col-span-2 ${diff >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <div className="flex items-center gap-2">
                {diff >= 0 ? <TrendingUp className="text-success" /> : <TrendingDown className="text-destructive" />}
                <div>
                  <div className="text-xs text-muted-foreground">Diferença</div>
                  <div className={`text-2xl font-bold ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                    {diff >= 0 ? "+" : ""}{brl(diff)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
