"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { getProfileByUserId } from "@/lib/services/profile";
import { acceptOrder, createOrder, isOrderTransitionAction, reportIssue, reviewOrder, transitionOrder } from "@/lib/services/orders";
import { orderSchema, reportSchema, reviewSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

async function currentProfile() {
  const user = await authService.getCurrentUser();
  if (!user) return null;
  return getProfileByUserId(user.id);
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

  let orderId: string;
  try {
    orderId = await createOrder(profile, parsed.data);
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
    await acceptOrder(profile, orderId);
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
  if (!orderId || !isOrderTransitionAction(action)) return { error: "订单操作不合法" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };

  try {
    await transitionOrder(user.id, orderId, action);
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
  try {
    await reviewOrder(user.id, parsed.data);
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
    await reportIssue(user.id, parsed.data);
    return { success: "举报已提交，管理员会尽快处理。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}
