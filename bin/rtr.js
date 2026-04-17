#!/usr/bin/env node
// Binary shim. In dev, transpile-free entry via `node --experimental-strip-types`;
// in published builds, resolve the compiled dist output.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, "..", "dist", "cli", "index.js");
const source = join(here, "..", "src", "cli", "index.ts");

const target = existsSync(compiled) ? compiled : source;
await import(pathToFileURL(target).href);
