import { describe, it, expect } from "vitest";
import {
  buildRecipientGroups,
  expandRecipients,
  formatDestination,
  formatReadCount,
  normalizeWhatsappNumber,
  whatsappUrl,
  type ActiveSubRow,
} from "@/lib/admin/message-helpers";

const rows: ActiveSubRow[] = [
  { profile_id: "p1", full_name: "Ana", email: "ana@x.com", phone: "+52 1 55 1234 5678",
    program_variant_id: "v1", variant_name: "CuarentaMás Principiante Poco Tiempo", program_id: "g1", program_name: "CuarentaMás" },
  { profile_id: "p2", full_name: "Bea", email: "bea@x.com", phone: null,
    program_variant_id: "v1", variant_name: "CuarentaMás Principiante Poco Tiempo", program_id: "g1", program_name: "CuarentaMás" },
  { profile_id: "p2", full_name: "Bea", email: "bea@x.com", phone: null,
    program_variant_id: "v2", variant_name: "Strong & Fit Intermedio", program_id: "g3", program_name: "Strong & Fit" },
];

describe("buildRecipientGroups", () => {
  it("agrupa por variante y cuenta clientas distintas", () => {
    const groups = buildRecipientGroups(rows);
    expect(groups).toEqual([
      { variantId: "v1", label: "CuarentaMás Principiante Poco Tiempo", programName: "CuarentaMás", count: 2 },
      { variantId: "v2", label: "Strong & Fit Intermedio", programName: "Strong & Fit", count: 1 },
    ]);
  });
});

describe("expandRecipients", () => {
  it("individual devuelve solo esa clienta", () => {
    expect(expandRecipients(rows, { mode: "individual", profileId: "p1" })).toEqual(["p1"]);
  });
  it("all devuelve clientas distintas (dedup)", () => {
    expect(expandRecipients(rows, { mode: "all" }).sort()).toEqual(["p1", "p2"]);
  });
  it("groups filtra por variante y dedup entre variantes", () => {
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v1"] }).sort()).toEqual(["p1", "p2"]);
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v2"] })).toEqual(["p2"]);
  });
  it("groups con varias variantes no duplica a la misma clienta", () => {
    expect(expandRecipients(rows, { mode: "groups", variantIds: ["v1", "v2"] }).sort()).toEqual(["p1", "p2"]);
  });
});

describe("formatDestination", () => {
  it("individual muestra el nombre", () => {
    expect(formatDestination(false, 1, "Ana")).toBe("Ana");
  });
  it("broadcast muestra conteo", () => {
    expect(formatDestination(true, 12, null)).toBe("Difusión · 12 clientas");
    expect(formatDestination(true, 1, null)).toBe("Difusión · 1 clienta");
  });
});

describe("formatReadCount", () => {
  it("singular y plural", () => {
    expect(formatReadCount(1, 5)).toBe("1 leído de 5");
    expect(formatReadCount(0, 5)).toBe("0 leídos de 5");
  });
});

describe("normalizeWhatsappNumber / whatsappUrl", () => {
  it("quita todo lo no numérico", () => {
    expect(normalizeWhatsappNumber("+52 1 55 1234 5678")).toBe("5215512345678");
  });
  it("rechaza números demasiado cortos o vacíos", () => {
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
  });
  it("construye el url con texto opcional", () => {
    expect(whatsappUrl("5215512345678")).toBe("https://wa.me/5215512345678");
    expect(whatsappUrl("5215512345678", "Hola")).toBe("https://wa.me/5215512345678?text=Hola");
  });
});
