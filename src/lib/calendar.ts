// Calendário de trabalho: dias úteis configuráveis + feriados
export const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5]; // Seg-Sex

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function businessDaysInMonth(
  year: number,
  month0: number,
  untilDay?: number,
  weekdays: number[] = DEFAULT_WEEKDAYS,
  holidays: Set<string> = new Set(),
) {
  const last = new Date(year, month0 + 1, 0).getDate();
  const stop = untilDay ?? last;
  const wd = new Set(weekdays);
  let count = 0;
  for (let d = 1; d <= stop; d++) {
    const date = new Date(year, month0, d);
    const iso = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (wd.has(date.getDay()) && !holidays.has(iso)) count++;
  }
  return count;
}
