import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Cake, Wallet, Banknote, Search, Pencil, Trash2, Star, Bell } from "lucide-react";
import { brl, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";

const SETORES = ["Corte", "Bordado", "Chanfrado", "Separação", "Acabamento", "Revisão", "Administrativo"];
const HABILIDADES = ["Corte", "Bordado", "Chanfrado", "Separação", "Acabamento", "Revisão"];

const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

function daysUntilBirthday(iso?: string | null) {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [, m, d] = iso.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function nextPayDate(dia?: number | null) {
  const d = dia || 5;
  const today = new Date();
  let next = new Date(today.getFullYear(), today.getMonth(), d);
  if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, d);
  return next.toISOString().slice(0, 10);
}

const emptyEmp = {
  nome: "", cpf: "", telefone: "", email: "", endereco: "",
  data_nascimento: "", data_admissao: "", cargo: "", setor: "Corte",
  salario: "", dia_pagamento: 5, status: "ativo", observacoes: "",
};

export default function Funcionarios() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [vales, setVales] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyEmp);
  const [valeOpen, setValeOpen] = useState(false);
  const [valeForm, setValeForm] = useState({ valor: "", data: todayISO(), descricao: "" });
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillForm, setSkillForm] = useState({ nome: "Corte", nivel: 3 });
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ valor: "", data: todayISO(), tipo: "adiantamento", observacao: "", quitarVales: false });

  const load = async () => {
    const [e, s, v, p] = await Promise.all([
      supabase.from("employees").select("*").order("nome"),
      supabase.from("employee_skills").select("*"),
      supabase.from("employee_vales").select("*").order("data", { ascending: false }),
      supabase.from("employee_payments").select("*").order("data_pagamento", { ascending: false }),
    ]);
    setEmployees(e.data || []);
    setSkills(s.data || []);
    setVales(v.data || []);
    setPayments(p.data || []);
    if (!selectedId && e.data && e.data.length > 0) setSelectedId(e.data[0].id);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => employees.filter(e => {
    if (search && !e.nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (setorFilter !== "todos" && e.setor !== setorFilter) return false;
    if (statusFilter !== "todos" && e.status !== statusFilter) return false;
    return true;
  }), [employees, search, setorFilter, statusFilter]);

  const selected = employees.find(e => e.id === selectedId) || null;
  const selSkills = skills.filter(s => s.employee_id === selectedId);
  const selVales = vales.filter(v => v.employee_id === selectedId);
  const selPayments = payments.filter(p => p.employee_id === selectedId);

  // Stats
  const ativos = employees.filter(e => e.status === "ativo");
  const folhaMes = ativos.reduce((s, e) => s + Number(e.salario || 0), 0);
  const mesAtual = new Date().toISOString().slice(0, 7);
  const valesMes = vales.filter(v => v.data?.startsWith(mesAtual));
  const totalValesMes = valesMes.reduce((s, v) => s + Number(v.valor), 0);

  const aniversariantes = employees
    .map(e => ({ ...e, dias: daysUntilBirthday(e.data_nascimento) }))
    .filter(e => e.dias !== null && e.dias <= 30)
    .sort((a, b) => (a.dias! - b.dias!));

  const proxPagamentos = ativos
    .map(e => ({ ...e, prox: nextPayDate(e.dia_pagamento) }))
    .sort((a, b) => a.prox.localeCompare(b.prox))
    .slice(0, 5);

  const valeSaldo = (id: string) => vales.filter(v => v.employee_id === id && !v.quitado).reduce((s, v) => s + Number(v.valor), 0);
  const pagoNoMes = (id: string) => payments.filter(p => p.employee_id === id && p.data_pagamento?.startsWith(mesAtual)).reduce((s, p) => s + Number(p.valor), 0);
  const selPagoMes = selected ? pagoNoMes(selected.id) : 0;
  const totalReceber = selected ? Math.max(Number(selected.salario || 0) - selPagoMes - valeSaldo(selected.id), 0) : 0;

  // CRUD
  const openNew = () => { setEditingId(null); setForm(emptyEmp); setOpen(true); };
  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      nome: e.nome || "", cpf: e.cpf || "", telefone: e.telefone || "", email: e.email || "",
      endereco: e.endereco || "", data_nascimento: e.data_nascimento || "", data_admissao: e.data_admissao || "",
      cargo: e.cargo || "", setor: e.setor || "Corte", salario: e.salario || "",
      dia_pagamento: e.dia_pagamento || 5, status: e.status || "ativo", observacoes: e.observacoes || "",
    });
    setOpen(true);
  };
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      ...form,
      salario: Number(form.salario || 0),
      dia_pagamento: Number(form.dia_pagamento || 5),
      data_nascimento: form.data_nascimento || null,
      data_admissao: form.data_admissao || null,
    };
    let error;
    if (editingId) ({ error } = await supabase.from("employees").update(payload).eq("id", editingId));
    else ({ error } = await supabase.from("employees").insert({ ...payload, user_id: user.id }));
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Atualizado!" : "Funcionário cadastrado!");
    setOpen(false); load();
  };

  const removeEmp = async (id: string) => {
    if (!confirm("Excluir funcionário e todos os registros?")) return;
    await supabase.from("employee_skills").delete().eq("employee_id", id);
    await supabase.from("employee_vales").delete().eq("employee_id", id);
    await supabase.from("employee_payments").delete().eq("employee_id", id);
    await supabase.from("employees").delete().eq("id", id);
    toast.success("Removido");
    setSelectedId(null);
    load();
  };

  const addVale = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("employee_vales").insert({
      user_id: user.id, employee_id: selected.id,
      valor: Number(valeForm.valor), data: valeForm.data, descricao: valeForm.descricao || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Vale lançado");
    setValeOpen(false); setValeForm({ valor: "", data: todayISO(), descricao: "" });
    load();
  };

  const removeVale = async (id: string) => {
    await supabase.from("employee_vales").delete().eq("id", id);
    load();
  };

  const addSkill = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("employee_skills").insert({
      user_id: user.id, employee_id: selected.id, nome: skillForm.nome, nivel: skillForm.nivel,
    });
    if (error) return toast.error(error.message);
    setSkillOpen(false); setSkillForm({ nome: "Corte", nivel: 3 });
    load();
  };

  const removeSkill = async (id: string) => {
    await supabase.from("employee_skills").delete().eq("id", id);
    load();
  };

  const submitPayment = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const valor = Number(payForm.valor);
    if (!valor || valor <= 0) return toast.error("Informe um valor válido");
    const { error } = await supabase.from("employee_payments").insert({
      user_id: user.id, employee_id: selected.id, valor,
      data_pagamento: payForm.data, tipo: payForm.tipo, observacao: payForm.observacao || null,
    });
    if (error) return toast.error(error.message);
    if (payForm.quitarVales) {
      await supabase.from("employee_vales").update({ quitado: true }).eq("employee_id", selected.id).eq("quitado", false);
    }
    toast.success("Pagamento registrado");
    setPayOpen(false);
    setPayForm({ valor: "", data: todayISO(), tipo: "adiantamento", observacao: "", quitarVales: false });
    load();
  };

  const removePayment = async (id: string) => {
    if (!confirm("Excluir este pagamento?")) return;
    await supabase.from("employee_payments").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Funcionários</h1>
          <p className="text-muted-foreground text-sm">Gerencie equipe, pagamentos, vales e habilidades</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Nome</Label><Input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
              </div>
              <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Nascimento</Label><Input type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} /></div>
                <div><Label>Admissão</Label><Input type="date" value={form.data_admissao} onChange={e => setForm({ ...form, data_admissao: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} /></div>
                <div>
                  <Label>Setor</Label>
                  <Select value={form.setor} onValueChange={v => setForm({ ...form, setor: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Salário</Label><Input type="number" step="0.01" value={form.salario} onChange={e => setForm({ ...form, salario: e.target.value })} /></div>
                <div><Label>Dia pgto.</Label><Input type="number" min={1} max={31} value={form.dia_pagamento} onChange={e => setForm({ ...form, dia_pagamento: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
              <Button type="submit" className="w-full" size="lg">Salvar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Top cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 shadow-card gradient-rose text-primary-foreground border-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90"><Users className="w-4 h-4" /> Total de funcionários</div>
          <div className="text-3xl font-bold mt-2">{ativos.length}</div>
          <div className="text-xs opacity-90">Ativos · {employees.length} no total</div>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Cake className="w-4 h-4" /> Aniversariantes</div>
          <div className="text-3xl font-bold mt-2">{aniversariantes.length}</div>
          <div className="text-xs text-muted-foreground">Próximos 30 dias</div>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Banknote className="w-4 h-4" /> Folha do mês</div>
          <div className="text-2xl font-bold mt-2">{brl(folhaMes)}</div>
          <div className="text-xs text-muted-foreground">Custo total da equipe</div>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground"><Wallet className="w-4 h-4" /> Vales do mês</div>
          <div className="text-2xl font-bold mt-2">{brl(totalValesMes)}</div>
          <div className="text-xs text-muted-foreground">{valesMes.length} lançamento(s)</div>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Coluna 1 - lista */}
        <Card className="p-4 shadow-card lg:col-span-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input placeholder="Buscar funcionário..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={setorFilter} onValueChange={setSetorFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos setores</SelectItem>
                {SETORES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
            {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Nenhum funcionário.</p>}
            {filtered.map(e => {
              const dias = daysUntilBirthday(e.data_nascimento);
              return (
                <button key={e.id} onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all ${selectedId === e.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary/60"}`}>
                  <Avatar className="h-10 w-10"><AvatarFallback className="gradient-primary text-primary-foreground text-xs font-semibold">{initials(e.nome)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.setor}{e.cargo ? ` · ${e.cargo}` : ""}</div>
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground">
                    {e.data_nascimento && <div>🎂 {dias === 0 ? "Hoje" : `${dias}d`}</div>}
                    <div>Pgto {String(e.dia_pagamento || 5).padStart(2, "0")}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Coluna 2 - detalhes */}
        <Card className="p-4 shadow-card lg:col-span-5 space-y-4">
          {!selected ? (
            <p className="text-center text-muted-foreground py-12">Selecione um funcionário</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14"><AvatarFallback className="gradient-primary text-primary-foreground font-semibold">{initials(selected.nome)}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{selected.nome}</h2>
                    <Badge variant={selected.status === "ativo" ? "default" : "secondary"}>{selected.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.cargo || "—"} · {selected.setor}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(selected)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
                <Button variant="ghost" size="icon" onClick={() => removeEmp(selected.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>

              {/* Mini cards financeiros */}
              <div className="grid grid-cols-4 gap-2">
                <Card className="p-3 bg-secondary/40 border-0">
                  <div className="text-[10px] uppercase text-muted-foreground">Salário</div>
                  <div className="font-semibold text-sm">{brl(Number(selected.salario || 0))}</div>
                </Card>
                <Card className="p-3 bg-secondary/40 border-0">
                  <div className="text-[10px] uppercase text-muted-foreground">Pago no mês</div>
                  <div className="font-semibold text-sm text-success">{brl(selPagoMes)}</div>
                </Card>
                <Card className="p-3 bg-secondary/40 border-0">
                  <div className="text-[10px] uppercase text-muted-foreground">Vales abertos</div>
                  <div className="font-semibold text-sm text-warning">{brl(valeSaldo(selected.id))}</div>
                </Card>
                <Card className="p-3 gradient-primary text-primary-foreground border-0">
                  <div className="text-[10px] uppercase opacity-90">Saldo a pagar</div>
                  <div className="font-semibold text-sm">{brl(totalReceber)}</div>
                </Card>
              </div>

              <Tabs defaultValue="dados">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
                  <TabsTrigger value="vales">Vales</TabsTrigger>
                  <TabsTrigger value="habilidades">Habilidades</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-2 text-sm pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CPF" v={selected.cpf} />
                    <Field label="Telefone" v={selected.telefone} />
                    <Field label="E-mail" v={selected.email} />
                    <Field label="Nascimento" v={selected.data_nascimento ? fmtDate(selected.data_nascimento) : null} />
                    <Field label="Admissão" v={selected.data_admissao ? fmtDate(selected.data_admissao) : null} />
                    <Field label="Endereço" v={selected.endereco} />
                  </div>
                </TabsContent>

                <TabsContent value="pagamento" className="space-y-3 pt-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <div className="text-muted-foreground text-xs">Pagamentos do mês ({selPayments.filter(p => p.data_pagamento?.startsWith(mesAtual)).length})</div>
                      <div className="font-semibold">Saldo restante: <span className="text-primary">{brl(totalReceber)}</span></div>
                    </div>
                    <Dialog open={payOpen} onOpenChange={setPayOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" onClick={() => setPayForm({ valor: "", data: todayISO(), tipo: "adiantamento", observacao: "", quitarVales: false })}>
                          <Plus className="w-4 h-4 mr-1" /> Registrar pagamento
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
                        <form onSubmit={submitPayment} className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Tipo</Label>
                              <Select value={payForm.tipo} onValueChange={v => setPayForm({ ...payForm, tipo: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="adiantamento">Adiantamento</SelectItem>
                                  <SelectItem value="salario">Salário</SelectItem>
                                  <SelectItem value="bonus">Bônus</SelectItem>
                                  <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Data</Label>
                              <Input type="date" required value={payForm.data} onChange={e => setPayForm({ ...payForm, data: e.target.value })} />
                            </div>
                          </div>
                          <div>
                            <Label>Valor</Label>
                            <Input type="number" step="0.01" required value={payForm.valor} onChange={e => setPayForm({ ...payForm, valor: e.target.value })} placeholder={brl(totalReceber)} />
                            <div className="flex gap-1 mt-1">
                              <Button type="button" variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setPayForm({ ...payForm, valor: String(totalReceber.toFixed(2)) })}>Saldo</Button>
                              <Button type="button" variant="outline" size="sm" className="text-[10px] h-6" onClick={() => setPayForm({ ...payForm, valor: (Number(selected.salario || 0) / 2).toFixed(2) })}>½ salário</Button>
                            </div>
                          </div>
                          <div><Label>Observação</Label><Input value={payForm.observacao} onChange={e => setPayForm({ ...payForm, observacao: e.target.value })} /></div>
                          {valeSaldo(selected.id) > 0 && (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input type="checkbox" checked={payForm.quitarVales} onChange={e => setPayForm({ ...payForm, quitarVales: e.target.checked })} />
                              Quitar vales abertos ({brl(valeSaldo(selected.id))})
                            </label>
                          )}
                          <Button type="submit" className="w-full">Salvar pagamento</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selPayments.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico ainda.</p>}
                    {selPayments.map(p => (
                      <div key={p.id} className="flex justify-between items-center p-2 rounded bg-secondary/40 text-sm">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">{fmtDate(p.data_pagamento)} <Badge variant="secondary" className="text-[10px]">{p.tipo}</Badge></div>
                          {p.observacao && <div className="text-[10px] text-muted-foreground truncate">{p.observacao}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{brl(Number(p.valor))}</span>
                          <Button variant="ghost" size="icon" onClick={() => removePayment(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="vales" className="space-y-3 pt-3">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">Saldo aberto: <strong className="text-warning">{brl(valeSaldo(selected.id))}</strong></div>
                    <Dialog open={valeOpen} onOpenChange={setValeOpen}>
                      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Lançar vale</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Novo vale</DialogTitle></DialogHeader>
                        <form onSubmit={addVale} className="space-y-3">
                          <div><Label>Valor</Label><Input type="number" step="0.01" required value={valeForm.valor} onChange={e => setValeForm({ ...valeForm, valor: e.target.value })} /></div>
                          <div><Label>Data</Label><Input type="date" required value={valeForm.data} onChange={e => setValeForm({ ...valeForm, data: e.target.value })} /></div>
                          <div><Label>Descrição</Label><Input value={valeForm.descricao} onChange={e => setValeForm({ ...valeForm, descricao: e.target.value })} /></div>
                          <Button type="submit" className="w-full">Salvar</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="space-y-1">
                    {selVales.length === 0 && <p className="text-xs text-muted-foreground">Nenhum vale.</p>}
                    {selVales.map(v => (
                      <div key={v.id} className="flex justify-between items-center p-2 rounded bg-secondary/40 text-sm">
                        <div>
                          <div>{fmtDate(v.data)} {v.descricao && <span className="text-muted-foreground">· {v.descricao}</span>}</div>
                          {v.quitado && <Badge variant="secondary" className="text-[10px] mt-0.5">Quitado</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{brl(Number(v.valor))}</span>
                          <Button variant="ghost" size="icon" onClick={() => removeVale(v.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="habilidades" className="space-y-3 pt-3">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">{selSkills.length} habilidade(s)</div>
                    <Dialog open={skillOpen} onOpenChange={setSkillOpen}>
                      <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Adicionar</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Nova habilidade</DialogTitle></DialogHeader>
                        <form onSubmit={addSkill} className="space-y-3">
                          <div>
                            <Label>Habilidade</Label>
                            <Select value={skillForm.nome} onValueChange={v => setSkillForm({ ...skillForm, nome: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{HABILIDADES.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Nível (1-5)</Label>
                            <Input type="number" min={1} max={5} value={skillForm.nivel} onChange={e => setSkillForm({ ...skillForm, nivel: Number(e.target.value) })} />
                          </div>
                          <Button type="submit" className="w-full">Salvar</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selSkills.length === 0 && <p className="text-xs text-muted-foreground">Sem habilidades cadastradas.</p>}
                    {selSkills.map(s => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-sm group">
                        <span className="font-medium">{s.nome}</span>
                        <span className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < s.nivel ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
                          ))}
                        </span>
                        <button onClick={() => removeSkill(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="hist" className="pt-3 text-sm">
                  <div className="text-muted-foreground text-xs mb-2">Observações</div>
                  <p className="text-sm whitespace-pre-wrap">{selected.observacoes || "—"}</p>
                </TabsContent>
              </Tabs>
            </>
          )}
        </Card>

        {/* Coluna 3 - alertas */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3"><Cake className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Aniversariantes</h3></div>
            <div className="space-y-2">
              {aniversariantes.length === 0 && <p className="text-xs text-muted-foreground">Nenhum nos próximos 30 dias.</p>}
              {aniversariantes.slice(0, 5).map(e => (
                <button key={e.id} onClick={() => setSelectedId(e.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 text-left">
                  <Avatar className="h-8 w-8"><AvatarFallback className="gradient-rose text-primary-foreground text-[10px]">{initials(e.nome)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{e.dias === 0 ? "Hoje 🎉" : `Em ${e.dias} dias`}</div>
                  </div>
                  <div className="text-xs font-semibold">{e.data_nascimento?.slice(8, 10)}/{e.data_nascimento?.slice(5, 7)}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3"><Wallet className="w-4 h-4 text-accent" /><h3 className="font-semibold text-sm">Próximos pagamentos</h3></div>
            <div className="space-y-2">
              {proxPagamentos.length === 0 && <p className="text-xs text-muted-foreground">Sem registros.</p>}
              {proxPagamentos.map(e => (
                <button key={e.id} onClick={() => setSelectedId(e.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 text-left">
                  <Avatar className="h-8 w-8"><AvatarFallback className="gradient-gold text-primary-foreground text-[10px]">{initials(e.nome)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtDate(e.prox)}</div>
                  </div>
                  <div className="text-xs font-semibold text-success">{brl(Number(e.salario || 0))}</div>
                </button>
              ))}
            </div>
          </Card>

          {employees.some(e => !skills.find(s => s.employee_id === e.id)) && (
            <Card className="p-3 shadow-card border-warning/40 bg-warning/5">
              <div className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-warning mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold">Atenção</div>
                  <div className="text-muted-foreground">Há funcionários sem habilidades cadastradas.</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, v }: { label: string; v?: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{v || "—"}</div>
    </div>
  );
}
