import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// ajv@8 and ajv-formats@3 are CommonJS; under "module": "NodeNext" the default
// import resolves to a namespace object that TypeScript refuses to invoke.
// Falling back to createRequire gives us the raw CJS exports and keeps the
// types correct without disabling strict mode.
const require = createRequire(import.meta.url);
const Ajv: typeof import("ajv").default = require("ajv");
const addFormats: typeof import("ajv-formats").default = require("ajv-formats");
import { loadSpec, findOperation } from "../../lib/spec.js";
import { buildOperationSchemas } from "../../lib/schema.js";

interface Options {
  body: string;
  query?: string;
  pathParams?: string;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateCommand(operationId: string, opts: Options): void {
  const spec = loadSpec();
  const hit = findOperation(spec, operationId);
  if (!hit) {
    console.error(`Unknown operationId: ${operationId}`);
    process.exitCode = 1;
    return;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const schemas = buildOperationSchemas(hit.op, spec.shared);
  let ok = true;

  if (schemas.body) {
    const payload = readJson(opts.body);
    const validate = ajv.compile(schemas.body);
    if (!validate(payload)) {
      ok = false;
      console.error("Body validation failed:");
      for (const err of validate.errors ?? []) console.error(`  ${err.instancePath} ${err.message}`);
    } else {
      console.log("Body: OK");
    }
  } else {
    console.log(`Operation ${operationId} has no request body; skipping body validation.`);
  }

  if (opts.query) {
    const payload = readJson(opts.query);
    const validate = ajv.compile(schemas.query);
    if (!validate(payload)) {
      ok = false;
      console.error("Query validation failed:");
      for (const err of validate.errors ?? []) console.error(`  ${err.instancePath} ${err.message}`);
    } else {
      console.log("Query: OK");
    }
  }

  if (opts.pathParams) {
    const payload = readJson(opts.pathParams);
    const validate = ajv.compile(schemas.path);
    if (!validate(payload)) {
      ok = false;
      console.error("Path params validation failed:");
      for (const err of validate.errors ?? []) console.error(`  ${err.instancePath} ${err.message}`);
    } else {
      console.log("Path params: OK");
    }
  }

  if (!ok) process.exitCode = 1;
}
