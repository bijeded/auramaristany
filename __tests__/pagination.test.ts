import { describe, it, expect } from "vitest";
import { paginate } from "@/lib/admin/pagination";

describe("paginate", () => {
  const nums = Array.from({ length: 23 }, (_, i) => i + 1);
  it("devuelve la primera página de 10 por defecto", () => {
    const r = paginate(nums, 1);
    expect(r.items).toHaveLength(10);
    expect(r.items[0]).toBe(1);
    expect(r.totalPages).toBe(3);
  });
  it("devuelve la última página parcial", () => {
    const r = paginate(nums, 3);
    expect(r.items).toEqual([21, 22, 23]);
  });
  it("clampa páginas fuera de rango a la última", () => {
    expect(paginate(nums, 99).items).toEqual([21, 22, 23]);
  });
  it("lista vacía => totalPages 1, items vacío", () => {
    expect(paginate([], 1)).toEqual({ items: [], totalPages: 1, page: 1 });
  });
});
