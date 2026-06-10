export interface ActiveSubRow {
  profile_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  program_variant_id: string;
  variant_name: string;
  program_id: string;
  program_name: string;
}

export interface RecipientGroup {
  variantId: string;
  label: string;
  programName: string;
  count: number;
}

export type RecipientSelection =
  | { mode: "individual"; profileId: string }
  | { mode: "all" }
  | { mode: "groups"; variantIds: string[] };

export function buildRecipientGroups(rows: ActiveSubRow[]): RecipientGroup[] {
  const map = new Map<string, { label: string; programName: string; clients: Set<string> }>();
  for (const r of rows) {
    let entry = map.get(r.program_variant_id);
    if (!entry) {
      entry = { label: r.variant_name, programName: r.program_name, clients: new Set() };
      map.set(r.program_variant_id, entry);
    }
    entry.clients.add(r.profile_id);
  }
  return [...map.entries()]
    .map(([variantId, v]) => ({ variantId, label: v.label, programName: v.programName, count: v.clients.size }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function expandRecipients(rows: ActiveSubRow[], sel: RecipientSelection): string[] {
  let matched: string[];
  if (sel.mode === "individual") {
    matched = rows.filter((r) => r.profile_id === sel.profileId).map((r) => r.profile_id);
  } else if (sel.mode === "all") {
    matched = rows.map((r) => r.profile_id);
  } else {
    const set = new Set(sel.variantIds);
    matched = rows.filter((r) => set.has(r.program_variant_id)).map((r) => r.profile_id);
  }
  return [...new Set(matched)];
}

export function formatDestination(isBroadcast: boolean, total: number, singleName: string | null): string {
  if (!isBroadcast) return singleName ?? "—";
  return `Difusión · ${total} ${total === 1 ? "clienta" : "clientas"}`;
}

export function formatReadCount(readCount: number, total: number): string {
  return `${readCount} leído${readCount === 1 ? "" : "s"} de ${total}`;
}

export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export function whatsappUrl(number: string, text?: string): string {
  const base = `https://wa.me/${number}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
