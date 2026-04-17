import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadSpec } from "../../lib/spec.js";
import { renderCategory } from "../../lib/generator.js";

interface Options { category?: string; out: string }

export function generateCommand(opts: Options): void {
  const spec = loadSpec();
  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });

  const targets = opts.category
    ? [spec.categories.get(opts.category)].filter((c): c is NonNullable<typeof c> => !!c)
    : Array.from(spec.categories.values());

  if (targets.length === 0) {
    console.error(`Unknown category: ${opts.category}`);
    process.exitCode = 1;
    return;
  }

  for (const cat of targets) {
    const md = renderCategory(cat, spec.shared);
    const file = join(outDir, `${cat.category}.md`);
    writeFileSync(file, md + "\n");
    console.log(`wrote ${file}`);
  }
}
