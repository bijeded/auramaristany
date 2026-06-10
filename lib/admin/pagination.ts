export function paginate<T>(
  rows: T[],
  page: number,
  pageSize = 10
): { items: T[]; totalPages: number; page: number } {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const clamped = Math.min(Math.max(1, page), totalPages);
  const start = (clamped - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), totalPages, page: clamped };
}
