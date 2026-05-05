import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { computeReceivables } from "@/lib/receivables";
import { todayISO } from "@/lib/format";
import { useNavigate } from "react-router-dom";

export default function Faturar() {
  const nav = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [numero, setNumero] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("*").order("nome").then(({ data }) => setClients(data || []));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return toast.error("Selecione um cliente");
    setLoading(true);
    try {
      const client = clients.find(c => c.id === clientId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");

      const valorNum = parseFloat(valor.replace(",", "."));
      const { data: inv, error } = await supabase.from("invoices").insert({
        user_id: user.id, client_id: clientId, numero, valor: valorNum, data_faturamento: data,
      }).select().single();
      if (error) throw error;

      const recvs = computeReceivables(client, data, valorNum);
      const { error: rErr } = await supabase.from("receivables").insert(
        recvs.map(r => ({ ...r, user_id: user.id, invoice_id: inv.id, client_id: clientId }))
      );
      if (rErr) throw rErr;

      toast.success("Faturamento salvo!");
      setNumero(""); setValor(""); setClientId("");
      nav("/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold">Novo Faturamento</h1>
        <p className="text-muted-foreground text-sm">Em segundos. Vencimentos calculados automaticamente.</p>
      </header>

      {clients.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Cadastre um cliente primeiro.</p>
          <Button onClick={() => nav("/clientes")}>Cadastrar cliente</Button>
        </Card>
      ) : (
        <Card className="p-6 shadow-card">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número da nota</Label>
              <Input value={numero} onChange={e => setNumero(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} required />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Faturamento"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
