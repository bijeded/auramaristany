import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock de next/navigation: capturamos router.refresh().
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { useProgressForm } from "@/hooks/useProgressForm";

const baseParams = {
  dayId: "day-1",
  subscriptionId: "sub-1",
  existingLog: null,
  exercises: [{ id: "ex-1", sets: 3 }],
};

beforeEach(() => {
  refreshMock.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useProgressForm — refresca /portal/today tras guardar (bug: form en blanco al volver)", () => {
  it("llama router.refresh() tras un guardado exitoso (invalida la Router Cache)", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.updateGeneralNotes("nota de hoy");
    });
    // dispara el debounce (1500ms) y deja resolver el fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/portal/progress",
      expect.objectContaining({ method: "POST" })
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("NO llama router.refresh() si el guardado falla", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.updateGeneralNotes("nota de hoy");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(refreshMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// A1 — unidad kg/lb por ejercicio (estado siempre visible en la unidad elegida;
// el payload guardado SIEMPRE va en kg)
// ---------------------------------------------------------------------------

describe("useProgressForm — unidad de peso kg/lb", () => {
  it("por defecto la unidad es kg y el payload va tal cual", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.updateSeries("ex-1", 0, "weight_kg", "20");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(result.current.weightUnits["ex-1"] ?? "kg").toBe("kg");
    expect(body.exercisesDone["ex-1"].series[0].weight_kg).toBe(20);
  });

  it("setWeightUnit a lb convierte los valores tecleados in place (kg → lb)", () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.updateSeries("ex-1", 0, "weight_kg", "24.9");
      result.current.setWeightUnit("ex-1", "lb");
    });

    expect(result.current.weightUnits["ex-1"]).toBe("lb");
    expect(result.current.exercises["ex-1"].series[0].weight_kg).toBe("54.9");
    // input vacío permanece vacío
    expect(result.current.exercises["ex-1"].series[1].weight_kg).toBe("");
  });

  it("con unidad lb, el payload guardado se convierte a kg", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.setWeightUnit("ex-1", "lb");
    });
    act(() => {
      result.current.updateSeries("ex-1", 0, "weight_kg", "55");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    expect(body.exercisesDone["ex-1"].series[0].weight_kg).toBe(24.9);
  });

  it("round-trip lb → kg vuelve al valor original", () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    const { result } = renderHook(() => useProgressForm(baseParams));

    act(() => {
      result.current.updateSeries("ex-1", 0, "weight_kg", "24.9");
      result.current.setWeightUnit("ex-1", "lb");
    });
    act(() => {
      result.current.setWeightUnit("ex-1", "kg");
    });

    expect(result.current.exercises["ex-1"].series[0].weight_kg).toBe("24.9");
  });
});
