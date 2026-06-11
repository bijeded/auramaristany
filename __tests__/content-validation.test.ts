import { describe, it, expect } from "vitest";
import { validateDayInput, validateBlock } from "@/lib/admin/content-validation";

describe("validateDayInput", () => {
  const base = { title: "Día 1", weekNumber: 1, dayType: "workout", durationMinutes: 30, workoutFocus: "Fuerza" };
  it("acepta input válido", () => {
    expect(validateDayInput(base).ok).toBe(true);
  });
  it("rechaza title vacío", () => {
    expect(validateDayInput({ ...base, title: "  " }).ok).toBe(false);
  });
  it("rechaza title >200", () => {
    expect(validateDayInput({ ...base, title: "x".repeat(201) }).ok).toBe(false);
  });
  it("rechaza weekNumber fuera de 1–4", () => {
    expect(validateDayInput({ ...base, weekNumber: 5 }).ok).toBe(false);
    expect(validateDayInput({ ...base, weekNumber: 0 }).ok).toBe(false);
  });
  it("rechaza dayType fuera del enum", () => {
    expect(validateDayInput({ ...base, dayType: "yoga" }).ok).toBe(false);
  });
  it("rechaza durationMinutes fuera de 0–600", () => {
    expect(validateDayInput({ ...base, durationMinutes: 601 }).ok).toBe(false);
  });
  it("acepta durationMinutes null y workoutFocus null", () => {
    expect(validateDayInput({ ...base, durationMinutes: null, workoutFocus: null }).ok).toBe(true);
  });
});

describe("validateBlock", () => {
  it("acepta block_type permitido", () => {
    expect(validateBlock({ block_type: "text", content: { html: "<p>hola</p>" } }).ok).toBe(true);
  });
  it("rechaza block_type desconocido", () => {
    expect(validateBlock({ block_type: "iframe", content: {} }).ok).toBe(false);
  });
  it("rechaza html de texto >50000", () => {
    expect(validateBlock({ block_type: "text", content: { html: "x".repeat(50001) } }).ok).toBe(false);
  });
});
