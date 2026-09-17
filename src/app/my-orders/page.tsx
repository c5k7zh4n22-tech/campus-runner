import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { getMyOrders, getPublicProfiles } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { OrderCard } from "@/components/OrderCard";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "我的订单" };

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const allOrders = await getMyOrders(profile.id);
  const role = params.role === "published" || params.role === "accepted" ? params.role : "all";
  const orders = allOrders.filter((order) => {
    if (role === "published") return order.publisher_id === profile.id;
    if (role === "accepted") return order.runner_id === profile.id;
    return true;
  });
  const profiles = await getPublicProfiles(orders.flatMap((order) => [order.publisher_id, order.runner_id]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">My orders</div>
          <h1 className="page-title mt-3">我的订单</h1>
          <p className="mt-3 text-sm text-slate-500">查看我发布和接取的跑腿任务。</p>
        </div>
        <ButtonLink href="/orders/create"><Plus className="size-4" /> 发布跑腿</ButtonLink>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto">
        {[
          ["all", "全部"],
          ["published", "我发布的"],
          ["accepted", "我接取的"]
        ].map(([value, label]) => (
          <Link key={value} href={value === "all" ? "/my-orders" : `/my-orders?role=${value}`} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${role === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{label}</Link>
        ))}
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orders.length ? orders.map((order) => <OrderCard key={order.id} order={order} publisher={profiles[order.publisher_id]} />) : (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState icon={ClipboardList} title="这里还没有订单" description="发布任务，或者去大厅接取一个顺路的跑腿。" action={<ButtonLink href="/orders">浏览跑腿大厅</ButtonLink>} />
          </div>
        )}
      </section>
    </div>
  );
}
