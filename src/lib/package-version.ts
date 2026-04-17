// Reads the package version from the installed package.json without requiring
// JSON import assertions. Uses createRequire so the lookup is synchronous and
// works under both Node's native ESM loader and ts-node-style dev setups.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// package.json is two levels up from dist/lib/ and src/lib/. The cjs require
// above respects node_modules semantics, so "../../package.json" resolves
// against the nearest package root.
const pkg = require("../../package.json") as { version?: string };

export const PACKAGE_VERSION = pkg.version ?? "0.0.0";
