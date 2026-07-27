import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NoticeRule } from "@/lib/supabase/types";

/**
 * Guarda de la regla de CLAUDE.md: "los valores de un union reflejado por un
 * CHECK de la BD deben migrarse juntos". La unión NoticeRule está espejada por
 * un CHECK en automated_notices.rule y en automated_messages.rule (migración
 * 014). Si alguien añade una regla en TypeScript sin ampliar el CHECK, el
 * insert falla en runtime — este test lo convierte en un fallo de CI.
 *
 * La lista se declara a mano a propósito: un union de TS no existe en runtime,
 * así que el test compara el SQL contra una lista que TypeScript sí verifica
 * (el `satisfies` de abajo rompe si la unión cambia y la lista no).
 */
const RULES = ["booking_reminder", "inactivity_nudge"] as const satisfies readonly NoticeRule[];

const MIGRATION = readFileSync(
  path.resolve(__dirname, "../supabase/migrations/014_automated_messages.sql"),
  "utf8"
);

describe("NoticeRule ↔ CHECK constraint de la migración 014", () => {
  it("declara un CHECK para automated_notices.rule y otro para automated_messages.rule", () => {
    const checks = MIGRATION.match(/check \(rule in \([^)]*\)\)/g) ?? [];
    expect(checks).toHaveLength(2);
  });

  it.each(RULES)("incluye '%s' en ambos CHECK", (rule) => {
    const checks = MIGRATION.match(/check \(rule in \([^)]*\)\)/g) ?? [];
    for (const check of checks) {
      expect(check).toContain(`'${rule}'`);
    }
  });

  it("no permite valores en el CHECK que no existan en la unión NoticeRule", () => {
    // Arrange
    const checks = MIGRATION.match(/check \(rule in \(([^)]*)\)\)/g) ?? [];

    // Act
    const sqlValues = Array.from(
      new Set(checks.flatMap((c) => Array.from(c.matchAll(/'([a-z_]+)'/g), (m) => m[1])))
    );

    // Assert — la deriva en cualquiera de los dos sentidos es un error.
    expect(sqlValues.sort()).toEqual([...RULES].sort());
  });

  it("siembra una fila de copia por cada regla", () => {
    for (const rule of RULES) {
      expect(MIGRATION).toContain(`'${rule}',`);
    }
  });

  it("siembra de forma idempotente (la migración se aplica a mano)", () => {
    expect(MIGRATION).toMatch(/on conflict \(rule\) do nothing/);
  });
});
