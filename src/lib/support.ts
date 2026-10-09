import { z } from "zod";
import type { SupportAttachment } from "./support-attachments";

export const SUPPORT_CATEGORIES = { order: "订单问题", refund: "退款与费用", account: "账号与认证", feedback: "意见反馈", carpool: "同路结伴问题 / 举报" };
export const SUPPORT_STATUSES = { OPEN: "待受理", PROCESSING: "处理中", WAITING_USER: "待补充", RESOLVED: "已解决", CLOSED: "已关闭" };
export type SupportStatus = keyof typeof SUPPORT_STATUSES;
export interface SupportTicket {
  id: string; owner_id: string; order_id: string | null; trip_id: string | null; category: keyof typeof SUPPORT_CATEGORIES;
  subject: string; status: SupportStatus; assigned_to: string | null; version: number;
  created_at: string; updated_at: string; owner_name: string; agent_name: string | null;
}
export interface SupportEntry { id: string; actor_id: string; actor_role: "user" | "admin"; body: string; kind: string; status: SupportStatus | null; created_at: string; attachments: SupportAttachment[] }
export interface SupportDetail { ticket: SupportTicket; entries: SupportEntry[]; hasMore: boolean; isAdmin: boolean; isOwner: boolean }

const category = z.enum(["order", "refund", "account", "feedback", "carpool"]);
const status = z.enum(["OPEN", "PROCESSING", "WAITING_USER", "RESOLVED", "CLOSED"]);
export const supportQuery = z.object({
  view: z.enum(["list", "detail", "orders"]).default("list"),
  admin: z.enum(["true", "false"]).default("false"),
  id: z.uuid().optional(), status: status.optional(),
  page: z.coerce.number().int().min(0).max(10000).default(0),
  before: z.string().regex(/^[1-9]\d{0,17}$/).optional()
}).refine((v) => v.view !== "detail" || Boolean(v.id));
export const supportMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), category, subject: z.string().trim().min(2).max(80), body: z.string().trim().min(5).max(4000), orderId: z.uuid().optional(), tripId: z.uuid().optional(), clientId: z.uuid() }),
  z.object({ action: z.literal("reply"), id: z.uuid(), body: z.string().trim().min(1).max(4000), clientId: z.uuid() }),
  z.object({ action: z.literal("status"), id: z.uuid(), status, body: z.string().trim().min(2).max(4000), version: z.number().int().positive(), clientId: z.uuid() })
]);
export class SupportError extends Error { constructor(message: string, public status = 400) { super(message); } }

export function canChangeSupportStatus(current: SupportStatus, next: SupportStatus, admin: boolean) {
  if (current === next) return false;
  if (!admin) return (next === "CLOSED" && current !== "CLOSED") || (next === "OPEN" && ["RESOLVED", "CLOSED"].includes(current));
  if (current === "CLOSED") return next === "OPEN";
  if (next === "OPEN") return current === "RESOLVED";
  return true;
}
