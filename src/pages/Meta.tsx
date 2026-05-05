import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";

function businessDaysInMonth(year: number, month: number) {
  const last = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
function businessDaysElapsed(year: number, month: number) {
  const today = new Date();
  const lastDay = today.getMonth() === month && today.getFullYear() === year ? today.getDate() : new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

export default function Meta() {
  const today = new Date();
  const monthISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const [meta, setMeta] = useState<any>(null);
  const [valor, setValor] = useState("");
  const [diasUteis, setDiasUteis] = useState(businessDaysInMonth(today.getFullYear(), today.getMonth()));
  const [faturado, setFaturado] = useState(0);

  const load = async () => {
    const { data } = await supabase.from("goals").select("*").eq("mes", monthISO).maybeSingle();
    if (data) { setMeta(data); setValor(String(data.valor_meta)); setDiasUteis(data.dias_uteis); }
    const { data: inv } = await supabase.from("invoices").select("valor").gte("data_faturamento", monthISO);
    setFaturado((inv || []).reduce((s, i) => s + Number(i.valor), 0));
  };
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = { user_id: user.id, mes: monthISO, valor_meta: parseFloat(valor.replace(",", ".")), dias_uteis: +diasUteis };
    const { error } = await supabase.from("goals").upsert(payload, { onConflict: "user_id,mes" });
    if (error) return toast.error(error.message);
    toast.success("Meta salva!");
    load();
  };

  const valorMeta = meta ? Number(meta.valor_meta) : 0;
  const metaDiaria = diasUteis ? valorMeta / diasUteis : 0;
  const elapsed = businessDaysElapsed(today.getFullYear(), today.getMonth());
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
            <Label>Dias úteis</Label>
            <Input type="number" value={diasUteis} onChange={e => setDiasUteis(+e.target.value)} required />
          </div>
          <Button type="submit" className="col-span-2" size="lg">Salvar Meta</Button>
        </form>
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
              <div className="text-xs text-muted-foreground">Esperado até hoje</div>
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
