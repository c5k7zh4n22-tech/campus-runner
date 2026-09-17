import { z } from "zod";

const nonEmptyText = (label: string) =>
  z.string().trim().min(1, `${label}不能为空`).max(120, `${label}不能超过 120 个字`);

export const loginSchema = z.object({
  email: z.email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少需要 6 位")
});

export const registerSchema = z.object({
  displayName: z.string().trim().min(2, "昵称至少需要 2 个字").max(30, "昵称不能超过 30 个字"),
  email: z.email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少需要 8 位").max(72, "密码不能超过 72 位")
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, "昵称至少需要 2 个字").max(30, "昵称不能超过 30 个字"),
  campusId: z.uuid("当前学校不可用，请刷新页面后重试")
});

export const verificationSchema = z.object({
  studentId: z.string().trim().regex(/^\d{12}$/, "学号必须为 12 位数字"),
  phone: z.string().trim().regex(/^1[3-9]\d{9}$/, "请输入有效的 11 位手机号")
});

export const orderSchema = z.object({
  campusId: z.uuid("请选择学校"),
  pickupLocation: nonEmptyText("取货地点"),
  deliveryLocation: nonEmptyText("送达地点"),
  description: z.string().trim().min(5, "跑腿描述至少需要 5 个字").max(500, "跑腿描述不能超过 500 个字"),
  reward: z.coerce.number().positive("跑腿费必须大于 0").max(9999, "跑腿费不能超过 9999 元"),
  deadline: z.string().refine((value) => Boolean(value) && new Date(value).getTime() > Date.now(), "截止时间必须晚于当前时间")
});

export const reviewSchema = z.object({
  orderId: z.uuid(),
  revieweeId: z.uuid(),
  rating: z.coerce.number().int().min(1, "评分最低为 1").max(5, "评分最高为 5"),
  comment: z.string().trim().max(500, "评论不能超过 500 个字").or(z.literal(""))
});

export const reportSchema = z.object({
  orderId: z.uuid().or(z.literal("")),
  reportedUserId: z.uuid().or(z.literal("")),
  reason: z.enum(["fake_order", "malicious_cancel", "fraud", "rude_behavior", "other"]),
  details: z.string().trim().min(5, "请补充至少 5 个字的说明").max(1000, "说明不能超过 1000 个字")
}).refine((data) => data.orderId || data.reportedUserId, {
  path: ["details"],
  message: "必须选择举报订单或用户"
});
