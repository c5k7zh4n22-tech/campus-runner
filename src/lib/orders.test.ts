import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS, canAcceptOrder, canTransition, isOrderExpired } from "./orders";

describe("order state machine", () => {
  it("allows only documented order transitions", () => {
    expect(canTransition("PENDING", "ACCEPTED")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("ACCEPTED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "WAITING_CONFIRM")).toBe(true);
    expect(canTransition("WAITING_CONFIRM", "COMPLETED")).toBe(true);
    expect(canTransition("WAITING_CONFIRM", "IN_PROGRESS")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("PENDING", "COMPLETED")).toBe(false);
  });

  it("has no transitions out of terminal states", () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("rejects accepting an expired or self-published order", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const order = { publisher_id: "publisher", runner_id: null, status: "PENDING" as const, deadline: future };
    expect(canAcceptOrder(order, "runner", "verified", "active")).toBe(true);
    expect(canAcceptOrder(order, "publisher", "verified", "active")).toBe(false);
    expect(canAcceptOrder(order, "runner", "pending", "active")).toBe(false);
    expect(canAcceptOrder(order, "runner", "verified", "suspended")).toBe(false);
  });

  it("detects expired deadlines", () => {
    expect(isOrderExpired("2020-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(isOrderExpired("2030-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});
