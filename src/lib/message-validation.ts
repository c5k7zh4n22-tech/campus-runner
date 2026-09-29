import { z } from "zod";

export const messageQuerySchema = z.object({
  view: z.enum(["inbox", "summary", "thread", "notifications"]).default("inbox"),
  id: z.uuid().optional(),
  category: z.enum(["order", "system"]).optional(),
  search: z.string().trim().max(80).default(""),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  before: z.string().regex(/^[1-9]\d{0,17}$/).optional(),
  after: z.string().regex(/^[1-9]\d{0,17}$/).optional()
}).refine((v) => v.view !== "thread" || Boolean(v.id), { message: "缺少会话编号" })
  .refine((v) => v.view !== "notifications" || Boolean(v.category), { message: "缺少通知分类" });

export const messageMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), kind: z.enum(["order", "listing"]), id: z.uuid() }),
  z.object({ action: z.literal("send"), id: z.uuid(), body: z.string().trim().min(1).max(2000), clientId: z.uuid() }),
  z.object({ action: z.literal("read"), id: z.uuid(), through: z.string().regex(/^[1-9]\d{0,17}$/) }),
  z.object({ action: z.literal("read-notifications"), category: z.enum(["order", "system"]), ids: z.array(z.string().regex(/^[1-9]\d{0,17}$/)).max(50) }),
  z.object({ action: z.literal("read-all") }),
  z.object({ action: z.literal("announce"), title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(2000) })
]);

export class MessageError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function unreadLabel(count: number) { return count > 99 ? "99+" : String(count); }
