import "server-only";

import { query } from "@/lib/db";
import type { ReportStatus, UserStatus, VerificationStatus } from "@/lib/types";

export async function setUserStatus(adminId: string, userId: string, status: UserStatus) {
  if (userId === adminId) throw new Error("不能修改自己的管理员状态");
  await query("update profiles set status = $1, updated_at = now() where id = $2", [status, userId]);
}

export async function reviewUserVerification(userId: string, status: VerificationStatus) {
  await query("update profiles set verification_status = $1, updated_at = now() where id = $2", [status, userId]);
}

export async function cancelOrderAsAdmin(orderId: string, reason: string) {
  await query("update orders set status = 'CANCELLED', cancelled_at = now(), cancel_reason = $1 where id = $2", [reason, orderId]);
}

export async function updateReport(adminId: string, input: { reportId: string; status: ReportStatus; note: string }) {
  await query(
    "update reports set status = $1, resolution_note = $2, resolved_by = $3, resolved_at = case when $1 = 'CLOSED' then now() else null end where id = $4",
    [input.status, input.note || null, adminId, input.reportId]
  );
}
