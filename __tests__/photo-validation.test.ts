import { describe, it, expect } from "vitest";
import {
  validatePhotoUpload,
  computeResizedDimensions,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
} from "@/lib/portal/photo-validation";

describe("validatePhotoUpload", () => {
  it("rejects disallowed type", () => {
    const r = validatePhotoUpload({ size: 1000, type: "application/pdf", existingCount: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects oversized file", () => {
    const r = validatePhotoUpload({ size: MAX_PHOTO_BYTES + 1, type: "image/jpeg", existingCount: 0 });
    expect(r.ok).toBe(false);
  });
  it("rejects when at the photo cap", () => {
    const r = validatePhotoUpload({ size: 1000, type: "image/jpeg", existingCount: MAX_PHOTOS });
    expect(r.ok).toBe(false);
  });
  it("accepts a valid jpeg under limits", () => {
    const r = validatePhotoUpload({ size: 1000, type: "image/jpeg", existingCount: 5 });
    expect(r.ok).toBe(true);
  });
});

describe("computeResizedDimensions", () => {
  it("leaves small images unchanged", () => {
    expect(computeResizedDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
  it("scales down by the longest side (landscape)", () => {
    expect(computeResizedDimensions(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
  });
  it("scales down by the longest side (portrait)", () => {
    expect(computeResizedDimensions(1440, 2560, 1280)).toEqual({ width: 720, height: 1280 });
  });
});
