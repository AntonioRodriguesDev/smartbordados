// Parse Brazilian NF-e PDF (DANFE) to extract: numero, valor total, CNPJ destinatário
import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker import
// @ts-ignore
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

export type NFeData = {
  numero?: string;
  valor?: number;
  cnpjDestinatario?: string;
  dataEmissao?: string;
  rawText: string;
};

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export async function parseNFePdf(file: File): Promise<NFeData> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it: any) => it.str).join(" ") + "\n";
  }

  const text = fullText.replace(/\s+/g, " ");

  // Find ALL CNPJs in document
  const cnpjMatches = Array.from(text.matchAll(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/g)).map(m => m[1]);
  // Emitter (Smart Bordados) is usually the first one. Destinatário is a different CNPJ.
  // Strategy: pick the FIRST CNPJ that appears AFTER "DESTINATÁRIO" or "DESTINATARIO"
  let cnpjDestinatario: string | undefined;
  const destIdx = text.search(/DESTINAT[ÁA]RIO/i);
  if (destIdx >= 0) {
    const after = text.slice(destIdx);
    const m = after.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (m) cnpjDestinatario = m[1];
  }
  if (!cnpjDestinatario && cnpjMatches.length >= 2) {
    cnpjDestinatario = cnpjMatches[1];
  } else if (!cnpjDestinatario && cnpjMatches.length === 1) {
    cnpjDestinatario = cnpjMatches[0];
  }

  // Número da nota: look for "Nº 000750" or "n° NF-e 000750"
  let numero: string | undefined;
  const nMatch = text.match(/N[ºo°]?\s*0*(\d{3,9})\s*S[ée]rie/i)
              || text.match(/NF-?e\s+0*(\d{3,9})/i)
              || text.match(/N[UÚ]MERO[^0-9]{0,30}0*(\d{3,9})/i);
  if (nMatch) numero = nMatch[1];

  // Valor a cobrar (duplicata) — é o que importa para faturamento.
  let valor: number | undefined;
  const parseBR = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));
  const moneyRe = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

  // Strategy 1: DUPLICATAS (valor a cobrar real)
  const dupIdx = text.search(/DUPLICATAS?/i);
  if (dupIdx >= 0) {
    const after = text.slice(dupIdx);
    const stop = after.search(
      /C[ÁA]LCULO\s+DO\s+IMPOSTO|TRANSPORTAD|DADOS\s+DO\s+PRODUTO|DADOS\s+ADICIONAIS/i
    );
    const slice = stop > 0 ? after.slice(0, stop) : after.slice(0, 800);

    let match = slice.match(
      /DUPLICATAS[\s\S]*?VALOR[^0-9]{0,20}(\d{1,3}(?:\.\d{3})*,\d{2})/i
    );
    if (!match) {
      match = slice.match(/VALOR[^0-9]{0,20}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
    }
    if (!match) {
      match = slice.match(
        /\d{2}\/\d{2}\/\d{2,4}[^0-9]{0,20}(\d{1,3}(?:\.\d{3})*,\d{2})/
      );
    }
    if (match) {
      valor = parseBR(match[1]);
    }
  }

  // Strategy 2: VALOR TOTAL DA NOTA — the LAST money in the totals row block
  // (labels row appears first, then values row; total is the rightmost value).
  if (valor == null || valor === 0) {
    const labelIdx = text.search(/VALOR\s+TOTAL\s+DA\s+NOTA/i);
    if (labelIdx >= 0) {
      const after = text.slice(labelIdx);
      const stopMatch = after.search(/TRANSPORTAD|DADOS\s+DO\s+PRODUTO|C[ÁA]LCULO\s+DO\s+ISSQN|DADOS\s+ADICIONAIS/i);
      const slice = stopMatch > 0 ? after.slice(0, stopMatch) : after.slice(0, 800);
      const nums = Array.from(slice.matchAll(moneyRe)).map(m => parseBR(m[0])).filter(n => n > 0);
      if (nums.length) valor = nums[nums.length - 1];
    }
  }

  // Strategy 3 (fallback): largest monetary value in the document.
  if (valor == null || valor === 0) {
    const allNums = Array.from(text.matchAll(moneyRe)).map(m => parseBR(m[0]));
    if (allNums.length) valor = Math.max(...allNums);
  }

  // Data de emissão: look for "DATA DA EMISSÃO" dd/mm/yyyy or yy
  let dataEmissao: string | undefined;
  const dMatch = text.match(/DATA\s+DA\s+EMISS[ÃA]O[^0-9]{0,20}(\d{2})\/(\d{2})\/(\d{2,4})/i);
  if (dMatch) {
    let [, dd, mm, yy] = dMatch;
    if (yy.length === 2) yy = "20" + yy;
    dataEmissao = `${yy}-${mm}-${dd}`;
  }

  return { numero, valor, cnpjDestinatario, dataEmissao, rawText: text };
}

export const normalizeCnpj = (s?: string | null) => onlyDigits(s || "");
