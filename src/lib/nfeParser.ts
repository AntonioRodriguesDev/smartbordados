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

  // Valor total da nota: look for "VALOR TOTAL DA NOTA" followed by a number
  let valor: number | undefined;
  const vMatch = text.match(/VALOR\s+TOTAL\s+DA\s+NOTA[^0-9]{0,30}([\d\.]+,\d{2})/i);
  if (vMatch) {
    valor = parseFloat(vMatch[1].replace(/\./g, "").replace(",", "."));
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
