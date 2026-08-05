import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { brl, fmtDate } from "@/lib/format";
import { computeReceivables } from "@/lib/receivables";

export default function Faturamentos() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ client_id: "", numero: "", valor: "", data_faturamento: "", nota_retorno: "" });

  const load = async () => {
    const { data } = await supabase.from("invoices")
      .select("id, numero, valor, data_faturamento, client_id, nota_retorno, clients(nome)")
      .order("data_faturamento", { ascending: false });
    setInvoices((data as any) || []);
    const { data: c } = await supabase.from("clients").select("*").order("nome");
    setClients(c || []);
  };
  useEffect(() => { load(); }, []);

  const openEdit = (inv: any) => {
    setEditing(inv);
    setForm({ client_id: inv.client_id, numero: inv.numero, valor: String(inv.valor), data_faturamento: inv.data_faturamento, nota_retorno: inv.nota_retorno || "" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const nr = String(form.nota_retorno || "").trim();
    if (nr && invoices.some(i => i.id !== editing.id && String(i.nota_retorno || "").trim() === nr)) {
      return toast.error(`Nota de retorno ${nr} já lançada em outro faturamento`);
    }
    const valorNum = parseFloat(String(form.valor).replace(",", "."));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("invoices").update({
      client_id: form.client_id, numero: form.numero, valor: valorNum,
      data_faturamento: form.data_faturamento, nota_retorno: nr || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);


    // regenerate receivables
    await supabase.from("receivables").delete().eq("invoice_id", editing.id);
    const client = clients.find(c => c.id === form.client_id);
    if (client) {
      const recvs = computeReceivables(client, form.data_faturamento, valorNum);
      await supabase.from("receivables").insert(
        recvs.map(r => ({ ...r, user_id: user.id, invoice_id: editing.id, client_id: form.client_id }))
      );
    }
    toast.success("Faturamento atualizado!");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esse faturamento e seus recebimentos?")) return;
    await supabase.from("receivables").delete().eq("invoice_id", id);
    await supabase.from("invoices").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    return !q || i.numero?.toLowerCase().includes(q) || i.clients?.nome?.toLowerCase().includes(q)
      || String(i.nota_retorno || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Faturamentos</h1>
        <p className="text-muted-foreground text-sm">Edite ou exclua lançamentos</p>
      </header>

      <Card className="p-4 shadow-card">
        <Input placeholder="Buscar nota, cliente ou nota de retorno..." value={search} onChange={e => setSearch(e.target.value)} className="mb-3 max-w-xs" />
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum faturamento.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(i => (
              <div key={i.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="min-w-0">
                  <div className="font-medium truncate">{i.clients?.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    NF {i.numero} · {fmtDate(i.data_faturamento)}
                    {i.nota_retorno ? <> · <span className="text-primary font-medium">Retorno {i.nota_retorno}</span></> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{brl(Number(i.valor))}</span>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar faturamento</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Número da nota</Label><Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} required /></div>
              <div><Label>Data</Label><Input type="date" value={form.data_faturamento} onChange={e => setForm({ ...form, data_faturamento: e.target.value })} required /></div>
            </div>
            <Button type="submit" size="lg" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
