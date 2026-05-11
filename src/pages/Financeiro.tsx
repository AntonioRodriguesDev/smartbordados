import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { DollarSign, Search, Check, AlertCircle, Clock, Filter, ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Financeiro() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("receivables")
      .select("*, clients(nome), invoices(numero, data_faturamento)")
      .order("vencimento", { ascending: true });
    
    if (error) toast.error(error.message);
    else setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const marcarPago = async (id: string) => {
    if (!confirm("Confirmar o recebimento deste valor?")) return;
    const { error } = await supabase
      .from("receivables")
      .update({ status: "pago", pago_em: todayISO() })
      .eq("id", id);
    
    if (error) return toast.error(error.message);
    toast.success("Recebimento confirmado");
    load();
  };

  const reverterPago = async (r: any) => {
    if (!confirm(`Reverter recebimento de ${r.clients?.nome}? O status voltará para pendente/atrasado.`)) return;
    
    // Determine new status based on due date
    const newStatus = r.vencimento < todayISO() ? "atrasado" : "pendente";
    
    const { error } = await supabase
      .from("receivables")
      .update({ status: newStatus, pago_em: null })
      .eq("id", r.id);
    
    if (error) return toast.error(error.message);
    toast.success("Recebimento revertido");
    load();
  };

  const filtered = rows.filter(r => {
    const matchesSearch = !search || r.clients?.nome?.toLowerCase().includes(search.toLowerCase()) || r.invoices?.numero?.includes(search);
    const matchesStatus = statusTab === "all" || r.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  const totalPago = rows.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor), 0);
  const totalPendente = rows.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0);
  const totalAtrasado = rows.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.valor), 0);

  return (
    <div className="space-y-4 animate-fade-in-up pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="p-1 hover:bg-secondary rounded-full transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
            <h1 className="text-2xl font-bold tracking-tight">Monitoramento Financeiro</h1>
          </div>
          <p className="text-muted-foreground text-sm">Controle total de recebimentos e fluxo de caixa</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cliente ou NF..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-full md:w-64 glass"
            />
          </div>
          <Button variant="outline" size="icon" className="glass"><Filter className="w-4 h-4" /></Button>
        </div>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 glass shadow-card flex items-center gap-4 border-l-4 border-l-success">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success"><Check className="w-5 h-5" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total Recebido</div>
            <div className="text-xl font-black">{brl(totalPago)}</div>
          </div>
        </Card>
        <Card className="p-4 glass shadow-card flex items-center gap-4 border-l-4 border-l-warning">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning"><Clock className="w-5 h-5" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">A Receber</div>
            <div className="text-xl font-black">{brl(totalPendente)}</div>
          </div>
        </Card>
        <Card className="p-4 glass shadow-card flex items-center gap-4 border-l-4 border-l-destructive">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"><AlertCircle className="w-5 h-5" /></div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Em Atraso</div>
            <div className="text-xl font-black">{brl(totalAtrasado)}</div>
          </div>
        </Card>
      </div>

      <Card className="glass shadow-card overflow-hidden">
        <Tabs defaultValue="all" value={statusTab} onValueChange={setStatusTab} className="w-full">
          <div className="px-4 pt-4 border-b border-border/40">
            <TabsList className="bg-secondary/50 mb-4">
              <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
              <TabsTrigger value="pendente" className="text-xs">A Vencer</TabsTrigger>
              <TabsTrigger value="atrasado" className="text-xs">Em Atraso</TabsTrigger>
              <TabsTrigger value="pago" className="text-xs">Recebidos</TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/40">
                  <th className="text-left font-bold py-4 px-4">Cliente</th>
                  <th className="text-left font-bold py-4 px-4">Documento</th>
                  <th className="text-left font-bold py-4 px-4">Emissão</th>
                  <th className="text-left font-bold py-4 px-4">Vencimento</th>
                  <th className="text-right font-bold py-4 px-4">Valor</th>
                  <th className="text-center font-bold py-4 px-4">Status</th>
                  <th className="text-right font-bold py-4 px-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground">Carregando dados...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
                ) : (
                  filtered.map(r => (
                    <tr key={r.id} className="hover:bg-secondary/20 transition-colors group">
                      <td className="py-3 px-4 font-medium">{r.clients?.nome}</td>
                      <td className="py-3 px-4 text-muted-foreground">NF {r.invoices?.numero || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground">{r.invoices?.data_faturamento ? fmtDate(r.invoices.data_faturamento) : "—"}</td>
                      <td className="py-3 px-4 font-medium">{fmtDate(r.vencimento)}</td>
                      <td className="py-3 px-4 text-right font-bold">{brl(Number(r.valor))}</td>
                      <td className="py-3 px-4 text-center">
                        {r.status === "pago" ? (
                          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/15 px-2">Recebido</Badge>
                        ) : r.status === "atrasado" ? (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15 px-2">Atrasado</Badge>
                        ) : (
                          <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/15 px-2">A Vencer</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {r.status !== "pago" ? (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                            onClick={() => marcarPago(r.id)}
                            title="Confirmar recebimento"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-warning hover:bg-warning/10"
                            onClick={() => reverterPago(r)}
                            title="Reverter recebimento"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
