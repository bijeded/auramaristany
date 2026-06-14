import { describe, it, expect } from "vitest";
import { validateAvatarUpload, MAX_AVATAR_BYTES } from "@/lib/portal/avatar-validation";

describe("validateAvatarUpload", () => {
  it("acepta jpg/png/webp dentro del límite", () => {
    expect(validateAvatarUpload({ size: 1000, type: "image/jpeg" })).toEqual({ ok: true });
    expect(validateAvatarUpload({ size: 1000, type: "image/png" })).toEqual({ ok: true });
    expect(validateAvatarUpload({ size: 1000, type: "image/webp" })).toEqual({ ok: true });
  });

  it("rechaza tipos no permitidos", () => {
    const r = validateAvatarUpload({ size: 1000, type: "image/gif" });
    expect(r.ok).toBe(false);
  });

  it("rechaza archivos que superan el límite", () => {
    const r = validateAvatarUpload({ size: MAX_AVATAR_BYTES + 1, type: "image/jpeg" });
    expect(r.ok).toBe(false);
  });
});
