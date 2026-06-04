import { describe, it, expect } from "vitest";
import { checkPrerequisites } from "@/lib/subscriptions/prerequisites";
import type { PrerequisiteRow, ClientSubscription } from "@/lib/subscriptions/prerequisites";

const noPrereqs: PrerequisiteRow[] = [];

const extraIntermedioPrereqs: PrerequisiteRow[] = [
  { prerequisite_group: 1, required_program_slug: "cuarenta-mas", required_variant_levels: null, required_status: "completed" },
];

const extraAvanzadoPrereqs: PrerequisiteRow[] = [
  { prerequisite_group: 1, required_program_slug: "cuarenta-mas-extra", required_variant_levels: ["intermedio"], required_status: "completed" },
  { prerequisite_group: 2, required_program_slug: "cuarenta-mas", required_variant_levels: ["intermedio", "avanzado"], required_status: "completed" },
];

describe("checkPrerequisites", () => {
  it("allows access when variant has no prerequisites", () => {
    expect(checkPrerequisites(noPrereqs, [])).toEqual({ allowed: true });
  });

  it("blocks access when prerequisites exist but client has no subscriptions", () => {
    const result = checkPrerequisites(extraIntermedioPrereqs, []);
    expect(result.allowed).toBe(false);
  });

  it("allows Extra Intermedio when CuarentaMás is completed (any level)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "completed" },
    ];
    expect(checkPrerequisites(extraIntermedioPrereqs, subs)).toEqual({ allowed: true });
  });

  it("blocks Extra Intermedio when CuarentaMás is active but not completed", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "active" },
    ];
    expect(checkPrerequisites(extraIntermedioPrereqs, subs)).toEqual({
      allowed: false,
      reason: "Prerequisite not met",
    });
  });

  it("allows Extra Avanzado when Extra Intermedio is completed (group 1)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas-extra", variant_level: "intermedio", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({ allowed: true });
  });

  it("allows Extra Avanzado when CuarentaMás Avanzado is completed (group 2)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "avanzado", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({ allowed: true });
  });

  it("blocks Extra Avanzado when only CuarentaMás Principiante completed (wrong level)", () => {
    const subs: ClientSubscription[] = [
      { program_slug: "cuarenta-mas", variant_level: "principiante", status: "completed" },
    ];
    expect(checkPrerequisites(extraAvanzadoPrereqs, subs)).toEqual({
      allowed: false,
      reason: "Prerequisite not met",
    });
  });
});
