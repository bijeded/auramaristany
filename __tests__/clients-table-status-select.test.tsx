import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientsTable } from "@/components/admin/ClientsTable";
import { STATUS_FILTERS, type ClientListRow } from "@/lib/admin/clients-helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/clients",
  useSearchParams: () => new URLSearchParams(),
}));

const NOW = "2026-07-15";

const row: ClientListRow = {
  profile_id: "p1",
  full_name: "Ana López",
  email: "ana@example.com",
  phone: null,
  program_name: "CuarentaMás",
  variant_name: "Base",
  enrollment_date: "2026-01-01",
  current_period_end: "2026-08-01",
  price_mxn: 999,
  status: "active",
  cancel_at_period_end: false,
  completed_at: null,
  last_activity_date: NOW,
};

// D30 — la regla 8 pide que las opciones salgan ENTERAS de una constante: una
// `<option>` escrita a mano al lado de la lista mapeada ofrece un valor que el
// validador no conoce (D19). Hasta ahora sólo lo revisaba un paso de smoke.
describe("ClientsTable — select de estado", () => {
  it("ofrece exactamente el centinela más STATUS_FILTERS, en orden", () => {
    render(<ClientsTable rows={[row]} now={NOW} />);

    const select = screen.getByRole("combobox", { name: "Estado" });
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.value);

    expect(values).toEqual(["", ...STATUS_FILTERS]);
  });
});
