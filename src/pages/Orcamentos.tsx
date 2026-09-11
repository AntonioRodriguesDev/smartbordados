import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Search, Printer, MessageSquarePlus, CheckCircle2,
  XCircle, Clock, FileText, TrendingUp, AlertTriangle, Users,
} from "lucide-react";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { STATUS, statusInfo, OPEN_STATUSES, MOTIVOS, nextNumero, QuoteStatus } from "@/lib/quotes";

type Item = { id?: string; modelo: string; servico: string; quantidade: string; valor_unitario: string };
type Quote = any;

const emptyItem = (): Item => ({ modelo: "", servico: "", quantidade: "1", valor_unitario: "" });

const emptyForm = () => ({
  client_id: "", numero: "", titulo: "", contato_nome: "", contato_email: "", contato_telefone: "",
  responsavel: "", status: "rascunho" as QuoteStatus, data_emissao: todayISO(), validade: "",
  prazo_entrega: "", condicao_pagamento: "", motivo_perda: "", observacoes: "",
  desconto: "0", proximo_contato: "",
});

const num = (v: any) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

export default function Orcamentos() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("todos");
  const [fClient, setFClient] = useState("todos");
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formItems, setFormItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<Quote | null>(null);
  const [evForm, setEvForm] = useState({ tipo: "contato", descricao: "", data: todayISO(), proximo_contato: "", status_novo: "" });

  const load = async () => {
    setLoading(true);
    const [q, c, it, ev] = await Promise.all([
      supabase.from("quotes").select("*, clients(nome)").order("data_emissao", { ascending: false }),
      supabase.from("clients").select("id, nome").order("nome"),
      supabase.from("quote_items").select("*"),
      supabase.from("quote_events").select("*").order("data", { ascending: false }),
    ]);
    setQuotes((q.data as any) || []);
    setClients(c.data || []);
    setItems((it.data as any) || []);
    setEvents((ev.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  /* ---------------- KPIs ---------------- */
  const filtered = useMemo(() => quotes.filter(q => {
    const s = search.trim().toLowerCase();
    if (s && !(`${q.numero} ${q.titulo || ""} ${q.clients?.nome || ""} ${q.contato_nome || ""}`.toLowerCase().includes(s))) return false;
    if (fStatus !== "todos" && q.status !== fStatus) return false;
    if (fClient !== "todos" && q.client_id !== fClient) return false;
    if (fDe && q.data_emissao < fDe) return false;
    if (fAte && q.data_emissao > fAte) return false;
    return true;
  }), [quotes, search, fStatus, fClient, fDe, fAte]);

  const sum = (arr: Quote[]) => arr.reduce((a, q) => a + Number(q.total || 0), 0);
  const by = (s: string) => filtered.filter(q => q.status === s);
  const abertos = filtered.filter(q => OPEN_STATUSES.includes(q.status));
  const aprovados = by("aprovado");
  const reprovados = by("reprovado");
  const semRetorno = by("sem_retorno");
  const decididos = aprovados.length + reprovados.length + semRetorno.length;
  const conversao = decididos ? (aprovados.length / decididos) * 100 : 0;
  const ticket = aprovados.length ? sum(aprovados) / aprovados.length : 0;
  const vencendo = abertos.filter(q => q.validade && q.validade < todayISO());
  const followHoje = quotes.filter(q => q.proximo_contato && q.proximo_contato <= todayISO() && OPEN_STATUSES.includes(q.status));

  /* --------------- por cliente --------------- */
  const porCliente = useMemo(() => {
    const map = new Map<string, any>();
    filtered.forEach(q => {
      const key = q.client_id || "sem";
      const nome = q.clients?.nome || "Sem cliente";
      const r = map.get(key) || { nome, total: 0, aprovado: 0, reprovado: 0, sem_retorno: 0, aberto: 0, valorAprovado: 0, valorTotal: 0 };
      r.total++;
      r.valorTotal += Number(q.total || 0);
      if (q.status === "aprovado") { r.aprovado++; r.valorAprovado += Number(q.total || 0); }
      else if (q.status === "reprovado") r.reprovado++;
      else if (q.status === "sem_retorno") r.sem_retorno++;
      else if (OPEN_STATUSES.includes(q.status)) r.aberto++;
      map.set(key, r);
    });
    return [...map.values()].sort((a, b) => b.valorAprovado - a.valorAprovado || b.total - a.total);
  }, [filtered]);

  /* --------------- form --------------- */
  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm(), numero: nextNumero(quotes.map(q => q.numero)) });
    setFormItems([emptyItem()]);
    setOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditing(q);
    setForm({
      client_id: q.client_id || "", numero: q.numero, titulo: q.titulo || "",
      contato_nome: q.contato_nome || "", contato_email: q.contato_email || "", contato_telefone: q.contato_telefone || "",
      responsavel: q.responsavel || "", status: q.status, data_emissao: q.data_emissao, validade: q.validade || "",
      prazo_entrega: q.prazo_entrega || "", condicao_pagamento: q.condicao_pagamento || "",
      motivo_perda: q.motivo_perda || "", observacoes: q.observacoes || "",
      desconto: String(q.desconto || 0), proximo_contato: q.proximo_contato || "",
    });
    const its = items.filter(i => i.quote_id === q.id).map(i => ({
      id: i.id, modelo: i.modelo, servico: i.servico || "",
      quantidade: String(i.quantidade), valor_unitario: String(i.valor_unitario),
    }));
    setFormItems(its.length ? its : [emptyItem()]);
    setOpen(true);
  };

  const subtotal = formItems.reduce((a, i) => a + num(i.quantidade) * num(i.valor_unitario), 0);
  const totalForm = Math.max(0, subtotal - num(form.desconto));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id) return toast.error("Selecione o cliente");
    const validItems = formItems.filter(i => i.modelo.trim());
    if (!validItems.length) return toast.error("Inclua pelo menos um item");
    const dup = quotes.some(q => q.numero === form.numero && q.id !== editing?.id);
    if (dup) return toast.error(`Já existe um orçamento nº ${form.numero}`);

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload: any = {
      user_id: user.id,
      client_id: form.client_id,
      numero: form.numero,
      titulo: form.titulo || null,
      contato_nome: form.contato_nome || null,
      contato_email: form.contato_email || null,
      contato_telefone: form.contato_telefone || null,
      responsavel: form.responsavel || null,
      status: form.status,
      data_emissao: form.data_emissao,
      validade: form.validade || null,
      prazo_entrega: form.prazo_entrega || null,
      condicao_pagamento: form.condicao_pagamento || null,
      motivo_perda: ["reprovado", "sem_retorno", "cancelado"].includes(form.status) ? (form.motivo_perda || null) : null,
      observacoes: form.observacoes || null,
      subtotal, desconto: num(form.desconto), total: totalForm,
      proximo_contato: form.proximo_contato || null,
      data_decisao: ["aprovado", "reprovado"].includes(form.status) ? (editing?.data_decisao || todayISO()) : null,
    };

    let quoteId = editing?.id as string | undefined;
    if (editing) {
      const { error } = await supabase.from("quotes").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("quote_items").delete().eq("quote_id", editing.id);
    } else {
      const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message || "Erro ao salvar"); }
      quoteId = (data as any).id;
    }

    await supabase.from("quote_items").insert(validItems.map(i => ({
      user_id: user.id, quote_id: quoteId!, modelo: i.modelo, servico: i.servico || null,
      quantidade: num(i.quantidade), valor_unitario: num(i.valor_unitario),
      total: num(i.quantidade) * num(i.valor_unitario),
    })) as any);

    if (!editing || editing.status !== form.status) {
      await supabase.from("quote_events").insert({
        user_id: user.id, quote_id: quoteId!, tipo: "status", data: todayISO(),
        status_novo: form.status, descricao: `Status: ${statusInfo(form.status).label}`,
      } as any);
    }

    toast.success(editing ? "Orçamento atualizado" : "Orçamento criado");
    setSaving(false);
    setOpen(false);
    load();
  };

  const remove = async (q: Quote) => {
    if (!confirm(`Excluir o orçamento nº ${q.numero}?`)) return;
    const { error } = await supabase.from("quotes").delete().eq("id", q.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento excluído");
    setDetail(null);
    load();
  };

  const changeStatus = async (q: Quote, status: string, motivo?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const patch: any = {
      status,
      data_decisao: ["aprovado", "reprovado"].includes(status) ? todayISO() : null,
      motivo_perda: ["reprovado", "sem_retorno", "cancelado"].includes(status) ? (motivo || q.motivo_perda || null) : null,
    };
    const { error } = await supabase.from("quotes").update(patch).eq("id", q.id);
    if (error) return toast.error(error.message);
    await supabase.from("quote_events").insert({
      user_id: user.id, quote_id: q.id, tipo: "status", data: todayISO(),
      status_novo: status, descricao: `Status alterado para ${statusInfo(status).label}`,
    } as any);
    toast.success(`Marcado como ${statusInfo(status).label}`);
    setDetail(d => (d && d.id === q.id ? { ...d, ...patch } : d));
    load();
  };

  const addEvent = async () => {
    if (!detail) return;
    if (!evForm.descricao.trim() && !evForm.status_novo) return toast.error("Descreva o contato");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("quote_events").insert({
      user_id: user.id, quote_id: detail.id, data: evForm.data, tipo: evForm.tipo,
      descricao: evForm.descricao || null, proximo_contato: evForm.proximo_contato || null,
      status_novo: evForm.status_novo || null,
    } as any);
    if (error) return toast.error(error.message);
    const patch: any = {};
    if (evForm.proximo_contato) patch.proximo_contato = evForm.proximo_contato;
    if (evForm.status_novo) {
      patch.status = evForm.status_novo;
      patch.data_decisao = ["aprovado", "reprovado"].includes(evForm.status_novo) ? todayISO() : null;
    }
    if (Object.keys(patch).length) await supabase.from("quotes").update(patch).eq("id", detail.id);
    setDetail(d => (d ? { ...d, ...patch } : d));
    setEvForm({ tipo: "contato", descricao: "", data: todayISO(), proximo_contato: "", status_novo: "" });
    toast.success("Registro adicionado");
    load();
  };

  const imprimir = (q: Quote) => {
    const its = items.filter(i => i.quote_id === q.id);
    const linhas = its.map(i => `<tr><td>${i.modelo}</td><td>${i.servico || ""}</td><td style="text-align:right">${Number(i.quantidade)}</td><td style="text-align:right">${brl(Number(i.valor_unitario))}</td><td style="text-align:right">${brl(Number(i.total))}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Orçamento ${q.numero}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#222}
      h1{font-size:20px;margin:0 0 4px} .muted{color:#777;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}
      th,td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}
      th{background:#f6f6f6;font-size:11px;text-transform:uppercase;color:#666}
      .tot{margin-top:16px;text-align:right;font-size:14px}
      .tot b{font-size:18px}
      .box{margin-top:20px;font-size:12px;color:#555;white-space:pre-wrap}
    </style></head><body>
      <h1>Proposta comercial nº ${q.numero}</h1>
      <div class="muted">Emissão ${fmtDate(q.data_emissao)}${q.validade ? ` • Válida até ${fmtDate(q.validade)}` : ""}</div>
      <div style="margin-top:14px;font-size:13px">
        <b>Cliente:</b> ${q.clients?.nome || "-"}<br/>
        ${q.contato_nome ? `<b>Contato:</b> ${q.contato_nome} ${q.contato_telefone || ""} ${q.contato_email || ""}<br/>` : ""}
        ${q.titulo ? `<b>Referência:</b> ${q.titulo}<br/>` : ""}
        ${q.prazo_entrega ? `<b>Prazo de entrega:</b> ${q.prazo_entrega}<br/>` : ""}
        ${q.condicao_pagamento ? `<b>Condição de pagamento:</b> ${q.condicao_pagamento}<br/>` : ""}
      </div>
      <table><thead><tr><th>Modelo</th><th>Serviço</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>${linhas}</tbody></table>
      <div class="tot">Subtotal: ${brl(Number(q.subtotal))}<br/>Desconto: ${brl(Number(q.desconto))}<br/><b>Total: ${brl(Number(q.total))}</b></div>
      ${q.observacoes ? `<div class="box"><b>Observações</b><br/>${q.observacoes}</div>` : ""}
    </body></html>`);
    w.document.close();
    w.print();
  };

  const detailItems = detail ? items.filter(i => i.quote_id === detail.id) : [];
  const detailEvents = detail ? events.filter(e => e.quote_id === detail.id) : [];

  const Kpi = ({ icon: Icon, label, value, sub, tone }: any) => (
    <Card className="p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className={`w-4 h-4 ${tone || ""}`} /> {label}
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">CRM de Orçamentos</h1>
          <p className="text-muted-foreground text-sm">Pipeline comercial, follow-up e desempenho por cliente</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-elevated">
          <Plus className="w-4 h-4 mr-1" /> Novo orçamento
        </Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={FileText} label="Orçamentos" value={filtered.length} sub={brl(sum(filtered))} />
        <Kpi icon={Clock} label="Em aberto" value={abertos.length} sub={brl(sum(abertos))} tone="text-amber-500" />
        <Kpi icon={CheckCircle2} label="Aprovados" value={aprovados.length} sub={brl(sum(aprovados))} tone="text-emerald-500" />
        <Kpi icon={XCircle} label="Reprovados / sem retorno" value={`${reprovados.length} / ${semRetorno.length}`} sub={brl(sum(reprovados) + sum(semRetorno))} tone="text-destructive" />
        <Kpi icon={TrendingUp} label="Conversão" value={`${conversao.toFixed(1)}%`} sub={`Ticket médio ${brl(ticket)}`} tone="text-primary" />
      </div>

      {(followHoje.length > 0 || vencendo.length > 0) && (
        <Card className="p-4 shadow-card border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {followHoje.length > 0 && <span>{followHoje.length} follow-up(s) para hoje</span>}
            {followHoje.length > 0 && vencendo.length > 0 && <span>•</span>}
            {vencendo.length > 0 && <span>{vencendo.length} orçamento(s) com validade vencida</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...followHoje, ...vencendo].slice(0, 8).map(q => (
              <button key={q.id} onClick={() => setDetail(q)} className="text-xs px-2 py-1 rounded-lg bg-background border hover:bg-secondary">
                nº {q.numero} — {q.clients?.nome}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Orçamentos</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="clientes">Por cliente</TabsTrigger>
        </TabsList>

        {/* filtros */}
        <Card className="p-3 shadow-card mt-4">
          <div className="grid md:grid-cols-5 gap-2">
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar nº, cliente, contato..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fClient} onValueChange={setFClient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={fDe} onChange={e => setFDe(e.target.value)} />
              <Input type="date" value={fAte} onChange={e => setFAte(e.target.value)} />
            </div>
          </div>
        </Card>

        <TabsContent value="lista" className="mt-4">
          <Card className="p-4 shadow-card">
            {loading ? <p className="text-center text-muted-foreground py-8">Carregando...</p>
              : filtered.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum orçamento encontrado.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                      <th className="py-2 pr-3">Nº</th>
                      <th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3">Referência</th>
                      <th className="py-2 pr-3">Emissão</th>
                      <th className="py-2 pr-3">Validade</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(q => {
                      const si = statusInfo(q.status);
                      const vencido = q.validade && q.validade < todayISO() && OPEN_STATUSES.includes(q.status);
                      return (
                        <tr key={q.id} className="border-b last:border-0 hover:bg-secondary/40 cursor-pointer" onClick={() => setDetail(q)}>
                          <td className="py-2 pr-3 font-semibold">{q.numero}</td>
                          <td className="py-2 pr-3">{q.clients?.nome || "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{q.titulo || "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{fmtDate(q.data_emissao)}</td>
                          <td className={`py-2 pr-3 ${vencido ? "text-destructive font-medium" : "text-muted-foreground"}`}>{q.validade ? fmtDate(q.validade) : "—"}</td>
                          <td className="py-2 pr-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${si.badge}`}>{si.label}</span></td>
                          <td className="py-2 pr-3 text-right font-semibold">{brl(Number(q.total))}</td>
                          <td className="py-2 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => imprimir(q)}><Printer className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(q)}><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => remove(q)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-3">
            {STATUS.filter(s => s.value !== "cancelado").map(s => {
              const col = filtered.filter(q => q.status === s.value);
              return (
                <Card key={s.value} className="p-3 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.label}
                    </div>
                    <span className="text-xs text-muted-foreground">{col.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{brl(sum(col))}</div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto no-scrollbar">
                    {col.map(q => (
                      <button key={q.id} onClick={() => setDetail(q)} className="w-full text-left p-2 rounded-lg border bg-background hover:bg-secondary/60 transition-colors">
                        <div className="text-xs text-muted-foreground">nº {q.numero}</div>
                        <div className="text-sm font-medium truncate">{q.clients?.nome}</div>
                        <div className="text-xs truncate text-muted-foreground">{q.titulo || "—"}</div>
                        <div className="text-sm font-semibold mt-1">{brl(Number(q.total))}</div>
                      </button>
                    ))}
                    {col.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Vazio</p>}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold"><Users className="w-4 h-4" /> Desempenho por cliente</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3 text-center">Orçamentos</th>
                    <th className="py-2 pr-3 text-center">Aprovados</th>
                    <th className="py-2 pr-3 text-center">Sem retorno</th>
                    <th className="py-2 pr-3 text-center">Reprovados</th>
                    <th className="py-2 pr-3 text-center">Em aberto</th>
                    <th className="py-2 pr-3 text-center">Conversão</th>
                    <th className="py-2 pr-3 text-right">Valor aprovado</th>
                    <th className="py-2 pr-3 text-right">Valor orçado</th>
                  </tr>
                </thead>
                <tbody>
                  {porCliente.map((r, i) => {
                    const dec = r.aprovado + r.reprovado + r.sem_retorno;
                    const conv = dec ? (r.aprovado / dec) * 100 : 0;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="py-2 pr-3 font-medium">{r.nome}</td>
                        <td className="py-2 pr-3 text-center">{r.total}</td>
                        <td className="py-2 pr-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{r.aprovado}</td>
                        <td className="py-2 pr-3 text-center text-slate-500">{r.sem_retorno}</td>
                        <td className="py-2 pr-3 text-center text-destructive">{r.reprovado}</td>
                        <td className="py-2 pr-3 text-center text-amber-600 dark:text-amber-400">{r.aberto}</td>
                        <td className="py-2 pr-3 text-center font-medium">{conv.toFixed(0)}%</td>
                        <td className="py-2 pr-3 text-right font-semibold">{brl(r.valorAprovado)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{brl(r.valorTotal)}</td>
                      </tr>
                    );
                  })}
                  {porCliente.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Sem dados.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---------- Dialog novo/editar ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Editar orçamento nº ${form.numero}` : "Novo orçamento"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div><Label>Nº</Label><Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} required /></div>
              <div className="md:col-span-2">
                <Label>Cliente</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><Label>Referência / título</Label><Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: bordado uniforme coleção verão" /></div>
              <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Contato</Label><Input value={form.contato_nome} onChange={e => setForm({ ...form, contato_nome: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.contato_telefone} onChange={e => setForm({ ...form, contato_telefone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.contato_email} onChange={e => setForm({ ...form, contato_email: e.target.value })} /></div>
            </div>

            <div className="grid md:grid-cols-4 gap-3">
              <div><Label>Emissão</Label><Input type="date" value={form.data_emissao} onChange={e => setForm({ ...form, data_emissao: e.target.value })} required /></div>
              <div><Label>Validade</Label><Input type="date" value={form.validade} onChange={e => setForm({ ...form, validade: e.target.value })} /></div>
              <div><Label>Próximo contato</Label><Input type="date" value={form.proximo_contato} onChange={e => setForm({ ...form, proximo_contato: e.target.value })} /></div>
              <div><Label>Prazo de entrega</Label><Input value={form.prazo_entrega} onChange={e => setForm({ ...form, prazo_entrega: e.target.value })} placeholder="Ex.: 15 dias" /></div>
            </div>

            {/* itens */}
            <div className="rounded-xl border p-3 space-y-2 bg-secondary/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Itens do orçamento</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setFormItems([...formItems, emptyItem()])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Item
                </Button>
              </div>
              {formItems.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4"><Label className="text-xs">Modelo</Label><Input value={it.modelo} onChange={e => setFormItems(formItems.map((x, i) => i === idx ? { ...x, modelo: e.target.value } : x))} /></div>
                  <div className="col-span-3"><Label className="text-xs">Serviço</Label><Input value={it.servico} onChange={e => setFormItems(formItems.map((x, i) => i === idx ? { ...x, servico: e.target.value } : x))} /></div>
                  <div className="col-span-2"><Label className="text-xs">Qtd</Label><Input type="number" step="1" value={it.quantidade} onChange={e => setFormItems(formItems.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))} /></div>
                  <div className="col-span-2"><Label className="text-xs">Unit.</Label><Input type="number" step="0.01" value={it.valor_unitario} onChange={e => setFormItems(formItems.map((x, i) => i === idx ? { ...x, valor_unitario: e.target.value } : x))} /></div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFormItems(formItems.length === 1 ? [emptyItem()] : formItems.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap justify-end items-end gap-4 pt-2 text-sm">
                <span className="text-muted-foreground">Subtotal <b className="text-foreground">{brl(subtotal)}</b></span>
                <div className="w-32"><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={form.desconto} onChange={e => setForm({ ...form, desconto: e.target.value })} /></div>
                <span className="text-lg font-bold">{brl(totalForm)}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Condição de pagamento</Label><Input value={form.condicao_pagamento} onChange={e => setForm({ ...form, condicao_pagamento: e.target.value })} placeholder="Ex.: 28/35 dias" /></div>
              {["reprovado", "sem_retorno", "cancelado"].includes(form.status) && (
                <div>
                  <Label>Motivo da perda</Label>
                  <Select value={form.motivo_perda} onValueChange={v => setForm({ ...form, motivo_perda: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div><Label>Observações</Label><Textarea rows={3} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>

            <Button type="submit" size="lg" className="w-full gradient-primary text-primary-foreground" disabled={saving}>
              {saving ? "Salvando..." : "Salvar orçamento"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Detalhe / follow-up ---------- */}
      <Dialog open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Orçamento nº {detail.numero}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo(detail.status).badge}`}>{statusInfo(detail.status).label}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Cliente:</span> <b>{detail.clients?.nome || "—"}</b></div>
                {detail.titulo && <div><span className="text-muted-foreground">Referência:</span> {detail.titulo}</div>}
                <div className="text-muted-foreground">
                  Emissão {fmtDate(detail.data_emissao)}{detail.validade ? ` • Validade ${fmtDate(detail.validade)}` : ""}
                  {detail.proximo_contato ? ` • Próximo contato ${fmtDate(detail.proximo_contato)}` : ""}
                </div>
                {detail.motivo_perda && <div><span className="text-muted-foreground">Motivo:</span> {detail.motivo_perda}</div>}
                <div className="text-xl font-bold pt-1">{brl(Number(detail.total))}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => changeStatus(detail, "aprovado")}><CheckCircle2 className="w-4 h-4 mr-1" /> Aprovado</Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => changeStatus(detail, "reprovado")}><XCircle className="w-4 h-4 mr-1" /> Reprovado</Button>
                <Button size="sm" variant="outline" onClick={() => changeStatus(detail, "sem_retorno")}><Clock className="w-4 h-4 mr-1" /> Sem retorno</Button>
                <Button size="sm" variant="outline" onClick={() => changeStatus(detail, "negociacao")}>Em negociação</Button>
                <Button size="sm" variant="ghost" onClick={() => imprimir(detail)}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
                <Button size="sm" variant="ghost" onClick={() => { setDetail(null); openEdit(detail); }}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-muted-foreground bg-secondary/50">
                    <th className="py-2 px-3">Modelo</th><th className="py-2 px-3">Serviço</th>
                    <th className="py-2 px-3 text-right">Qtd</th><th className="py-2 px-3 text-right">Unit.</th><th className="py-2 px-3 text-right">Total</th>
                  </tr></thead>
                  <tbody>
                    {detailItems.map(i => (
                      <tr key={i.id} className="border-t">
                        <td className="py-2 px-3">{i.modelo}</td>
                        <td className="py-2 px-3 text-muted-foreground">{i.servico || "—"}</td>
                        <td className="py-2 px-3 text-right">{Number(i.quantidade)}</td>
                        <td className="py-2 px-3 text-right">{brl(Number(i.valor_unitario))}</td>
                        <td className="py-2 px-3 text-right font-medium">{brl(Number(i.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <MessageSquarePlus className="w-3.5 h-3.5" /> Histórico de contatos
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={evForm.tipo} onValueChange={v => setEvForm({ ...evForm, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contato">Contato</SelectItem>
                      <SelectItem value="ligacao">Ligação</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="visita">Visita</SelectItem>
                      <SelectItem value="obs">Observação</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={evForm.data} onChange={e => setEvForm({ ...evForm, data: e.target.value })} />
                </div>
                <Textarea rows={2} placeholder="O que foi tratado com o cliente..." value={evForm.descricao} onChange={e => setEvForm({ ...evForm, descricao: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div><Label className="text-xs">Agendar próximo contato</Label><Input type="date" value={evForm.proximo_contato} onChange={e => setEvForm({ ...evForm, proximo_contato: e.target.value })} /></div>
                  <Button type="button" onClick={addEvent}>Registrar</Button>
                </div>

                <div className="space-y-2 pt-2">
                  {detailEvents.map(e => (
                    <div key={e.id} className="text-sm border-l-2 border-primary/40 pl-3">
                      <div className="text-xs text-muted-foreground">{fmtDate(e.data)} • {e.tipo}</div>
                      <div>{e.descricao || "—"}</div>
                      {e.proximo_contato && <div className="text-xs text-muted-foreground">Próximo contato: {fmtDate(e.proximo_contato)}</div>}
                    </div>
                  ))}
                  {detailEvents.length === 0 && <p className="text-xs text-muted-foreground">Nenhum registro ainda.</p>}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
