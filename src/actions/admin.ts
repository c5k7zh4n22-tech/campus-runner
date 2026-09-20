"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { ActionResult, ReportStatus, UserStatus, VerificationStatus } from "@/lib/types";

export async function setUserStatusAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as UserStatus;
  if (!userId || !["active", "suspended", "banned"].includes(status)) return { error: "用户状态不合法" };
  if (userId === admin.id) return { error: "不能修改自己的管理员状态" };
  try {
    await query("update profiles set status = $1, updated_at = now() where id = $2", [status, userId]);
    revalidatePath("/admin/users");
    return { success: "用户状态已更新。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function reviewVerificationAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as VerificationStatus;
  if (!userId || !["unverified", "verified", "rejected"].includes(status)) return { error: "认证状态不合法" };
  try {
    await query("update profiles set verification_status = $1, updated_at = now() where id = $2", [status, userId]);
    revalidatePath("/admin/users");
    return { success: "校园认证已处理。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function cancelOrderAsAdminAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const reason = String(formData.get("reason") ?? "管理员处理");
  if (!orderId) return { error: "订单不存在" };
  try {
    await query("update orders set status = 'CANCELLED', cancelled_at = now(), cancel_reason = $1 where id = $2", [reason, orderId]);
    revalidatePath("/admin/orders");
    revalidatePath(`/orders/${orderId}`);
    return { success: "订单已由管理员取消。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function updateReportAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "") as ReportStatus;
  const note = String(formData.get("note") ?? "");
  if (!reportId || !["OPEN", "PROCESSING", "CLOSED"].includes(status)) return { error: "举报状态不合法" };
  try {
    await query(
      "update reports set status = $1, resolution_note = $2, resolved_by = $3, resolved_at = case when $1 = 'CLOSED' then now() else null end where id = $4",
      [status, note || null, admin.id, reportId]
    );
    revalidatePath("/admin/reports");
    return { success: "举报处理结果已保存。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}
