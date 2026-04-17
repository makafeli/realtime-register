// Uninstall / where helpers for @cave-man/realtime-register-skills.

import { existsSync, rmSync } from "node:fs";
import {
  candidateTargets,
  customTarget,
  SKILL_NAME,
  type SkillTarget,
} from "../../lib/skill-paths.js";

export interface UninstallOptions {
  target?: string;
  all?: boolean;
  dryRun?: boolean;
}

/** Remove the installed skill directory from one or all detected targets. */
export async function uninstallCommand(opts: UninstallOptions): Promise<void> {
  const targets = pickTargets(opts);
  const installed = targets.filter((t) => existsSync(t.path));

  if (installed.length === 0) {
    console.log(`No ${SKILL_NAME} installation found in the selected target(s).`);
    return;
  }

  for (const t of installed) {
    if (opts.dryRun) {
      console.log(`[dry run] would remove ${t.path}  (${t.label})`);
      continue;
    }
    rmSync(t.path, { recursive: true, force: true });
    console.log(`Removed ${t.path}  (${t.label})`);
  }
}

/** Print every known target and whether the skill is installed there. */
export async function whereCommand(): Promise<void> {
  const targets = candidateTargets();
  let anyInstalled = false;

  for (const t of targets) {
    const installed = existsSync(t.path);
    const marker = installed ? "[installed]" : t.exists ? "[available]" : "[absent]   ";
    console.log(`${marker}  ${t.label.padEnd(28)} ${t.path}`);
    if (installed) anyInstalled = true;
  }

  if (!anyInstalled) {
    console.log("");
    console.log(`No ${SKILL_NAME} installation detected. Run:`);
    console.log("  npx @cave-man/realtime-register-skills install");
  }
}

function pickTargets(opts: UninstallOptions): SkillTarget[] {
  if (opts.target) return [customTarget(opts.target)];
  if (opts.all)    return candidateTargets();

  // Default: uninstall from the single detected install, if unambiguous.
  const installed = candidateTargets().filter((t) => existsSync(t.path));
  if (installed.length === 0) return [];
  if (installed.length === 1) return installed;

  console.error("Multiple installations detected. Re-run with --target <dir> or --all:");
  for (const t of installed) console.error(`  ${t.path}  (${t.label})`);
  process.exit(1);
}
