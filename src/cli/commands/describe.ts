import { loadSpec, findOperation } from "../../lib/spec.js";
import { renderOperation } from "../../lib/generator.js";

export function describeCommand(operationId: string): void {
  const spec = loadSpec();
  const hit = findOperation(spec, operationId);
  if (!hit) {
    console.error(`Unknown operationId: ${operationId}`);
    process.exitCode = 1;
    return;
  }
  console.log(renderOperation(hit.op, spec.shared).join("\n"));
}
