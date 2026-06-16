// __tests__/onboarding-responses-validation.test.ts
import { describe, it, expect } from "vitest";
import { validateResponses, type ActiveQuestion } from "@/lib/onboarding/responses-validation";

const QUESTIONS: ActiveQuestion[] = [
  { id: "q1", is_required: true },
  { id: "q2", is_required: false },
];

describe("validateResponses", () => {
  it("rechaza si falta una requerida", () => {
    const r = validateResponses(QUESTIONS, { q2: "algo" });
    expect(r.ok).toBe(false);
  });
  it("rechaza si la requerida está vacía", () => {
    expect(validateResponses(QUESTIONS, { q1: "" }).ok).toBe(false);
    expect(validateResponses(QUESTIONS, { q1: [] }).ok).toBe(false);
  });
  it("acepta cuando las requeridas están respondidas", () => {
    expect(validateResponses(QUESTIONS, { q1: "sí" }).ok).toBe(true);
  });
  it("ignora respuestas a preguntas inexistentes (no rompe)", () => {
    expect(validateResponses(QUESTIONS, { q1: "sí", zzz: "ruido" }).ok).toBe(true);
  });
});
