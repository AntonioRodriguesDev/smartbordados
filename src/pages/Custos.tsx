import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { sumCostsForMonth, costAppliesToMonth, nextDueDate, type CostRow, type CostType } from "@/lib/costs";
import { Plus, Trash2, Check, Power, Wallet, Repeat, Layers, Banknote, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Cat = { id: string; nome: string; tipo_padrao: string; cor: string | null };

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function Custos() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [emps, setEmps] = useState<{ id: string; nome: string; salario: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState(false);
  const [newCat, setNewCat] = useState({ nome: "", tipo_padrao: "fixo" });

  const [form, setForm] = useState<{
    descricao: string; tipo: CostType; valor: string; data_inicio: string;
    dia_vencimento: string; parcelas_total: string; category_id: string; observacao: string;
  }>({
    descricao: "", tipo: "fixo", valor: "", data_inicio: todayISO(),
    dia_vencimento: "5", parcelas_total: "12", category_id: "", observacao: "",
  });

  const ym = todayISO().slice(0, 7);

  const load = async () => {
    const [cs, ct, em] = await Promise.all([
      supabase.from("costs").select("*").order("data_inicio", { ascending: false }),
      supabase.from("cost_categories").select("*").order("nome"),
      supabase.from("employees").select("id, nome, salario").eq("status", "ativo"),
    ]);
    setCosts((cs.data as any) || []);
    setCats((ct.data as any) || []);
    setEmps((em.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const folha = emps.reduce((s, e) => s + Number(e.salario || 0), 0);
  const totals = sumCostsForMonth(costs, ym);
  const totalGeral = totals.total + folha;

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    costs.forEach(c => {
      if (!costAppliesToMonth(c, ym)) return;
      const key = c.category_id || "sem";
      map.set(key, (map.get(key) || 0) + Number(c.valor));
    });
    if (folha > 0) map.set("__folha__", folha);
    const nameOf = new Map(cats.map(c => [c.id, c.nome]));
    return Array.from(map.entries())
      .map(([k, v]) => ({
        nome: k === "__folha__" ? "Folha" : k === "sem" ? "Sem categoria" : (nameOf.get(k) || "—"),
        valor: v,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [costs, cats, folha, ym]);

  const proximos = useMemo(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return costs
      .filter(c => c.ativo && !(c.tipo === "unico" && c.pago))
      .map(c => ({ c, due: nextDueDate(c, t) }))
      .filter(x => !!x.due)
      .filter(x => {
        const d = new Date(x.due!); const diff = (d.getTime() - t.getTime()) / 86400000;
        return diff >= 0 && diff <= 14;
      })
      .sort((a, b) => a.due!.localeCompare(b.due!));
  }, [costs]);

  const resetForm = () => {
    setForm({ descricao: "", tipo: "fixo", valor: "", data_inicio: todayISO(), dia_vencimento: "5", parcelas_total: "12", category_id: "", observacao: "" });
    setEditId(null);
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (c: CostRow) => {
    setEditId(c.id);
    setForm({
      descricao: c.descricao, tipo: c.tipo, valor: String(c.valor), data_inicio: c.data_inicio,
      dia_vencimento: String(c.dia_vencimento ?? 5), parcelas_total: String(c.parcelas_total ?? 12),
      category_id: c.category_id ?? "", observacao: c.observacao ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.descricao.trim() || !form.valor) return toast.error("Descrição e valor são obrigatórios");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      user_id: user.id,
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor: Number(form.valor),
      data_inicio: form.data_inicio,
      dia_vencimento: form.tipo === "unico" ? null : Number(form.dia_vencimento || 5),
      parcelas_total: form.tipo === "parcelado" ? Number(form.parcelas_total || 1) : null,
      category_id: form.category_id || null,
      observacao: form.observacao || null,
    };
    const q = editId
      ? supabase.from("costs").update(payload).eq("id", editId)
      : supabase.from("costs").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editId ? "Custo atualizado" : "Custo cadastrado");
    setOpen(false); resetForm(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    const { error } = await supabase.from("costs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); load();
  };

  const toggleAtivo = async (c: CostRow) => {
    const { error } = await supabase.from("costs").update({ ativo: !c.ativo }).eq("id", c.id);
    if (error) return toast.error(error.message);
    load();
  };

  const pagarParcela = async (c: CostRow) => {
    if (c.tipo === "unico") {
      await supabase.from("costs").update({ pago: true }).eq("id", c.id);
    } else if (c.tipo === "parcelado") {
      await supabase.from("costs").update({ parcelas_pagas: (c.parcelas_pagas || 0) + 1 }).eq("id", c.id);
    } else {
      // fixo: just toast — recurring, no per-month status
      toast.success("Custo fixo registrado para o mês");
      return;
    }
    toast.success("Marcado como pago"); load();
  };

  const saveCat = async () => {
    if (!newCat.nome.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("cost_categories").insert({ user_id: user.id, ...newCat });
    if (error) return toast.error(error.message);
    setNewCat({ nome: "", tipo_padrao: "fixo" });
    setOpenCat(false); load();
  };

  const removeCat = async (id: string) => {
    if (!confirm("Excluir categoria? Os custos ficarão sem categoria.")) return;
    await supabase.from("cost_categories").delete().eq("id", id);
    load();
  };

  const catName = (id: string | null) => id ? (cats.find(c => c.id === id)?.nome || "—") : "—";
  const tipoLabel: Record<CostType, string> = { fixo: "Fixo", parcelado: "Parcelado", unico: "Único" };

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Custos da Empresa</h1>
          <p className="text-xs text-muted-foreground">Controle de despesas fixas, parceladas e únicas</p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> Novo custo</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Banknote className="w-4 h-4" />} label="Folha de Pagamento" value={brl(folha)} hint={`${emps.length} ativos`} color="primary" />
        <KPI icon={<Repeat className="w-4 h-4" />} label="Custos Fixos" value={brl(totals.fixo)} color="success" />
        <KPI icon={<Layers className="w-4 h-4" />} label="Parcelas no Mês" value={brl(totals.parcelado)} color="warning" />
        <KPI icon={<Wallet className="w-4 h-4" />} label="Total do Mês" value={brl(totalGeral)} hint={`+ Únicos ${brl(totals.unico)}`} color="destructive" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Chart by category */}
        <Card className="p-3 xl:col-span-2 shadow-card">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Custos por Categoria — {ym}</h3>
          {porCategoria.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Sem custos no mês.</p>
          ) : (
            <div className="h-44">
              <ResponsiveContainer>
                <BarChart data={porCategoria} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={32} />
                  <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Próximos vencimentos */}
        <Card className="p-3 shadow-card">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Próximos Vencimentos</h3>
          {proximos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nenhum vencimento em 14 dias.</p>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-y-auto">
              {proximos.map(({ c, due }) => (
                <li key={c.id} className="flex items-center gap-2 text-xs border-b border-border/50 pb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.descricao}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtDate(due!)} · {tipoLabel[c.tipo]}</div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">{brl(Number(c.valor))}</div>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-success" onClick={() => pagarParcela(c)} title="Marcar pago">
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* TABS */}
      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos">
          <Card className="p-3 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">Descrição</th>
                    <th className="text-left py-2 px-2">Categoria</th>
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-right py-2 px-2">Valor</th>
                    <th className="text-center py-2 px-2">Início</th>
                    <th className="text-center py-2 px-2">Vence</th>
                    <th className="text-center py-2 px-2">Status</th>
                    <th className="text-right py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {costs.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum custo cadastrado.</td></tr>
                  )}
                  {costs.map(c => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 px-2 font-medium">
                        <button onClick={() => openEdit(c)} className="hover:underline text-left">{c.descricao}</button>
                        {c.observacao && <div className="text-[10px] text-muted-foreground">{c.observacao}</div>}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{catName(c.category_id)}</td>
                      <td className="py-2 px-2">
                        <Badge variant={c.tipo === "fixo" ? "secondary" : c.tipo === "parcelado" ? "default" : "outline"} className="text-[10px]">
                          {tipoLabel[c.tipo]}
                          {c.tipo === "parcelado" && ` ${c.parcelas_pagas}/${c.parcelas_total}`}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold whitespace-nowrap">{brl(Number(c.valor))}</td>
                      <td className="py-2 px-2 text-center text-muted-foreground whitespace-nowrap">{fmtDate(c.data_inicio)}</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—"}</td>
                      <td className="py-2 px-2 text-center">
                        {!c.ativo ? <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                          : c.tipo === "unico" ? (c.pago ? <Badge className="bg-success/15 text-success text-[10px]">Pago</Badge> : <Badge className="bg-warning/15 text-warning-foreground text-[10px]">Pendente</Badge>)
                          : c.tipo === "parcelado" && (c.parcelas_pagas >= (c.parcelas_total || 0)) ? <Badge className="bg-success/15 text-success text-[10px]">Quitado</Badge>
                          : <Badge className="bg-success/15 text-success text-[10px]">Ativo</Badge>}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        {(c.tipo === "parcelado" && c.parcelas_pagas < (c.parcelas_total || 0)) || (c.tipo === "unico" && !c.pago) ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success" onClick={() => pagarParcela(c)} title="Pagar"><Check className="w-3.5 h-3.5" /></Button>
                        ) : null}
                        {c.tipo === "fixo" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleAtivo(c)} title={c.ativo ? "Desativar" : "Ativar"}><Power className="w-3.5 h-3.5" /></Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(c.id)} title="Excluir"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card className="p-3 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Categorias</h3>
              <Dialog open={openCat} onOpenChange={setOpenCat}>
                <DialogTrigger asChild><Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> Nova</Button></DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nome</Label><Input value={newCat.nome} onChange={e => setNewCat({ ...newCat, nome: e.target.value })} /></div>
                    <div>
                      <Label>Tipo padrão</Label>
                      <Select value={newCat.tipo_padrao} onValueChange={v => setNewCat({ ...newCat, tipo_padrao: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixo">Fixo</SelectItem>
                          <SelectItem value="variavel">Variável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={saveCat} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {cats.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem categorias. Crie uma para organizar os custos.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {cats.map(c => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{c.nome}</div>
                      <div className="text-[10px] uppercase text-muted-foreground">{c.tipo_padrao}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeCat(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="folha">
          <Card className="p-3 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Folha de Pagamento</h3>
                <p className="text-xs text-muted-foreground">Calculada a partir dos funcionários ativos</p>
              </div>
              <Link to="/funcionarios" className="text-xs text-primary font-semibold hover:underline">Gerenciar funcionários</Link>
            </div>
            {emps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum funcionário ativo.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {emps.map(e => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{e.nome}</span>
                    <span className="font-semibold">{brl(Number(e.salario))}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2 font-bold border-t-2 border-border mt-1">
                  <span>Total</span><span>{brl(folha)}</span>
                </li>
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Novo / Editar */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar custo" : "Novo custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label>Descrição</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Aluguel galpão" /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v: CostType) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Fixo (mensal)</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    <SelectItem value="unico">Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category_id || "_none"} onValueChange={v => setForm({ ...form, category_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem categoria</SelectItem>
                    {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>{form.tipo === "unico" ? "Data" : "Início"}</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></div>
              {form.tipo !== "unico" && (
                <div><Label>Dia de vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })} /></div>
              )}
              {form.tipo === "parcelado" && (
                <div><Label>Total de parcelas</Label><Input type="number" min="1" value={form.parcelas_total} onChange={e => setForm({ ...form, parcelas_total: e.target.value })} /></div>
              )}
              <div className="col-span-2"><Label>Observação</Label><Input value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="w-full">{editId ? "Salvar alterações" : "Cadastrar custo"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPI({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint?: string; color: "primary" | "success" | "warning" | "destructive" }) {
  const map = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="p-3 glass shadow-card">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${map[color]}`}>{icon}</div>
        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</div>
      </div>
      <div className="text-xl font-black tracking-tighter mt-2">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
