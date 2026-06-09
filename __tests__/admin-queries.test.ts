// __tests__/admin-queries.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getDayWithBlocks } from "@/lib/admin/queries";

function mockChain(dayRow: unknown, blockRows: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "program_days") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: dayRow }) }) }),
        };
      }
      // program_day_blocks
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: blockRows }) }) }),
      };
    },
  };
}

describe("getDayWithBlocks", () => {
  it("returns null when the day does not exist", async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockChain(null, []));
    expect(await getDayWithBlocks("missing")).toBeNull();
  });

  it("returns the day with its ordered blocks", async () => {
    const day = {
      id: "d1", series_id: "s1", week_number: 1, day_of_week: "lunes",
      workout_focus: "Tren Inferior", title: "Piernas", description: null,
      day_type: "workout", duration_minutes: 40, published: true,
    };
    const blocks = [{ id: "b1", block_type: "text", sort_order: 0, content: { html: "<p>hi</p>" } }];
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockChain(day, blocks));
    const result = await getDayWithBlocks("d1");
    expect(result?.id).toBe("d1");
    expect(result?.blocks).toHaveLength(1);
    expect(result?.blocks[0].block_type).toBe("text");
  });
});
