import { useEffect, useRef, useState } from "react";
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
import { parseNFePdf, normalizeCnpj } from "@/lib/nfeParser";
import { Upload, FileCheck2, Loader2 } from "lucide-react";

export default function Faturar() {
  const nav = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [numero, setNumero] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("clients").select("*").order("nome").then(({ data }) => setClients(data || []));
  }, []);

  const handlePdf = async (file: File) => {
    setParsing(true);
    setPdfInfo(null);
    try {
      const nfe = await parseNFePdf(file);
      const matched = nfe.cnpjDestinatario
        ? clients.find(c => normalizeCnpj(c.cnpj) === normalizeCnpj(nfe.cnpjDestinatario))
        : null;

      if (nfe.numero) setNumero(nfe.numero);
      if (nfe.valor != null) setValor(String(nfe.valor.toFixed(2)));
      if (nfe.dataEmissao) setData(nfe.dataEmissao);
      if (matched) {
        setClientId(matched.id);
        setPdfInfo(`✓ Cliente identificado: ${matched.nome} (CNPJ ${nfe.cnpjDestinatario})`);
      } else if (nfe.cnpjDestinatario) {
        setPdfInfo(`⚠ CNPJ ${nfe.cnpjDestinatario} não encontrado no cadastro. Selecione o cliente manualmente.`);
      } else {
        setPdfInfo("⚠ Não foi possível extrair o CNPJ. Preencha manualmente.");
      }
      toast.success("Dados extraídos da nota");
    } catch (err: any) {
      toast.error("Falha ao ler PDF: " + (err.message || ""));
    } finally {
      setParsing(false);
    }
  };

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
      setNumero(""); setValor(""); setClientId(""); setPdfInfo(null);
      if (fileRef.current) fileRef.current.value = "";
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
        <p className="text-muted-foreground text-sm">Importe o PDF da NF-e ou preencha manualmente.</p>
      </header>

      {clients.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Cadastre um cliente primeiro.</p>
          <Button onClick={() => nav("/clientes")}>Cadastrar cliente</Button>
        </Card>
      ) : (
        <>
          <Card className="p-5 shadow-card border-dashed border-2 border-primary/30">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-primary" /> Importar PDF da NF-e
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Extraímos automaticamente o número, valor e identificamos o cliente pelo CNPJ.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={e => e.target.files?.[0] && handlePdf(e.target.files[0])}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:opacity-90"
              disabled={parsing}
            />
            {parsing && (
              <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo nota fiscal...
              </div>
            )}
            {pdfInfo && (
              <div className="mt-3 text-sm flex items-start gap-2 p-2 rounded-md bg-secondary/60">
                <FileCheck2 className="w-4 h-4 mt-0.5 text-success shrink-0" /> <span>{pdfInfo}</span>
              </div>
            )}
          </Card>

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
              <Button type="submit" size="lg" className="w-full gradient-primary text-primary-foreground shadow-elevated" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Faturamento"}
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
