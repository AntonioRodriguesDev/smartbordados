export type TipoPagamento = "hora" | "peca" | "diaria" | "mensal";

export type PayrollEmp = {
  ciclo?: string | null;
  ciclo_dia_1?: number | null;
  ciclo_dia_2?: number | null;
  tipo_pagamento?: string | null;
  valor_hora?: number | null;
  valor_peca?: number | null;
  valor_diaria?: number | null;
  valor_mensal?: number | null;
  salario?: number | null;
};

export type PayrollEntry = {
  data: string;
  horas?: number | null;
  pecas?: number | null;
  dias?: number | null;
  valor_unitario?: number | null;
};

export type Periodo = { inicio: string; fim: string; label: string };

export const TIPOS: { value: TipoPagamento; label: string }[] = [
  { value: "hora", label: "Por hora" },
  { value: "peca", label: "Por peça" },
  { value: "diaria", label: "Por diária" },
  { value: "mensal", label: "Mensal fixo" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Períodos de fechamento do funcionário para um mês (1-based). */
export function periodsForMonth(emp: PayrollEmp, y: number, m: number): Periodo[] {
  const ld = lastDay(y, m);
  const ciclo = emp.ciclo || "quinzenal";
  if (ciclo === "mensal") {
    return [{ inicio: iso(y, m, 1), fim: iso(y, m, ld), label: `01 a ${pad(ld)}` }];
  }
  const d1 = Math.min(Math.max(Number(emp.ciclo_dia_1 || 15), 1), ld - 1);
  const d2 = Math.min(Math.max(Number(emp.ciclo_dia_2 || ld), d1 + 1), ld);
  return [
    { inicio: iso(y, m, 1), fim: iso(y, m, d1), label: `01 a ${pad(d1)}` },
    { inicio: iso(y, m, d1 + 1), fim: iso(y, m, d2), label: `${pad(d1 + 1)} a ${pad(d2)}` },
  ];
}

/** Índice do período que contém a data informada. */
export function periodIndexFor(periods: Periodo[], dateISO: string) {
  const i = periods.findIndex(p => dateISO >= p.inicio && dateISO <= p.fim);
  return i < 0 ? periods.length - 1 : i;
}

export function tipoOf(emp: PayrollEmp): TipoPagamento {
  const t = (emp.tipo_pagamento || "hora") as TipoPagamento;
  return TIPOS.some(x => x.value === t) ? t : "hora";
}

/** Valor unitário padrão do funcionário conforme o tipo de pagamento. */
export function unitValue(emp: PayrollEmp) {
  switch (tipoOf(emp)) {
    case "peca": return Number(emp.valor_peca || 0);
    case "diaria": return Number(emp.valor_diaria || 0);
    case "mensal": return Number(emp.valor_mensal || emp.salario || 0);
    default: return Number(emp.valor_hora || 0);
  }
}

export function unitLabel(emp: PayrollEmp) {
  switch (tipoOf(emp)) {
    case "peca": return "peças";
    case "diaria": return "dias";
    case "mensal": return "mês";
    default: return "horas";
  }
}

export function unitSingular(emp: PayrollEmp) {
  switch (tipoOf(emp)) {
    case "peca": return "peça";
    case "diaria": return "dia";
    case "mensal": return "mês";
    default: return "hora";
  }
}

/** Precisa de apontamentos diários? (mensal não precisa) */
export function usesEntries(emp: PayrollEmp) {
  return tipoOf(emp) !== "mensal";
}

/** Quantidade registrada em um apontamento, conforme o tipo do funcionário. */
export function entryQty(emp: PayrollEmp, e: PayrollEntry) {
  switch (tipoOf(emp)) {
    case "peca": return Number(e.pecas || 0);
    case "diaria": return Number(e.dias || 0);
    case "mensal": return 0;
    default: return Number(e.horas || 0);
  }
}

/** Valor unitário do apontamento (sobrepõe o padrão quando informado). */
export function entryUnit(emp: PayrollEmp, e: PayrollEntry) {
  const v = Number(e.valor_unitario || 0);
  return v > 0 ? v : unitValue(emp);
}

export function entryTotal(emp: PayrollEmp, e: PayrollEntry) {
  return entryQty(emp, e) * entryUnit(emp, e);
}

/** Monta o payload de quantidade para gravar um apontamento. */
export function qtyPayload(emp: PayrollEmp, qtd: number) {
  const t = tipoOf(emp);
  return {
    horas: t === "hora" ? qtd : 0,
    pecas: t === "peca" ? qtd : 0,
    dias: t === "diaria" ? qtd : 0,
  };
}

/** Bruto do período: soma dos apontamentos ou valor fixo rateado (mensal). */
export function brutoPeriodo(emp: PayrollEmp, entries: PayrollEntry[], periodsNoMes: number) {
  if (tipoOf(emp) === "mensal") {
    const fixo = unitValue(emp);
    return periodsNoMes > 1 ? fixo / periodsNoMes : fixo;
  }
  return entries.reduce((s, e) => s + entryTotal(emp, e), 0);
}

/** Converte horas decimais em "8h30". */
export function hhmm(qtd: number) {
  const total = Math.round(Number(qtd || 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

/** Exibição da quantidade conforme o tipo de pagamento. */
export function fmtQty(emp: PayrollEmp, qtd: number) {
  if (tipoOf(emp) === "hora") return hhmm(qtd);
  const n = Number(qtd || 0);
  return String(Number.isInteger(n) ? n : n.toFixed(2).replace(".", ","));
}

/** Gera as parcelas de um empréstimo, uma por mês a partir da data inicial. */
export function buildInstallments(dataInicio: string, parcelas: number, valorParcela: number) {
  const [y, m, d] = dataInicio.split("-").map(Number);
  const out: { numero: number; valor: number; competencia: string }[] = [];
  for (let i = 0; i < parcelas; i++) {
    const dt = new Date(y, m - 1 + i, 1);
    const yy = dt.getFullYear();
    const mm = dt.getMonth() + 1;
    const dd = Math.min(d, lastDay(yy, mm));
    out.push({ numero: i + 1, valor: valorParcela, competencia: iso(yy, mm, dd) });
  }
  return out;
}
