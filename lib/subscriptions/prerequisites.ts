export interface PrerequisiteRow {
  prerequisite_group: number;
  required_program_slug: string;
  required_variant_levels: string[] | null;
  required_status: string;
}

export interface ClientSubscription {
  program_slug: string;
  variant_level: string | null;
  status: string;
}

export function checkPrerequisites(
  prerequisites: PrerequisiteRow[],
  clientSubscriptions: ClientSubscription[]
): { allowed: boolean; reason?: string } {
  if (prerequisites.length === 0) return { allowed: true };

  const groups = new Map<number, PrerequisiteRow[]>();
  for (const row of prerequisites) {
    const existing = groups.get(row.prerequisite_group) ?? [];
    existing.push(row);
    groups.set(row.prerequisite_group, existing);
  }

  // Groups are OR'd: if any single group is fully satisfied (AND), access is granted
  for (const groupRows of Array.from(groups.values())) {
    const groupSatisfied = groupRows.every((req: PrerequisiteRow) =>
      clientSubscriptions.some((sub: ClientSubscription) => {
        if (sub.program_slug !== req.required_program_slug) return false;
        if (sub.status !== req.required_status) return false;
        if (req.required_variant_levels !== null && req.required_variant_levels.length > 0) {
          if (!req.required_variant_levels.includes(sub.variant_level ?? "")) return false;
        }
        return true;
      })
    );
    if (groupSatisfied) return { allowed: true };
  }

  return { allowed: false, reason: "Prerequisite not met" };
}
