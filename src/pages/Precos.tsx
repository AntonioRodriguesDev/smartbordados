import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { brl, fmtDate, todayISO } from "@/lib/format";

type Row = {
  id: string;
  client_id: string | null;
  modelo: string;
  servico: string;
  valor: number;
  data_inclusao: string;
  data_alteracao_preco: string | null;
  clients?: { nome: string } | null;
};

const empty = { client_id: "", modelo: "", servico: "", valor: "", data_inclusao: todayISO() };

export default function Precos() {
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("price_list")
      .select("id, client_id, modelo, servico, valor, data_inclusao, data_alteracao_preco, clients(nome)")
      .order("modelo");
    setRows((data as any) || []);
    const { data: c } = await supabase.from("clients").select("id, nome").order("nome");
    setClients(c || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      client_id: r.client_id || "", modelo: r.modelo, servico: r.servico,
      valor: String(r.valor), data_inclusao: r.data_inclusao,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseFloat(String(form.valor).replace(",", "."));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editing) {
      const precoMudou = Number(editing.valor) !== valorNum;
      const { error } = await supabase.from("price_list").update({
        client_id: form.client_id || null, modelo: form.modelo, servico: form.servico,
        valor: valorNum, data_inclusao: form.data_inclusao,
        ...(precoMudou ? { data_alteracao_preco: todayISO() } : {}),
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Preço atualizado");
    } else {
      const { error } = await supabase.from("price_list").insert({
        user_id: user.id, client_id: form.client_id || null, modelo: form.modelo,
        servico: form.servico, valor: valorNum, data_inclusao: form.data_inclusao,
      });
      if (error) return toast.error(error.message);
      toast.success("Preço cadastrado");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esse item da tabela de preços?")) return;
    await supabase.from("price_list").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || r.modelo?.toLowerCase().includes(q) || r.servico?.toLowerCase().includes(q)
      || r.clients?.nome?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tabela de Preços</h1>
          <p className="text-muted-foreground text-sm">Preços por cliente, modelo e serviço</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-elevated">
          <Plus className="w-4 h-4 mr-1" /> Novo preço
        </Button>
      </header>

      <Card className="p-4 shadow-card">
        <Input placeholder="Buscar cliente, modelo ou serviço..." value={search} onChange={e => setSearch(e.target.value)} className="mb-3 max-w-xs" />
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum preço cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Modelo</th>
                  <th className="py-2 pr-3">Serviço</th>
                  <th className="py-2 pr-3">Inclusão</th>
                  <th className="py-2 pr-3">Últ. alteração</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-secondary/40">
                    <td className="py-2 pr-3">{r.clients?.nome || "—"}</td>
                    <td className="py-2 pr-3 font-medium">{r.modelo}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.servico}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{fmtDate(r.data_inclusao)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.data_alteracao_preco ? fmtDate(r.data_alteracao_preco) : "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{brl(Number(r.valor))}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar preço" : "Novo preço"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Modelo</Label><Input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} required /></div>
            <div><Label>Serviço</Label><Input value={form.servico} onChange={e => setForm({ ...form, servico: e.target.value })} placeholder="Ex.: bordado frente" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required /></div>
              <div><Label>Data de inclusão</Label><Input type="date" value={form.data_inclusao} onChange={e => setForm({ ...form, data_inclusao: e.target.value })} required /></div>
            </div>
            <Button type="submit" size="lg" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
