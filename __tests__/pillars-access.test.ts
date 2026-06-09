import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { getCurrentMonthPillars } from "@/lib/content/pillars";

function mockSub(slug: string) {
  return {
    from: (table: string) => {
      if (table === "subscriptions") {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () =>
          Promise.resolve({ data: {
            months_elapsed: 1, program_variant_id: "v1",
            program_variants: { program_id: "pr1", programs: { slug } },
          } }) }) }) }) };
      }
      if (table === "variant_series_map") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [
          { series_id: "s1", program_series: { series_number: 1 } },
        ] }) }) };
      }
      // program_series_pillars
      return { select: () => ({ eq: () => ({ eq: () => ({ order: () =>
        Promise.resolve({ data: [] }) }) }) }) };
    },
  };
}

describe("getCurrentMonthPillars", () => {
  it("returns [] for a non-CuarentaMás program", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSub("strong-fit"));
    expect(await getCurrentMonthPillars("u1")).toEqual([]);
  });
});
