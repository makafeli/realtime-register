import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const SKILLS_BIN = join(HERE, "..", "bin", "skills.js");
const RTR_BIN = join(HERE, "..", "bin", "rtr.js");

function run(bin: string, args: string[], cwd?: string): string {
  return execFileSync("node", [bin, ...args], {
    cwd: cwd ?? process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

describe("bin/skills.js", () => {
  it("reports the package version", () => {
    const out = run(SKILLS_BIN, ["--version"]).trim();
    expect(out).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("lists known targets via `where`", () => {
    const out = run(SKILLS_BIN, ["where"]);
    expect(out).toContain("Claude Desktop");
    expect(out).toContain("Augment");
  });

  it("produces a dry-run plan without touching disk", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rtr-dr-"));
    try {
      const out = run(SKILLS_BIN, ["install", "--target", tmp, "--dry-run"]);
      expect(out).toContain("[dry run] would install");
      expect(out).toContain(tmp);
      expect(existsSync(join(tmp, "realtime-register"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("install + uninstall round-trip against an explicit --target", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rtr-rt-"));
    try {
      const installed = run(SKILLS_BIN, ["install", "--target", tmp]);
      expect(installed).toContain("Installed");
      const skillDir = join(tmp, "realtime-register");
      expect(existsSync(skillDir)).toBe(true);
      expect(statSync(join(skillDir, "SKILL.md")).isFile()).toBe(true);
      expect(statSync(join(skillDir, "references")).isDirectory()).toBe(true);
      expect(statSync(join(skillDir, "assets", "spec")).isDirectory()).toBe(true);
      expect(readdirSync(join(skillDir, "references")).length).toBeGreaterThan(10);

      const removed = run(SKILLS_BIN, ["uninstall", "--target", tmp]);
      expect(removed).toContain("Removed");
      expect(existsSync(skillDir)).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("bin/rtr.js", () => {
  it("lists the validation category", () => {
    const out = run(RTR_BIN, ["list", "--category", "validation"]);
    expect(out).toContain("getValidationCategory");
    expect(out).toContain("listValidationCategories");
  });
});
