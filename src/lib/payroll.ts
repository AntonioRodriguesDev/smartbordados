export type PayrollEmp = {
  ciclo?: string | null;
  ciclo_dia_1?: number | null;
  ciclo_dia_2?: number | null;
  tipo_pagamento?: string | null;
  valor_hora?: number | null;
  valor_peca?: number | null;
};

export type Periodo = { inicio: string; fim: string; label: string };

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

export function unitValue(emp: PayrollEmp) {
  return emp.tipo_pagamento === "peca" ? Number(emp.valor_peca || 0) : Number(emp.valor_hora || 0);
}

export function unitLabel(emp: PayrollEmp) {
  return emp.tipo_pagamento === "peca" ? "peças" : "horas";
}
