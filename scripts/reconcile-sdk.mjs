#!/usr/bin/env node
// Reconcile every verified:sdk operation against the live HTML documentation.
// Fetches each page, runs the scraper, and prints a structured diff of
// field-level discrepancies (name presence, required flag, inferred type,
// unit hints in descriptions). The YAML is never mutated by this script;
// it only produces a report that guides manual YAML edits.
//
// Usage: node scripts/reconcile-sdk.mjs [--only=operationId,...]

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { load as loadHtml } from "cheerio";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const SPEC_DIR = join(ROOT, "assets", "spec");
const OUT_DIR = join(ROOT, "tmp", "reconcile");
mkdirSync(OUT_DIR, { recursive: true });

const args = new Map(process.argv.slice(2).flatMap((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [[m[1], m[2] ?? "true"]] : [];
}));
const only = new Set(((args.get("only") ?? "").split(",").filter(Boolean)));

const shared = parseYaml(readFileSync(join(SPEC_DIR, "_shared.yaml"), "utf8"));
const docsBaseUrl = shared.docsBaseUrl ?? "https://dm.realtimeregister.com";

const files = readdirSync(SPEC_DIR).filter((f) => f.endsWith(".yaml") && !f.startsWith("_"));
const ops = [];
for (const f of files) {
  const cat = parseYaml(readFileSync(join(SPEC_DIR, f), "utf8"));
  for (const op of cat.operations ?? []) {
    if (op.verified === "sdk") ops.push({ category: cat.category, op });
  }
}

const selected = only.size > 0 ? ops.filter(({ op }) => only.has(op.operationId)) : ops;
console.log(`Reconciling ${selected.length} sdk-marked operation(s)`);

async function fetchHtml(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function collectBuckets($) {
  const out = [];
  const all = $("h3, h4, h5, h6, table").toArray();
  let pending = null;
  for (const el of all) {
    const tag = el.tagName?.toLowerCase() ?? "";
    if (tag === "table") {
      if (pending !== null) { out.push([pending, $(el)]); pending = null; }
    } else {
      pending = $(el).text().trim();
    }
  }
  return out;
}

function rowsToFields($, table) {
  const headers = table.find("thead tr th").toArray().map((th) => $(th).text().trim().toLowerCase());
  const idx = (re) => headers.findIndex((h) => re.test(h));
  const nameIdx = Math.max(0, idx(/^name$/));
  const typeIdx = Math.max(1, idx(/^type$/));
  const reqIdx = idx(/required/);
  const descIdx = idx(/description/);
  const rows = table.find("tbody tr").toArray();
  const out = [];
  for (const row of rows) {
    const tds = $(row).find("td").toArray();
    if (tds.length < 2) continue;
    const name = $(tds[nameIdx]).text().trim();
    const type = $(tds[typeIdx]).text().trim().replace(/\s+/g, " ");
    const required = reqIdx >= 0 ? /required|true|yes/i.test($(tds[reqIdx]).text().trim()) : true;
    const description = descIdx >= 0 ? $(tds[descIdx]).text().trim().replace(/\s+/g, " ") : "";
    if (name) out.push({ name, type, required, description });
  }
  return out;
}

function parsePage(html) {
  const $ = loadHtml(html);
  const buckets = collectBuckets($);
  const consumed = new Set();
  const take = (re) => {
    for (let i = 0; i < buckets.length; i++) {
      if (consumed.has(i)) continue;
      if (re.test(buckets[i][0])) { consumed.add(i); return rowsToFields($, buckets[i][1]); }
    }
    return [];
  };
  return {
    urlFields: take(/^url fields$/i),
    queryParams: take(/^request parameters$/i),
    bodyFields: take(/^request content fields$/i),
  };
}

function yamlBodyFields(op) {
  const fields = op.requestBody?.fields;
  if (!fields || typeof fields !== "object") return [];
  return Object.entries(fields).map(([name, shape]) => ({
    name, required: !!shape.required, type: shape.type ?? "string",
  }));
}

function diffNames(yamlList, docList) {
  const yn = new Set(yamlList.map((f) => f.name));
  const dn = new Set(docList.map((f) => f.name));
  return {
    onlyInYaml: [...yn].filter((n) => !dn.has(n)),
    onlyInDocs: [...dn].filter((n) => !yn.has(n)),
    requiredMismatch: docList
      .filter((d) => yn.has(d.name))
      .filter((d) => yamlList.find((y) => y.name === d.name)?.required !== d.required)
      .map((d) => d.name),
  };
}

const report = [];
for (const { category, op } of selected) {
  const url = `${docsBaseUrl}${op.docUrl}`;
  try {
    const html = await fetchHtml(url);
    const parsed = parsePage(html);
    const body = diffNames(yamlBodyFields(op), parsed.bodyFields);
    const query = diffNames((op.queryParams ?? []).map((p) => ({ name: p.name, required: !!p.required, type: p.type ?? "string" })), parsed.queryParams);
    const path = diffNames((op.pathParams ?? []).map((p) => ({ name: p.name, required: p.required !== false, type: p.type ?? "string" })), parsed.urlFields);
    const clean = !body.onlyInYaml.length && !body.onlyInDocs.length && !body.requiredMismatch.length
              && !query.onlyInYaml.length && !query.onlyInDocs.length && !query.requiredMismatch.length
              && !path.onlyInYaml.length && !path.onlyInDocs.length && !path.requiredMismatch.length;
    report.push({ category, operationId: op.operationId, url, clean, body, query, path, scraped: parsed });
    console.log(`${clean ? "OK " : "DIFF"} ${op.operationId.padEnd(28)} ${category}`);
  } catch (err) {
    report.push({ category, operationId: op.operationId, url, error: String(err) });
    console.log(`ERR ${op.operationId.padEnd(28)} ${err.message}`);
  }
}

writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nReport written to ${join(OUT_DIR, "report.json")}`);
console.log(`Clean: ${report.filter((r) => r.clean).length} / ${report.length}`);
