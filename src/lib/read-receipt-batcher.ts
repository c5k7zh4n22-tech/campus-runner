type Receipt =
  | { action: "read"; id: string; through: string }
  | { action: "read-notifications"; category: "order" | "system"; ids: string[] };

// Batch only receipts observed by the caller. A failed batch rejects all its
// subscribers so visible items can retry without silently losing unread state.
export function createReadReceiptBatcher(send: (receipt: Receipt) => Promise<unknown>, delay = 200) {
  type Group = { receipt: Receipt; resolve: Array<() => void>; reject: Array<(error: unknown) => void> };
  const groups = new Map<string, Group>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function flush() {
    const pending = [...groups.values()];
    groups.clear(); timer = undefined;
    await Promise.all(pending.map(async (group) => {
      try {
        const receipt = group.receipt;
        if (receipt.action === "read-notifications") {
          for (let offset = 0; offset < receipt.ids.length; offset += 50) {
            await send({ ...receipt, ids: receipt.ids.slice(offset, offset + 50) });
          }
        } else { await send(receipt); }
        group.resolve.forEach((resolve) => resolve());
      } catch (error) { group.reject.forEach((reject) => reject(error)); }
    }));
  }
  return (receipt: Receipt) => new Promise<void>((resolve, reject) => {
    const key = receipt.action === "read" ? `chat:${receipt.id}` : `notification:${receipt.category}`;
    const existing = groups.get(key);
    if (existing) {
      if (existing.receipt.action === "read" && receipt.action === "read") {
        if (BigInt(receipt.through) > BigInt(existing.receipt.through)) existing.receipt.through = receipt.through;
      } else if (existing.receipt.action === "read-notifications" && receipt.action === "read-notifications") {
        existing.receipt.ids = [...new Set([...existing.receipt.ids, ...receipt.ids])];
      }
      existing.resolve.push(resolve); existing.reject.push(reject);
    } else {
      groups.set(key, { receipt: { ...receipt }, resolve: [resolve], reject: [reject] });
    }
    timer ??= setTimeout(flush, delay);
  });
}
