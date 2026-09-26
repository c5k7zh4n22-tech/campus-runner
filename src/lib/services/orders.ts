import "server-only";

import { maybeOne, query, transaction } from "@/lib/db";
import { canAcceptOrder } from "@/lib/orders";
import type { Order, OrderStatus, Profile } from "@/lib/types";

export type OrderTransitionAction = "start" | "submit" | "confirm" | "return_to_progress" | "cancel_pending" | "cancel_active";

const transitions: Record<OrderTransitionAction, { status: OrderStatus; field?: string; actor: "publisher" | "runner" | "participant" }> = {
  start: { status: "IN_PROGRESS", field: "started_at", actor: "runner" },
  submit: { status: "WAITING_CONFIRM", field: "completed_at", actor: "runner" },
  confirm: { status: "COMPLETED", actor: "publisher" },
  return_to_progress: { status: "IN_PROGRESS", actor: "publisher" },
  cancel_pending: { status: "CANCELLED", field: "cancelled_at", actor: "publisher" },
  cancel_active: { status: "CANCELLED", field: "cancelled_at", actor: "participant" }
};

export function isOrderTransitionAction(value: string): value is OrderTransitionAction {
  return value in transitions;
}

export async function createOrder(profile: Profile, input: {
  campusId: string;
  pickupLocation: string;
  deliveryLocation: string;
  description: string;
  reward: number;
  deadline: string;
}) {
  if (profile.status !== "active") throw new Error("账号状态不可发布订单");

  const order = await maybeOne<{ id: string }>(
    `insert into orders (publisher_id, campus_id, pickup_location, delivery_location, description, reward, deadline)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [
      profile.id,
      input.campusId,
      input.pickupLocation,
      input.deliveryLocation,
      input.description,
      input.reward,
      new Date(input.deadline).toISOString()
    ]
  );
  if (!order?.id) throw new Error("订单创建失败，请稍后重试");
  return order.id;
}

export async function acceptOrder(profile: Profile, orderId: string) {
  await transaction(async (client) => {
    const result = await client.query<Order>("select * from orders where id = $1 for update", [orderId]);
    const order = result.rows[0];
    if (!order) throw new Error("订单不存在");
    if (!canAcceptOrder(order, profile.id, profile.verification_status, profile.status)) throw new Error("当前不能接该订单");
    await client.query("update orders set runner_id = $1, status = 'ACCEPTED', accepted_at = now() where id = $2", [profile.id, orderId]);
  });
}

export async function transitionOrder(userId: string, orderId: string, action: OrderTransitionAction) {
  const now = new Date().toISOString();
  await transaction(async (client) => {
    const result = await client.query<Order>("select * from orders where id = $1 for update", [orderId]);
    const order = result.rows[0];
    if (!order) throw new Error("订单不存在");

    const transition = transitions[action];
    const isPublisher = order.publisher_id === userId;
    const isRunner = order.runner_id === userId;
    if (transition.actor === "publisher" && !isPublisher) throw new Error("无权操作该订单");
    if (transition.actor === "runner" && !isRunner) throw new Error("无权操作该订单");
    if (transition.actor === "participant" && !isPublisher && !isRunner) throw new Error("无权操作该订单");
    if (action === "start" && order.status !== "ACCEPTED") throw new Error("订单状态不允许开始");
    if (action === "submit" && order.status !== "IN_PROGRESS") throw new Error("订单状态不允许提交");
    if (action === "confirm" && order.status !== "WAITING_CONFIRM") throw new Error("订单状态不允许确认");
    if (action === "return_to_progress" && order.status !== "WAITING_CONFIRM") throw new Error("订单状态不允许退回");
    if (action === "cancel_pending" && order.status !== "PENDING") throw new Error("订单状态不允许取消");
    if (action === "cancel_active" && !["ACCEPTED", "IN_PROGRESS", "WAITING_CONFIRM"].includes(order.status)) throw new Error("订单状态不允许取消");

    const fieldSql = transition.field ? `, ${transition.field} = $3` : "";
    await client.query(
      `update orders set status = $1${fieldSql} where id = $2`,
      transition.field ? [transition.status, orderId, now] : [transition.status, orderId]
    );
  });
}

export async function reviewOrder(userId: string, input: {
  orderId: string;
  revieweeId: string;
  rating: number;
  comment: string;
}) {
  const order = await maybeOne<Order>("select * from orders where id = $1", [input.orderId]);
  if (!order || order.status !== "COMPLETED") throw new Error("订单完成后才能评价");
  const validReviewee =
    (order.publisher_id === userId && order.runner_id === input.revieweeId) ||
    (order.runner_id === userId && order.publisher_id === input.revieweeId);
  if (!validReviewee) throw new Error("无权评价该用户");

  await query("insert into reviews (order_id, reviewer_id, reviewee_id, rating, comment) values ($1, $2, $3, $4, $5)", [
    input.orderId,
    userId,
    input.revieweeId,
    input.rating,
    input.comment || null
  ]);
}

export async function reportIssue(userId: string, input: {
  orderId: string;
  reportedUserId: string;
  reason: string;
  details: string;
}) {
  await query("insert into reports (reporter_id, order_id, reported_user_id, reason, details) values ($1, $2, $3, $4, $5)", [
    userId,
    input.orderId || null,
    input.reportedUserId || null,
    input.reason,
    input.details
  ]);
}
