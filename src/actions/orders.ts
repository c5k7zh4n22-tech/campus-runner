"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orderSchema, reportSchema, reviewSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const allowedTransitions = new Set(["start", "submit", "confirm", "return_to_progress", "cancel_pending", "cancel_active"]);

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
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

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };

  const { data, error } = await supabase.rpc("create_order", {
    p_campus_id: parsed.data.campusId,
    p_pickup_location: parsed.data.pickupLocation,
    p_delivery_location: parsed.data.deliveryLocation,
    p_description: parsed.data.description,
    p_reward: parsed.data.reward,
    p_deadline: new Date(parsed.data.deadline).toISOString()
  });

  if (error) return { error: error.message };
  const order = data as { id: string } | null;
  if (!order?.id) return { error: "订单创建失败，请稍后重试" };

  revalidatePath("/orders");
  revalidatePath("/my-orders");
  redirect(`/orders/${order.id}?created=1`);
}

export async function acceptOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "订单不存在" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("accept_order", { p_order_id: orderId });
  if (error) return { error: error.message };

  revalidatePath("/orders");
  revalidatePath("/my-orders");
  revalidatePath(`/orders/${orderId}`);
  return { success: "接单成功，请按约定完成跑腿任务。" };
}

export async function transitionOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const orderId = String(formData.get("orderId") ?? "");
  const action = String(formData.get("transition") ?? "");
  if (!orderId || !allowedTransitions.has(action)) return { error: "订单操作不合法" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_action: action
  });

  if (error) return { error: error.message };
  revalidatePath("/orders");
  revalidatePath("/my-orders");
  revalidatePath(`/orders/${orderId}`);
  return { success: "订单状态已更新。" };
}

export async function reviewOrderAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse({
    orderId: formData.get("orderId"),
    revieweeId: formData.get("revieweeId"),
    rating: formData.get("rating"),
    comment: formData.get("comment")
  });

  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "请先登录" };

  const { error } = await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    reviewer_id: authData.user.id,
    reviewee_id: parsed.data.revieweeId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null
  });

  if (error) {
    if (error.code === "23505") return { error: "你已经评价过该订单" };
    return { error: error.message };
  }

  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath("/profile");
  return { success: "评价已提交，感谢你的反馈。" };
}

export async function reportAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = reportSchema.safeParse({
    orderId: formData.get("orderId") ?? "",
    reportedUserId: formData.get("reportedUserId") ?? "",
    reason: formData.get("reason"),
    details: formData.get("details")
  });

  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "请先登录" };

  const { error } = await supabase.from("reports").insert({
    reporter_id: authData.user.id,
    order_id: parsed.data.orderId || null,
    reported_user_id: parsed.data.reportedUserId || null,
    reason: parsed.data.reason,
    details: parsed.data.details
  });

  if (error) return { error: error.message };
  return { success: "举报已提交，管理员会尽快处理。" };
}
