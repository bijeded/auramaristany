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
