import Link from "next/link";
import { Clock3, MapPin } from "lucide-react";
import type { Order, PublicProfile } from "@/lib/types";
import { formatDateTime, formatMoney, formatRelativeTime } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

export function OrderCard({ order, publisher }: { order: Order; publisher?: PublicProfile }) {
  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition sm:rounded-3xl sm:p-5 sm:hover:-translate-y-0.5 sm:hover:border-blue-200 sm:hover:shadow-lg sm:hover:shadow-blue-950/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            <span className="text-xs text-slate-400">{formatRelativeTime(order.created_at)}</span>
          </div>
          <h3 className="line-clamp-2 text-base font-black leading-6 text-slate-900">{order.description}</h3>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-black text-blue-700">{formatMoney(order.reward)}</div>
          <div className="mt-1 text-[11px] text-slate-400">跑腿费</div>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm sm:mt-5">
        <div className="flex gap-3">
          <MapPin className="mt-0.5 size-4 shrink-0 text-orange-500" />
          <div className="min-w-0 text-slate-600">
            <span className="font-semibold text-slate-800">{order.pickup_location}</span>
            <span className="mx-2 text-slate-300">→</span>
            <span className="font-semibold text-slate-800">{order.delivery_location}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <Clock3 className="size-4 shrink-0 text-blue-500" />
          <span>截止 {formatDateTime(order.deadline)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:mt-5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
            {publisher?.display_name?.slice(0, 1) || "校"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-700">{publisher?.display_name || "校园用户"}</div>
            <div className="text-[10px] text-slate-400">
              {publisher?.verification_status === "verified" ? "已通过校园认证" : "校园用户"}
            </div>
          </div>
        </div>
        <Link href={`/orders/${order.id}`} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-blue-50 px-3 text-sm font-bold text-blue-700 transition group-hover:gap-2">
          {order.status === "PENDING" ? "去接单" : "详情"} <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
