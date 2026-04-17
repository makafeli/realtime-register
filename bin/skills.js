#!/usr/bin/env node
// Binary shim for the `skills` installer entry point. Resolves the compiled
// dist output when available, falling back to the TypeScript source during
// development.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = join(here, "..", "dist", "cli", "install-entry.js");
const source = join(here, "..", "src", "cli", "install-entry.ts");

const target = existsSync(compiled) ? compiled : source;
await import(pathToFileURL(target).href);
