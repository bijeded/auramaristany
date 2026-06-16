import { describe, it, expect } from "vitest";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signed-url";

describe("SIGNED_URL_TTL_SECONDS", () => {
  it("is 600 seconds (10 min) for body photos", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(600);
  });
});
