"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult, ReportStatus, UserStatus, VerificationStatus } from "@/lib/types";

export async function setUserStatusAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;
  if (!userId || !["active", "suspended", "banned"].includes(status)) return { error: "用户状态不合法" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("admin_set_user_status", { p_user_id: userId, p_status: status });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "用户状态已更新。" };
}

export async function reviewVerificationAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as VerificationStatus;
  if (!userId || !["unverified", "verified", "rejected"].includes(status)) return { error: "认证状态不合法" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("admin_review_verification", {
    p_user_id: userId,
    p_status: status
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { success: "校园认证已处理。" };
}

export async function cancelOrderAsAdminAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "管理员处理");
  if (!orderId) return { error: "订单不存在" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("admin_cancel_order", { p_order_id: orderId, p_reason: reason });
  if (error) return { error: error.message };

  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${orderId}`);
  return { success: "订单已由管理员取消。" };
}

export async function updateReportAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  const note = String(formData.get("note") ?? "");
  if (!reportId || !["OPEN", "PROCESSING", "CLOSED"].includes(status)) return { error: "举报状态不合法" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("admin_update_report", {
    p_report_id: reportId,
    p_status: status,
    p_note: note
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  return { success: "举报处理结果已保存。" };
}
