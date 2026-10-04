import { afterEach, describe, expect, it, vi } from "vitest";
import { createReadReceiptBatcher } from "./read-receipt-batcher";

afterEach(() => vi.useRealTimers());
describe("batched read receipts", () => {
  it("collapses visible messages per conversation using numeric ID order", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue({ ok: true });
    const enqueue = createReadReceiptBatcher(send);
    const pending = Promise.all([
      enqueue({ action: "read", id: "a", through: "99" }),
      enqueue({ action: "read", id: "a", through: "100" }),
      enqueue({ action: "read", id: "a", through: "98" }),
      enqueue({ action: "read", id: "b", through: "50" })
    ]);
    await vi.advanceTimersByTimeAsync(200); await pending;
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ action: "read", id: "a", through: "100" });
    expect(send).toHaveBeenCalledWith({ action: "read", id: "b", through: "50" });
  });
  it("deduplicates notification IDs, keeps categories apart and respects API limits", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue({ ok: true });
    const enqueue = createReadReceiptBatcher(send);
    const pending = Promise.all([
      enqueue({ action: "read-notifications", category: "order", ids: Array.from({ length: 60 }, (_, i) => String(i + 1)) }),
      enqueue({ action: "read-notifications", category: "order", ids: ["1", "2"] }),
      enqueue({ action: "read-notifications", category: "system", ids: ["70"] })
    ]);
    await vi.advanceTimersByTimeAsync(200); await pending;
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.every(([payload]) => payload.ids.length <= 50)).toBe(true);
    expect(send.mock.calls.filter(([payload]) => payload.category === "order").flatMap(([payload]) => payload.ids)).toHaveLength(60);
  });
  it("rejects failed receipts and allows subsequent retry", async () => {
    vi.useFakeTimers();
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true });
    const enqueue = createReadReceiptBatcher(send);
    const receipt = { action: "read" as const, id: "a", through: "12" };
    const failed = expect(enqueue(receipt)).rejects.toThrow("offline");
    await vi.advanceTimersByTimeAsync(200); await failed;
    const retry = enqueue(receipt);
    await vi.advanceTimersByTimeAsync(200); await retry;
    expect(send).toHaveBeenCalledTimes(2);
  });
});
