// __tests__/admin-page-guards.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "app/admin");

// Única excepción: redirect puro, no renderiza datos.
const EXEMPT = ["app/admin/page.tsx"];

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findPages(full);
    return name === "page.tsx" ? [relative(ROOT, full)] : [];
  });
}

describe("admin page guards", () => {
  const pages = findPages(ADMIN_DIR);

  it("encuentra páginas admin", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it("toda página admin llama requireAdminPage()", () => {
    const unguarded = pages.filter(
      (p) =>
        !EXEMPT.includes(p) &&
        !readFileSync(join(ROOT, p), "utf8").includes("requireAdminPage(")
    );
    expect(unguarded).toEqual([]);
  });

  it("las excepciones solo redirigen", () => {
    for (const p of EXEMPT) {
      expect(readFileSync(join(ROOT, p), "utf8")).toContain("redirect(");
    }
  });
});
