// Helper to compute receivables based on client payment terms
export type Client = {
  id: string;
  tipo_condicao: "DIAS" | "FIXO";
  dias?: string | null;
  dia_corte?: number | null;
  dia_pagamento_1?: number | null;
  dia_pagamento_2?: number | null;
};

export type ReceivableInput = {
  vencimento: string; // YYYY-MM-DD
  valor: number;
  parcela: number;
};

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function lastDayOfMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function clampDay(year: number, month: number, day: number) {
  return Math.min(day, lastDayOfMonth(year, month));
}

export function computeReceivables(client: Client, dataFaturamento: string, valor: number): ReceivableInput[] {
  const base = new Date(dataFaturamento + "T00:00:00");

  if (client.tipo_condicao === "DIAS") {
    const raw = (client.dias || "30").split("/").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const parcels = raw.length ? raw : [30];
    const valorParcela = +(valor / parcels.length).toFixed(2);
    let acc = 0;
    return parcels.map((d, i) => {
      const v = i === parcels.length - 1 ? +(valor - acc).toFixed(2) : valorParcela;
      acc += v;
      return { vencimento: toISO(addDays(base, d)), valor: v, parcela: i + 1 };
    });
  }

  // FIXO
  const corte = client.dia_corte || 15;
  const pay1 = client.dia_pagamento_1 || 25;
  const pay2 = client.dia_pagamento_2;
  const day = base.getDate();
  let year = base.getFullYear();
  let month = base.getMonth();

  let payYear = year, payMonth = month, payDay = pay1;
  if (day > corte) {
    // próximo mês
    payMonth += 1;
    if (payMonth > 11) { payMonth = 0; payYear += 1; }
    payDay = pay2 || pay1;
  }
  payDay = clampDay(payYear, payMonth, payDay);
  return [{ vencimento: `${payYear}-${pad(payMonth + 1)}-${pad(payDay)}`, valor: +valor.toFixed(2), parcela: 1 }];
}
