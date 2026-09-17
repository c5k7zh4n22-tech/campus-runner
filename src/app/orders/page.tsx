import type { Metadata } from "next";
import Link from "next/link";
import { Filter, PackageSearch, Plus, SlidersHorizontal } from "lucide-react";
import { getCurrentProfile, getOrderPublishers, getOrders } from "@/lib/data";
import type { OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { OrderCard } from "@/components/OrderCard";
import { SetupNotice } from "@/components/SetupNotice";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "跑腿大厅" };

type SearchParams = Promise<{ status?: string; sort?: string; campus?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const profile = await getCurrentProfile();
  const selectedStatus = (params.status || "PENDING") as OrderStatus | "ALL";
  const selectedSort = (params.sort || "newest") as "newest" | "deadline" | "reward";
  const campusId = params.campus || profile?.campus_id || undefined;
  const orders = await getOrders({ campusId, status: selectedStatus, sort: selectedSort });
  const publishers = await getOrderPublishers(orders);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <SetupNotice />
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Order hall</div>
          <h1 className="page-title mt-3">跑腿大厅</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">找到顺路能帮的小任务。所有接单都需要通过校园身份认证。</p>
        </div>
        <ButtonLink href="/orders/create"><Plus className="size-4" /> 发布跑腿</ButtonLink>
      </div>

      <form className="card mt-8 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="label">
          <span className="flex items-center gap-2"><Filter className="size-4" /> 状态</span>
          <select className="field" name="status" defaultValue={selectedStatus}>
            <option value="PENDING">待接单</option>
            <option value="ACCEPTED">已接单</option>
            <option value="IN_PROGRESS">进行中</option>
            <option value="COMPLETED">已完成</option>
            <option value="ALL">全部状态</option>
          </select>
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> 排序</span>
          <select className="field" name="sort" defaultValue={selectedSort}>
            <option value="newest">最新发布</option>
            <option value="deadline">截止时间优先</option>
            <option value="reward">跑腿费最高</option>
          </select>
        </label>
        <button className="min-h-11 self-end rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800" type="submit">
          应用筛选
        </button>
        {campusId ? <input type="hidden" name="campus" value={campusId} /> : null}
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
        <span>共找到 {orders.length} 个订单</span>
        {profile?.campus_id ? <span>仅显示当前校园订单</span> : <span>登录并选择学校后可按校园筛选</span>}
      </div>

      <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orders.length ? orders.map((order) => (
          <OrderCard key={order.id} order={order} publisher={publishers[order.publisher_id]} />
        )) : (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={PackageSearch}
              title={selectedStatus === "PENDING" ? "当前没有待接订单" : "没有符合条件的订单"}
              description="可以调整筛选条件，或发布一个自己的跑腿任务。"
              action={<ButtonLink href="/orders/create">发布跑腿</ButtonLink>}
            />
          </div>
        )}
      </section>

      {!profile ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          想接单？ <Link className="font-bold text-blue-700" href="/login">先登录</Link>
        </p>
      ) : null}
    </div>
  );
}
