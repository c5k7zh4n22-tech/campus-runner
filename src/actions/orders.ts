"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { maybeOne, query, transaction, dbErrorMessage } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { canAcceptOrder } from "@/lib/orders";
import { orderSchema, reportSchema, reviewSchema } from "@/lib/validation";
import type { ActionResult, Order, OrderStatus, Profile } from "@/lib/types";

const allowedTransitions = new Set(["start", "submit", "confirm", "return_to_progress", "cancel_pending", "cancel_active"]);

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

async function currentProfile() {
  const user = await authService.getCurrentUser();
  if (!user) return null;
  return maybeOne<Profile>("select * from profiles where id = $1", [user.id]);
}

export async function createOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = orderSchema.safeParse({
    campusId: formData.get("campusId"),
    pickupLocation: formData.get("pickupLocation"),
    deliveryLocation: formData.get("deliveryLocation"),
    description: formData.get("description"),
    reward: formData.get("reward"),
    deadline: formData.get("deadline")
  });
  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const profile = await currentProfile();
  if (!profile) return { error: "请先登录" };
  if (profile.status !== "active") return { error: "账号状态不可发布订单" };

  let orderId: string;
  try {
    const order = await maybeOne<{ id: string }>(
      `insert into orders (publisher_id, campus_id, pickup_location, delivery_location, description, reward, deadline)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [profile.id, parsed.data.campusId, parsed.data.pickupLocation, parsed.data.deliveryLocation, parsed.data.description, parsed.data.reward, new Date(parsed.data.deadline).toISOString()]
    );
    if (!order?.id) return { error: "订单创建失败，请稍后重试" };
    orderId = order.id;
    revalidatePath("/orders");
    revalidatePath("/my-orders");
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect(`/orders/${orderId}?created=1`);
}

export async function acceptOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "订单不存在" };
  const profile = await currentProfile();
  if (!profile) return { error: "请先登录" };

  try {
    await transaction(async (client) => {
      const result = await client.query<Order>("select * from orders where id = $1 for update", [orderId]);
      const order = result.rows[0];
      if (!order) throw new Error("订单不存在");
      if (!canAcceptOrder(order, profile.id, profile.verification_status, profile.status)) throw new Error("当前不能接该订单");
      await client.query("update orders set runner_id = $1, status = 'ACCEPTED', accepted_at = now() where id = $2", [profile.id, orderId]);
    });
    revalidatePath("/orders");
    revalidatePath("/my-orders");
    revalidatePath(`/orders/${orderId}`);
    return { success: "接单成功，请按约定完成跑腿任务。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function transitionOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("orderId") ?? "");
  const action = String(formData.get("transition") ?? "");
  if (!orderId || !allowedTransitions.has(action)) return { error: "订单操作不合法" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };

  const now = new Date().toISOString();
  const transitions: Record<string, { status: OrderStatus; field?: string; actor: "publisher" | "runner" | "participant" }> = {
    start: { status: "IN_PROGRESS", field: "started_at", actor: "runner" },
    submit: { status: "WAITING_CONFIRM", field: "completed_at", actor: "runner" },
    confirm: { status: "COMPLETED", actor: "publisher" },
    return_to_progress: { status: "IN_PROGRESS", actor: "publisher" },
    cancel_pending: { status: "CANCELLED", field: "cancelled_at", actor: "publisher" },
    cancel_active: { status: "CANCELLED", field: "cancelled_at", actor: "participant" }
  };

  try {
    await transaction(async (client) => {
      const result = await client.query<Order>("select * from orders where id = $1 for update", [orderId]);
      const order = result.rows[0];
      if (!order) throw new Error("订单不存在");
      const transition = transitions[action];
      const isPublisher = order.publisher_id === user.id;
      const isRunner = order.runner_id === user.id;
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
      await client.query(`update orders set status = $1${fieldSql} where id = $2`, transition.field ? [transition.status, orderId, now] : [transition.status, orderId]);
    });
    revalidatePath("/orders");
    revalidatePath("/my-orders");
    revalidatePath(`/orders/${orderId}`);
    return { success: "订单状态已更新。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function reviewOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({ orderId: formData.get("orderId"), revieweeId: formData.get("revieweeId"), rating: formData.get("rating"), comment: formData.get("comment") });
  if (!parsed.success) return { error: issueMessage(parsed.error) };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  const order = await maybeOne<Order>("select * from orders where id = $1", [parsed.data.orderId]);
  if (!order || order.status !== "COMPLETED") return { error: "订单完成后才能评价" };
  const validReviewee = (order.publisher_id === user.id && order.runner_id === parsed.data.revieweeId) || (order.runner_id === user.id && order.publisher_id === parsed.data.revieweeId);
  if (!validReviewee) return { error: "无权评价该用户" };
  try {
    await query("insert into reviews (order_id, reviewer_id, reviewee_id, rating, comment) values ($1, $2, $3, $4, $5)", [parsed.data.orderId, user.id, parsed.data.revieweeId, parsed.data.rating, parsed.data.comment || null]);
    revalidatePath(`/orders/${parsed.data.orderId}`);
    revalidatePath("/profile");
    return { success: "评价已提交，感谢你的反馈。" };
  } catch (error) {
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) return { error: "你已经评价过该订单" };
    return { error: dbErrorMessage(error) };
  }
}

export async function reportAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({ orderId: formData.get("orderId") ?? "", reportedUserId: formData.get("reportedUserId") ?? "", reason: formData.get("reason"), details: formData.get("details") });
  if (!parsed.success) return { error: issueMessage(parsed.error) };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  try {
    await query("insert into reports (reporter_id, order_id, reported_user_id, reason, details) values ($1, $2, $3, $4, $5)", [user.id, parsed.data.orderId || null, parsed.data.reportedUserId || null, parsed.data.reason, parsed.data.details]);
    return { success: "举报已提交，管理员会尽快处理。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}
