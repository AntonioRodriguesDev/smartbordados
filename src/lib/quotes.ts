export type QuoteStatus =
  | "rascunho"
  | "enviado"
  | "negociacao"
  | "aprovado"
  | "reprovado"
  | "sem_retorno"
  | "cancelado";

export const STATUS: { value: QuoteStatus; label: string; badge: string; dot: string }[] = [
  { value: "rascunho", label: "Rascunho", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  { value: "enviado", label: "Enviado", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  { value: "negociacao", label: "Em negociação", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  { value: "aprovado", label: "Aprovado", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  { value: "reprovado", label: "Reprovado", badge: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  { value: "sem_retorno", label: "Sem retorno", badge: "bg-slate-500/15 text-slate-600 dark:text-slate-300", dot: "bg-slate-500" },
  { value: "cancelado", label: "Cancelado", badge: "bg-zinc-500/15 text-zinc-500", dot: "bg-zinc-500" },
];

export const statusInfo = (s: string) =>
  STATUS.find(x => x.value === s) || STATUS[0];

export const OPEN_STATUSES: string[] = ["rascunho", "enviado", "negociacao"];

export const MOTIVOS = [
  "Preço",
  "Prazo de entrega",
  "Concorrência",
  "Projeto cancelado",
  "Sem verba",
  "Qualidade/amostra",
  "Outro",
];

export const nextNumero = (numeros: string[]) => {
  const nums = numeros
    .map(n => parseInt(String(n).replace(/\D/g, ""), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(4, "0");
};
