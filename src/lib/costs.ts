export type CostType = "fixo" | "parcelado" | "unico";

export type CostRow = {
  id: string;
  category_id: string | null;
  descricao: string;
  tipo: CostType;
  valor: number;
  data_inicio: string; // YYYY-MM-DD
  dia_vencimento: number | null;
  parcelas_total: number | null;
  parcelas_pagas: number;
  ativo: boolean;
  pago: boolean;
  observacao: string | null;
};

/** Returns whether the cost contributes to the given month (YYYY-MM). */
export function costAppliesToMonth(c: CostRow, ym: string): boolean {
  const start = c.data_inicio.slice(0, 7);
  if (c.tipo === "unico") return start === ym;
  if (start > ym) return false;
  if (c.tipo === "fixo") return c.ativo;
  if (c.tipo === "parcelado") {
    const total = c.parcelas_total ?? 0;
    if (total <= 0) return false;
    // months elapsed from start (inclusive) to ym
    const [sy, sm] = start.split("-").map(Number);
    const [y, m] = ym.split("-").map(Number);
    const idx = (y - sy) * 12 + (m - sm); // 0-based parcela index
    return idx >= 0 && idx < total;
  }
  return false;
}

/** Sum of costs for a month, optionally including employee payroll. */
export function sumCostsForMonth(costs: CostRow[], ym: string) {
  let fixo = 0, parcelado = 0, unico = 0;
  for (const c of costs) {
    if (!costAppliesToMonth(c, ym)) continue;
    const v = Number(c.valor) || 0;
    if (c.tipo === "fixo") fixo += v;
    else if (c.tipo === "parcelado") parcelado += v;
    else unico += v;
  }
  return { fixo, parcelado, unico, total: fixo + parcelado + unico };
}

/** Next due date (YYYY-MM-DD) for a recurring cost in current/next month. */
export function nextDueDate(c: CostRow, today: Date = new Date()): string | null {
  if (c.tipo === "unico") {
    return c.pago ? null : c.data_inicio;
  }
  const dia = c.dia_vencimento ?? 0;
  if (!dia) return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const day = Math.min(dia, last);
  let cand = new Date(y, m, day);
  if (cand < new Date(y, today.getMonth(), today.getDate())) {
    const nm = m + 1;
    const nlast = new Date(y, nm + 1, 0).getDate();
    cand = new Date(y, nm, Math.min(dia, nlast));
  }
  if (c.tipo === "parcelado") {
    if ((c.parcelas_pagas ?? 0) >= (c.parcelas_total ?? 0)) return null;
  }
  const iso = `${cand.getFullYear()}-${String(cand.getMonth() + 1).padStart(2, "0")}-${String(cand.getDate()).padStart(2, "0")}`;
  return iso;
}

export function daysUntilBirthday(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [, m, d] = iso.split("-").map(Number);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}
