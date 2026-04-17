import { loadSpec } from "../../lib/spec.js";

interface Options { category?: string }

export function listCommand(opts: Options): void {
  const spec = loadSpec();
  const categories = opts.category
    ? [spec.categories.get(opts.category)].filter((c): c is NonNullable<typeof c> => !!c)
    : Array.from(spec.categories.values());

  if (categories.length === 0) {
    if (opts.category) {
      console.error(`Unknown category: ${opts.category}`);
      process.exitCode = 1;
    }
    return;
  }

  for (const cat of categories) {
    console.log(`\n# ${cat.label} (${cat.category}) \u2014 ${cat.operations.length} operations`);
    for (const op of cat.operations) {
      const async = op.async ? " *async*" : "";
      const dep = op.deprecated ? " *deprecated*" : "";
      console.log(`  ${op.method.padEnd(6)} ${op.path}  \u2192  ${op.operationId}${async}${dep}`);
    }
  }
}
