import { loadSpec, allOperations } from "../../lib/spec.js";
import { checkLink } from "../../lib/scraper.js";

interface Options { category?: string }

export async function doctorCommand(opts: Options): Promise<void> {
  const spec = loadSpec();
  const entries = allOperations(spec).filter(
    (e) => !opts.category || e.category.category === opts.category
  );

  if (entries.length === 0) {
    console.error(`No operations to check (category=${opts.category ?? "*"}).`);
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  for (const { op } of entries) {
    const url = `${spec.shared.docsBaseUrl}${op.docUrl}`;
    const res = await checkLink(url);
    const marker = res.ok ? "OK " : "BAD";
    console.log(`${marker} ${String(res.status).padStart(3)} ${op.operationId.padEnd(24)} ${url}`);
    if (!res.ok) failures++;
  }
  if (failures > 0) {
    console.error(`\n${failures} broken link(s).`);
    process.exitCode = 1;
  }
}
