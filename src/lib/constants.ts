import type { OrderStatus, ReportStatus } from "./types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "待接单",
  ACCEPTED: "已接单",
  IN_PROGRESS: "进行中",
  WAITING_CONFIRM: "待确认",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};

export const VERIFICATION_LABELS = {
  unverified: "未认证",
  pending: "审核中",
  verified: "已认证",
  rejected: "未通过"
} as const;

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "待处理",
  PROCESSING: "处理中",
  CLOSED: "已关闭"
};

export const REPORT_REASON_LABELS = {
  fake_order: "虚假订单",
  malicious_cancel: "恶意取消",
  fraud: "欺诈",
  rude_behavior: "不文明行为",
  other: "其他"
} as const;

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  ACCEPTED: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-200",
  WAITING_CONFIRM: "bg-orange-50 text-orange-700 ring-orange-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200"
};

export const LISTING_STATUS_LABELS = {
  ACTIVE: "在售",
  RESERVED: "已预订",
  SOLD: "已售出",
  REMOVED: "已下架"
} as const;

export const LISTING_CATEGORY_LABELS = {
  books: "教材书籍",
  electronics: "数码电子",
  daily: "生活用品",
  clothing: "服饰鞋包",
  sports: "运动户外",
  tickets: "票券卡类",
  other: "其他"
} as const;

export const LISTING_CONDITION_LABELS = {
  new: "全新",
  like_new: "几乎全新",
  good: "成色良好",
  fair: "正常使用"
} as const;

export const LISTING_STATUS_TONE = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  RESERVED: "bg-amber-50 text-amber-700 ring-amber-200",
  SOLD: "bg-slate-100 text-slate-600 ring-slate-200",
  REMOVED: "bg-rose-50 text-rose-700 ring-rose-200"
} as const;
