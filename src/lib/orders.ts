import type { OrderStatus } from "./types";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_CONFIRM", "CANCELLED"],
  WAITING_CONFIRM: ["COMPLETED", "IN_PROGRESS"],
  COMPLETED: [],
  CANCELLED: []
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`非法订单状态转换：${from} → ${to}`);
  }
}

export function isParticipant(order: { publisher_id: string; runner_id: string | null }, userId: string) {
  return order.publisher_id === userId || order.runner_id === userId;
}

export function isOrderExpired(deadline: string, now = new Date()) {
  return new Date(deadline).getTime() <= now.getTime();
}

export function canAcceptOrder(
  order: { publisher_id: string; runner_id: string | null; status: OrderStatus; deadline: string },
  userId: string,
  verificationStatus: string,
  userStatus: string,
  now = new Date()
) {
  return (
    order.status === "PENDING" &&
    order.runner_id === null &&
    order.publisher_id !== userId &&
    verificationStatus === "verified" &&
    userStatus === "active" &&
    !isOrderExpired(order.deadline, now)
  );
}
