// __tests__/youtube.test.ts
import { describe, it, expect } from "vitest";
import { extractVideoId } from "@/lib/admin/youtube";

describe("extractVideoId", () => {
  it("extracts from watch?v= URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from youtu.be short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts when extra query params follow", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for a non-YouTube URL", () => {
    expect(extractVideoId("https://vimeo.com/12345")).toBeNull();
  });
});
