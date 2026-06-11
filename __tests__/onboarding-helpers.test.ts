import { describe, it, expect } from "vitest";
import { validateQuestion, reindexOrder, type QuestionInput } from "@/lib/admin/onboarding-helpers";

const base: QuestionInput = {
  question_text: "¿Cuál es tu objetivo?",
  question_type: "single_choice",
  options: ["Bajar de peso", "Tonificar"],
  is_required: true,
};

describe("validateQuestion", () => {
  it("rechaza texto vacío o solo espacios", () => {
    expect(validateQuestion({ ...base, question_text: "   " }).ok).toBe(false);
  });
  it("acepta una pregunta de selección con opciones", () => {
    const r = validateQuestion(base);
    expect(r.ok).toBe(true);
    expect(r.cleanedOptions).toEqual(["Bajar de peso", "Tonificar"]);
  });
  it("trim y dedup de opciones", () => {
    const r = validateQuestion({ ...base, options: ["  A  ", "A", "B", ""] });
    expect(r.cleanedOptions).toEqual(["A", "B"]);
  });
  it("rechaza selección sin opciones válidas", () => {
    expect(validateQuestion({ ...base, options: ["", "   "] }).ok).toBe(false);
    expect(validateQuestion({ ...base, options: null }).ok).toBe(false);
  });
  it("text/number fuerzan cleanedOptions null aunque manden options", () => {
    const r = validateQuestion({ ...base, question_type: "text", options: ["x"] });
    expect(r.ok).toBe(true);
    expect(r.cleanedOptions).toBeNull();
  });
});

describe("reindexOrder", () => {
  it("asigna sort_order = índice", () => {
    expect(reindexOrder(["a", "b", "c"])).toEqual([
      { id: "a", sort_order: 0 }, { id: "b", sort_order: 1 }, { id: "c", sort_order: 2 },
    ]);
  });
  it("lista vacía => []", () => {
    expect(reindexOrder([])).toEqual([]);
  });
});
