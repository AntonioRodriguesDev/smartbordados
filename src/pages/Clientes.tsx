import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";

export default function Clientes() {
  const [clients, setClients] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; atraso: number }>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ nome: "", cnpj: "", tipo_condicao: "DIAS", dias: "30", dia_corte: 15, dia_pagamento_1: 25, dia_pagamento_2: 10 });

  const load = async () => {
    const { data } = await supabase.from("clients").select("*").order("nome");
    setClients(data || []);
    const { data: r } = await supabase.from("receivables").select("client_id, valor, status, vencimento");
    const today = new Date().toISOString().slice(0, 10);
    const map: any = {};
    (r || []).forEach((row: any) => {
      const m = map[row.client_id] || { total: 0, atraso: 0 };
      m.total += Number(row.valor);
      if (row.status !== "pago" && row.vencimento < today) m.atraso += Number(row.valor);
      map[row.client_id] = m;
    });
    setStats(map);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      user_id: user.id, nome: form.nome, cnpj: form.cnpj, tipo_condicao: form.tipo_condicao,
    };
    if (form.tipo_condicao === "DIAS") payload.dias = form.dias;
    else {
      payload.dia_corte = +form.dia_corte;
      payload.dia_pagamento_1 = +form.dia_pagamento_1;
      payload.dia_pagamento_2 = form.dia_pagamento_2 ? +form.dia_pagamento_2 : null;
    }
    const { error } = await supabase.from("clients").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cliente cadastrado!");
    setOpen(false);
    setForm({ nome: "", cnpj: "", tipo_condicao: "DIAS", dias: "30", dia_corte: 15, dia_pagamento_1: 25, dia_pagamento_2: 10 });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir cliente e todos os lançamentos?")) return;
    await supabase.from("clients").delete().eq("id", id);
    toast.success("Cliente removido");
    load();
  };

  // ranking
  const ranking = [...clients].sort((a, b) => (stats[b.id]?.total || 0) - (stats[a.id]?.total || 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">Cadastre condições de pagamento</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg"><Plus className="w-4 h-4 mr-1" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div>
                <Label>Condição de pagamento</Label>
                <Select value={form.tipo_condicao} onValueChange={v => setForm({ ...form, tipo_condicao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIAS">DIAS (ex: 30 ou 30/60)</SelectItem>
                    <SelectItem value="FIXO">FIXO (corte mensal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.tipo_condicao === "DIAS" ? (
                <div><Label>Dias</Label><Input value={form.dias} onChange={e => setForm({ ...form, dias: e.target.value })} placeholder="30 ou 30/60" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Corte</Label><Input type="number" value={form.dia_corte} onChange={e => setForm({ ...form, dia_corte: e.target.value })} /></div>
                  <div><Label>Pgto 1</Label><Input type="number" value={form.dia_pagamento_1} onChange={e => setForm({ ...form, dia_pagamento_1: e.target.value })} /></div>
                  <div><Label>Pgto 2</Label><Input type="number" value={form.dia_pagamento_2} onChange={e => setForm({ ...form, dia_pagamento_2: e.target.value })} /></div>
                </div>
              )}
              <Button type="submit" className="w-full" size="lg">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="p-4 shadow-card">
        {clients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <div className="font-medium">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.cnpj && <>{c.cnpj} · </>}
                    {c.tipo_condicao === "DIAS" ? `${c.dias} dias` : `Corte dia ${c.dia_corte}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold text-sm">{brl(stats[c.id]?.total || 0)}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {ranking.length > 0 && (
        <Card className="p-4 shadow-card">
          <h3 className="font-semibold mb-3">🏆 Top clientes</h3>
          <div className="space-y-2">
            {ranking.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between p-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-primary">#{i + 1}</span>
                  <span>{c.nome}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{brl(stats[c.id]?.total || 0)}</div>
                  {stats[c.id]?.atraso > 0 && <div className="text-xs text-destructive">Atraso: {brl(stats[c.id].atraso)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
