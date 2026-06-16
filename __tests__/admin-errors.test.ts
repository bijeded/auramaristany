// __tests__/admin-errors.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { ADMIN_GENERIC_ERROR, logAndGeneric } from "@/lib/admin/errors";

afterEach(() => vi.restoreAllMocks());

describe("logAndGeneric", () => {
  it("loggea el error real y devuelve el mensaje genérico", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = { message: "duplicate key value violates unique constraint \"x\"" };
    const result = logAndGeneric("saveDay", dbError);
    expect(result).toBe(ADMIN_GENERIC_ERROR);
    expect(spy).toHaveBeenCalledWith("[saveDay]", dbError);
  });
  it("el mensaje genérico no contiene detalles de schema", () => {
    expect(ADMIN_GENERIC_ERROR.toLowerCase()).not.toContain("constraint");
    expect(ADMIN_GENERIC_ERROR.toLowerCase()).not.toContain("column");
  });
});
