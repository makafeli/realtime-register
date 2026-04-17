import { loadSpec, findOperation } from "../../lib/spec.js";
import { fetchHtml, parseOperationHtml } from "../../lib/scraper.js";

export async function scrapeCommand(operationId: string): Promise<void> {
  const spec = loadSpec();
  const hit = findOperation(spec, operationId);
  if (!hit) {
    console.error(`Unknown operationId: ${operationId}`);
    process.exitCode = 1;
    return;
  }
  const url = `${spec.shared.docsBaseUrl}${hit.op.docUrl}`;
  console.log(`# Fetching ${url}`);
  const html = await fetchHtml(url);
  const parsed = parseOperationHtml(html);
  console.log(JSON.stringify(parsed, null, 2));
}
