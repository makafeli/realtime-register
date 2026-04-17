// Static integrity check for assets/spec/. Verifies every enumRef,
// fieldsRef, and itemsRef in every category file resolves against
// _shared.yaml, and that each operation carries the required top-level
// keys. Run with: node scripts/audit-refs.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "spec");
const shared = parse(readFileSync(join(dir, "_shared.yaml"), "utf8"));
const enums = new Set(Object.keys(shared.enums ?? {}));
const types = new Set(Object.keys(shared.types ?? {}));

const problems = [];
let opCount = 0;
const perCategory = {};

function walk(pathStr, v, file, op) {
  if (!v || typeof v !== "object") return;
  if (v.enumRef && !enums.has(v.enumRef)) {
    problems.push(`${file} :: ${op} :: ${pathStr} -> unknown enumRef '${v.enumRef}'`);
  }
  if (v.fieldsRef && !types.has(v.fieldsRef)) {
    problems.push(`${file} :: ${op} :: ${pathStr} -> unknown fieldsRef '${v.fieldsRef}'`);
  }
  if (v.itemsRef && !types.has(v.itemsRef)) {
    problems.push(`${file} :: ${op} :: ${pathStr} -> unknown itemsRef '${v.itemsRef}'`);
  }
  for (const [k, c] of Object.entries(v)) walk(`${pathStr}.${k}`, c, file, op);
}

const required = ["operationId", "method", "path", "docUrl", "authScope", "summary"];

for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".yaml") || f.startsWith("_")) continue;
  const name = basename(f, ".yaml");
  const cat = parse(readFileSync(join(dir, f), "utf8"));
  if (cat.category !== name) problems.push(`${f} :: category '${cat.category}' != filename '${name}'`);
  if (!Array.isArray(cat.operations)) {
    problems.push(`${f} :: 'operations' is not an array`);
    continue;
  }
  perCategory[name] = cat.operations.length;
  const seen = new Set();
  for (const op of cat.operations) {
    opCount++;
    for (const key of required) {
      if (op[key] === undefined || op[key] === null || op[key] === "") {
        problems.push(`${f} :: ${op.operationId ?? "<anon>"} -> missing '${key}'`);
      }
    }
    if (op.async === undefined) problems.push(`${f} :: ${op.operationId} -> missing 'async'`);
    if (op.operationId) {
      if (seen.has(op.operationId)) problems.push(`${f} :: duplicate operationId '${op.operationId}'`);
      seen.add(op.operationId);
    }
    if (op.verified && !["docs", "sdk", "none"].includes(op.verified)) {
      problems.push(`${f} :: ${op.operationId} -> invalid verified '${op.verified}'`);
    }
    walk("", op, f, op.operationId ?? "<anon>");
  }
}

console.log("=== RTR spec audit ===");
console.log(`categories: ${Object.keys(perCategory).length}`);
console.log(`operations: ${opCount}`);
for (const [k, v] of Object.entries(perCategory)) console.log(`  ${k.padEnd(16)} ${v}`);
console.log(`problems: ${problems.length}`);
for (const p of problems) console.log("  - " + p);
process.exit(problems.length > 0 ? 1 : 0);
