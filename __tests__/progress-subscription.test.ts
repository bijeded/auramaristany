import { describe, it, expect } from "vitest";
import { pickAccessSubscriptionId } from "@/lib/content/queries";

describe("pickAccessSubscriptionId", () => {
  it("devuelve el id de la fila de sub con estado de acceso", () => {
    expect(pickAccessSubscriptionId({ id: "sub-real" })).toBe("sub-real");
  });
  it("devuelve null si no hay fila", () => {
    expect(pickAccessSubscriptionId(null)).toBeNull();
  });
});
