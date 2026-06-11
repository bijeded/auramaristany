import { describe, it, expect } from "vitest";
import { normalizePhone, validatePhone } from "@/lib/auth/phone";

describe("normalizePhone", () => {
  it("deja solo dígitos (quita +, espacios, guiones, paréntesis)", () => {
    expect(normalizePhone("+52 55 1234-5678")).toBe("525512345678");
    expect(normalizePhone("(55) 1234 5678")).toBe("5512345678");
  });
  it("string sin dígitos => vacío", () => {
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("validatePhone", () => {
  it("acepta un número MX con lada (12 dígitos)", () => {
    const r = validatePhone("+52 55 1234 5678");
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("525512345678");
  });
  it("acepta los límites 11 y 15 dígitos", () => {
    expect(validatePhone("15551234567").ok).toBe(true);      // 11
    expect(validatePhone("123456789012345").ok).toBe(true);  // 15
  });
  it("rechaza vacío con mensaje de captura", () => {
    const r = validatePhone("");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("Ingresa tu número de celular.");
  });
  it("rechaza 10 dígitos (sin lada de país)", () => {
    const r = validatePhone("5512345678");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("lada de país");
  });
  it("rechaza más de 15 dígitos", () => {
    expect(validatePhone("1234567890123456").ok).toBe(false);
  });
  it("entrada sin dígitos se trata como vacía", () => {
    expect(validatePhone("abc").error).toBe("Ingresa tu número de celular.");
  });
});
