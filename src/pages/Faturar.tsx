import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { computeReceivables } from "@/lib/receivables";
import { todayISO, brl } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { parseNFePdf, normalizeCnpj } from "@/lib/nfeParser";
import { Upload, FileCheck2, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";

type BatchItem = {
  fileName: string;
  status: "parsing" | "ready" | "error" | "saved";
  numero?: string;
  valor?: number;
  data?: string;
  cnpj?: string;
  clientId?: string;
  clientName?: string;
  temCfop5902?: boolean;
  notaRetorno?: string;
  error?: string;
};

export default function Faturar() {
  const nav = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [numero, setNumero] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [notaRetorno, setNotaRetorno] = useState("");
  const [exigeRetorno, setExigeRetorno] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [usedRetornos, setUsedRetornos] = useState<Set<string>>(new Set());

  const loadRetornos = async () => {
    const { data } = await supabase.from("invoices").select("nota_retorno").not("nota_retorno", "is", null);
    setUsedRetornos(new Set(((data as any[]) || []).map(r => String(r.nota_retorno).trim()).filter(Boolean)));
  };

  useEffect(() => {
    supabase.from("clients").select("*").order("nome").then(({ data }) => setClients(data || []));
    loadRetornos();
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
      setExigeRetorno(!!nfe.temCfop5902);
      const cfopMsg = nfe.temCfop5902 ? " • CFOP 5902 detectado: informe a nota de retorno." : "";
      if (matched) {
        setClientId(matched.id);
        setPdfInfo(`✓ Cliente identificado: ${matched.nome} (CNPJ ${nfe.cnpjDestinatario})${cfopMsg}`);
      } else if (nfe.cnpjDestinatario) {
        setPdfInfo(`⚠ CNPJ ${nfe.cnpjDestinatario} não encontrado no cadastro. Selecione o cliente manualmente.${cfopMsg}`);
      } else {
        setPdfInfo(`⚠ Não foi possível extrair o CNPJ. Preencha manualmente.${cfopMsg}`);
      }
      toast.success("Dados extraídos da nota");
    } catch (err: any) {
      toast.error("Falha ao ler PDF: " + (err.message || ""));
    } finally {
      setParsing(false);
    }
  };

  const handleBatch = async (files: FileList) => {
    const initial: BatchItem[] = Array.from(files).map(f => ({ fileName: f.name, status: "parsing" }));
    setBatch(initial);

    const results: BatchItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const nfe = await parseNFePdf(file);
        const matched = nfe.cnpjDestinatario
          ? clients.find(c => normalizeCnpj(c.cnpj) === normalizeCnpj(nfe.cnpjDestinatario))
          : null;
        const faltaRetorno = !!nfe.temCfop5902;
        results.push({
          fileName: file.name,
          status: matched && nfe.valor != null && nfe.numero && !faltaRetorno ? "ready" : "error",
          numero: nfe.numero,
          valor: nfe.valor,
          data: nfe.dataEmissao || todayISO(),
          cnpj: nfe.cnpjDestinatario,
          clientId: matched?.id,
          clientName: matched?.nome,
          temCfop5902: nfe.temCfop5902,
          notaRetorno: "",
          error: !matched
            ? (nfe.cnpjDestinatario ? `CNPJ ${nfe.cnpjDestinatario} não cadastrado` : "CNPJ não encontrado no PDF")
            : !nfe.numero ? "Número não encontrado"
            : nfe.valor == null ? "Valor não encontrado"
            : faltaRetorno ? "CFOP 5902 — informe a nota de retorno"
            : undefined,
        });
      } catch (err: any) {
        results.push({ fileName: file.name, status: "error", error: err.message || "Falha ao ler PDF" });
      }
      setBatch([...results, ...initial.slice(results.length)]);
    }
    if (batchRef.current) batchRef.current.value = "";
  };

  const setItemRetorno = (idx: number, value: string) => {
    setBatch(prev => prev.map((b, i) => {
      if (i !== idx) return b;
      const nr = value.trim();
      const dup = nr && usedRetornos.has(nr);
      const base = { ...b, notaRetorno: value };
      if (b.status === "saved") return base;
      if (dup) return { ...base, status: "error", error: `Nota de retorno ${nr} já utilizada` };
      const okBase = !!b.clientId && b.valor != null && !!b.numero;
      if (!okBase) return base;
      if (b.temCfop5902 && !nr) return { ...base, status: "error", error: "CFOP 5902 — informe a nota de retorno" };
      return { ...base, status: "ready", error: undefined };
    }));
  };

  const saveBatch = async () => {
    const ready = batch.filter(b => b.status === "ready");
    if (ready.length === 0) return toast.error("Nenhum PDF pronto para importar");
    setSavingBatch(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");

      const updated = [...batch];
      const seen = new Set(usedRetornos);
      let ok = 0;
      for (let i = 0; i < updated.length; i++) {
        const item = updated[i];
        if (item.status !== "ready") continue;
        try {
          const nr = (item.notaRetorno || "").trim();
          if (nr && seen.has(nr)) throw new Error(`Nota de retorno ${nr} já utilizada`);
          const client = clients.find(c => c.id === item.clientId);
          const { data: inv, error } = await supabase.from("invoices").insert({
            user_id: user.id, client_id: item.clientId!, numero: item.numero!,
            valor: item.valor!, data_faturamento: item.data!, nota_retorno: nr || null,
          }).select().single();
          if (error) throw error;
          const recvs = computeReceivables(client, item.data!, item.valor!);
          const { error: rErr } = await supabase.from("receivables").insert(
            recvs.map(r => ({ ...r, user_id: user.id, invoice_id: inv.id, client_id: item.clientId! }))
          );
          if (rErr) throw rErr;
          if (nr) seen.add(nr);
          updated[i] = { ...item, status: "saved" };
          ok++;
          setBatch([...updated]);
        } catch (err: any) {
          updated[i] = { ...item, status: "error", error: err.message };
          setBatch([...updated]);
        }
      }
      setUsedRetornos(seen);
      toast.success(`${ok} faturamento(s) importado(s)`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingBatch(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return toast.error("Selecione um cliente");
    const nr = notaRetorno.trim();
    if (exigeRetorno && !nr) return toast.error("CFOP 5902: informe a nota de retorno");
    if (nr && usedRetornos.has(nr)) return toast.error(`Nota de retorno ${nr} já utilizada`);
    setLoading(true);
    try {
      const client = clients.find(c => c.id === clientId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");

      const valorNum = parseFloat(valor.replace(",", "."));
      const { data: inv, error } = await supabase.from("invoices").insert({
        user_id: user.id, client_id: clientId, numero, valor: valorNum, data_faturamento: data,
        nota_retorno: nr || null,
      }).select().single();
      if (error) throw error;

      const recvs = computeReceivables(client, data, valorNum);
      const { error: rErr } = await supabase.from("receivables").insert(
        recvs.map(r => ({ ...r, user_id: user.id, invoice_id: inv.id, client_id: clientId }))
      );
      if (rErr) throw rErr;

      if (nr) setUsedRetornos(prev => new Set(prev).add(nr));
      toast.success("Faturamento salvo!");
      setNumero(""); setValor(""); setClientId(""); setPdfInfo(null);
      setNotaRetorno(""); setExigeRetorno(false);
      if (fileRef.current) fileRef.current.value = "";
      // Permanece na tela para novos lançamentos
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };


  const readyCount = batch.filter(b => b.status === "ready").length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Novo Faturamento</h1>
          <p className="text-muted-foreground text-sm">Importe um ou vários PDFs da NF-e ou preencha manualmente.</p>
        </div>
        <Button variant="outline" onClick={() => nav("/")}>Voltar ao Painel</Button>
      </header>

      {clients.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Cadastre um cliente primeiro.</p>
          <Button onClick={() => nav("/clientes")}>Cadastrar cliente</Button>
        </Card>
      ) : (
        <>
          {/* Batch import */}
          <Card className="p-5 shadow-card border-dashed border-2 border-primary/30">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-primary" /> Importação em lote (vários PDFs)
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Selecione vários arquivos. Cada PDF cujo CNPJ esteja cadastrado será importado automaticamente.
            </p>
            <input
              ref={batchRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={e => e.target.files?.length && handleBatch(e.target.files)}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:opacity-90"
            />

            {batch.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {batch.length} arquivo(s) — {readyCount} pronto(s) para importar
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setBatch([])}>Limpar</Button>
                    <Button size="sm" onClick={saveBatch} disabled={savingBatch || readyCount === 0}>
                      {savingBatch ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Importar {readyCount > 0 ? `(${readyCount})` : ""}
                    </Button>
                  </div>
                </div>
                <div className="divide-y rounded-md border">
                  {batch.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {b.status === "parsing" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
                        {b.status === "ready" && <FileCheck2 className="w-4 h-4 text-primary shrink-0" />}
                        {b.status === "saved" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                        {b.status === "error" && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{b.fileName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {b.status === "parsing" && "Lendo..."}
                            {b.status === "ready" && `${b.clientName} • NF ${b.numero} • ${brl(b.valor || 0)}`}
                            {b.status === "saved" && `Importado: ${b.clientName} • NF ${b.numero}`}
                            {b.status === "error" && (b.error || "Erro")}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setBatch(batch.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="remover"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Single PDF + manual */}
          <Card className="p-5 shadow-card border-dashed border-2 border-primary/20">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-primary" /> Importar um único PDF (preenche o formulário)
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={e => e.target.files?.[0] && handlePdf(e.target.files[0])}
              className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:text-secondary-foreground file:cursor-pointer hover:file:opacity-90"
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
