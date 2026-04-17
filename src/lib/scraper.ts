// Fetch and parse a Realtime Register HTML doc page into a spec skeleton.
// Scraping rules derived from the consistent page structure documented in
// the project README.

import { load as loadHtml } from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";

export interface ScrapedField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  restrictions?: string;
}

export interface ScrapedOperation {
  url: string;
  method: string;
  contentType?: string;
  urlFields: ScrapedField[];
  queryParams: ScrapedField[];
  bodyFields: ScrapedField[];
  nestedTables: Record<string, ScrapedField[]>;
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

export function parseOperationHtml(html: string): ScrapedOperation {
  const $ = loadHtml(html);

  const scripts = $("script").toArray().map((s) => $(s).html() ?? "").join("\n");
  const urlMatch = scripts.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
  const methodMatch = scripts.match(/(?:var\s+method|METHOD)\s*=\s*['"]?([A-Z]+)['"]?/i);

  // Walk the document in order. Each h3/h4/h5/h6 claims the next <table> that
  // appears after it (and before the next heading). We bucket claimed tables
  // by their label, then project the well-known buckets into the return shape.
  const buckets = collectLabelledTables($);

  const firstByLabel = (re: RegExp): ScrapedField[] => {
    for (const [label, table] of buckets) {
      if (re.test(label)) return rowsToFields($, table);
    }
    return [];
  };

  const consumed = new Set<number>();
  const consumeFirst = (re: RegExp): ScrapedField[] => {
    for (let i = 0; i < buckets.length; i++) {
      if (consumed.has(i)) continue;
      const [label, table] = buckets[i]!;
      if (re.test(label)) {
        consumed.add(i);
        return rowsToFields($, table);
      }
    }
    return [];
  };

  const urlFields = consumeFirst(/^url fields$/i);
  const queryParams = consumeFirst(/^request parameters$/i);
  const bodyFields = consumeFirst(/^request content fields$/i);

  const nestedTables: Record<string, ScrapedField[]> = {};
  const skip = /^(url fields|request parameters|request content fields|response fields|response|request|successful request|failed requests|api tryout)$/i;
  for (let i = 0; i < buckets.length; i++) {
    if (consumed.has(i)) continue;
    const [label, table] = buckets[i]!;
    if (skip.test(label)) continue;
    const fields = rowsToFields($, table);
    if (fields.length > 0) nestedTables[label] = fields;
  }

  return {
    url: urlMatch?.[1] ?? "",
    method: (methodMatch?.[1] ?? "GET").toUpperCase(),
    urlFields,
    queryParams,
    bodyFields,
    nestedTables,
  };
}

function collectLabelledTables($: CheerioAPI): Array<[string, Cheerio<AnyNode>]> {
  const out: Array<[string, Cheerio<AnyNode>]> = [];
  const all = $("h3, h4, h5, h6, table").toArray();
  let pendingLabel: string | null = null;
  for (const el of all) {
    const tag = (el as unknown as { tagName?: string }).tagName?.toLowerCase() ?? "";
    if (tag === "table") {
      if (pendingLabel !== null) {
        out.push([pendingLabel, $(el)]);
        pendingLabel = null;
      }
    } else {
      pendingLabel = $(el).text().trim();
    }
  }
  return out;
}

function extractTable($: CheerioAPI, label: RegExp): ScrapedField[] {
  const header = $("h2, h3, h4, h5, h6").filter((_, el) => label.test($(el).text())).first();
  if (header.length === 0) return [];
  // Walk forward through siblings until we find the first table, stopping if
  // we hit another header of equal/higher rank (keeps us inside the section).
  let table: Cheerio<AnyNode> | null = null;
  let node = header.next();
  while (node.length > 0) {
    if (node.is("table")) { table = node; break; }
    const found = node.find("table").first();
    if (found.length > 0) { table = found; break; }
    if (node.is("h2, h3, h4, h5, h6")) break;
    node = node.next();
  }
  return table ? rowsToFields($, table) : [];
}

function rowsToFields($: CheerioAPI, table: Cheerio<AnyNode>): ScrapedField[] {
  // Read header labels so we handle both 3-column (GET: name/type/desc[/restr])
  // and 5-column (POST: name/type/required/desc/restr) layouts uniformly.
  const headers = table
    .find("thead tr th")
    .toArray()
    .map((th) => $(th).text().trim().toLowerCase());
  const idx = (re: RegExp): number => headers.findIndex((h) => re.test(h));
  const nameIdx = Math.max(0, idx(/^name$/));
  const typeIdx = Math.max(1, idx(/^type$/));
  const reqIdx = idx(/required/);
  const descIdx = idx(/description/);
  const restrIdx = idx(/restriction/);

  const rows = table.find("tbody tr").toArray();
  const out: ScrapedField[] = [];
  for (const row of rows) {
    const tds = $(row).find("td").toArray();
    if (tds.length < 2) continue;
    const name = $(tds[nameIdx]!).text().trim();
    const type = $(tds[typeIdx]!).text().trim();
    const required = reqIdx >= 0 && tds[reqIdx]
      ? /required|true|yes/i.test($(tds[reqIdx]!).text().trim())
      : true;
    const description = descIdx >= 0 && tds[descIdx] ? $(tds[descIdx]!).text().trim().replace(/\s+/g, " ") : "";
    const restrictions = restrIdx >= 0 && tds[restrIdx] ? $(tds[restrIdx]!).text().trim().replace(/\s+/g, " ") : undefined;
    if (name) {
      const field: ScrapedField = { name, type, required, description };
      if (restrictions) field.restrictions = restrictions;
      out.push(field);
    }
  }
  return out;
}

function extractNestedTables($: CheerioAPI): Record<string, ScrapedField[]> {
  const result: Record<string, ScrapedField[]> = {};
  const seenLabels = new Set([
    "url fields",
    "request parameters",
    "request content fields",
    "response fields",
    "response",
    "request",
    "successful request",
    "failed requests",
    "api tryout",
  ]);
  $("h3, h4, h5, h6").each((_, el) => {
    const title = $(el).text().trim();
    if (!title || seenLabels.has(title.toLowerCase())) return;
    const table = $(el).nextAll("table").first();
    if (table.length === 0) return;
    const fields = rowsToFields($, table);
    if (fields.length > 0) result[title] = fields;
  });
  return result;
}

export async function checkLink(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
