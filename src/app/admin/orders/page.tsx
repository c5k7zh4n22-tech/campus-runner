import { cancelOrderAsAdminAction } from "@/actions/admin";
import { getAdminOrders, getPublicProfiles } from "@/lib/data";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { AdminNav } from "@/components/AdminNav";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const orders = await getAdminOrders(params.status);
  const profiles = await getPublicProfiles(orders.flatMap((order) => [order.publisher_id, order.runner_id]));

  return (
    <>
      <AdminNav active="/admin/orders" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">Orders</div><h1 className="page-title mt-3">订单管理</h1><p className="mt-3 text-sm text-slate-500">查看全站订单并处理异常状态。</p></div>
        <form className="flex gap-2"><select className="field min-w-36" name="status" defaultValue={params.status || "ALL"}><option value="ALL">全部状态</option>{Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">筛选</button></form>
      </div>

      <div className="mt-7 space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge status={order.status} /><span className="text-xs text-slate-400">{formatDateTime(order.created_at)}</span></div>
                <h2 className="mt-3 font-black text-slate-900">{order.description}</h2>
                <p className="mt-2 text-sm text-slate-500">{order.pickup_location} → {order.delivery_location}</p>
                <p className="mt-2 text-xs text-slate-400">发布者：{profiles[order.publisher_id]?.display_name || "未知"} · 跑腿员：{order.runner_id ? profiles[order.runner_id]?.display_name || "未知" : "未接单"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                <strong className="text-xl text-blue-700">{formatMoney(order.reward)}</strong>
                {!["COMPLETED", "CANCELLED"].includes(order.status) ? (
                  <ActionForm action={cancelOrderAsAdminAction} confirmMessage="确定由管理员取消该订单吗？" className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input className="field min-w-48" name="reason" placeholder="处理原因" defaultValue="异常订单处理" />
                    <SubmitButton variant="danger" className="min-h-11">取消订单</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {!orders.length ? <div className="card p-8 text-center text-sm text-slate-400">没有符合条件的订单。</div> : null}
      </div>
    </>
  );
}
