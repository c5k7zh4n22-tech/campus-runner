import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Car, CheckCircle2, ClipboardList, Clock3, ListChecks, PackageCheck, Search, ShieldCheck, ShoppingBag, Store, UserRound, type LucideIcon } from "lucide-react";
import { getCurrentProfile, getDashboardData, getOrderPublishers, getOrders } from "@/lib/data";
import { getMarketplaceListings } from "@/lib/marketplace";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { OrderCard } from "@/components/OrderCard";
import { SetupNotice } from "@/components/SetupNotice";
import { ButtonLink } from "@/components/ui/Button";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const [data, marketplaceListings] = await Promise.all([
    profile
      ? getDashboardData(profile.id, profile.campus_id)
      : getOrders({ status: "PENDING", sort: "newest", limit: 4 }).then((recentOrders) => ({
          openCount: recentOrders.length,
          myActiveCount: 0,
          waitingConfirmCount: 0,
          recentOrders
        })),
    getMarketplaceListings({ status: "ACTIVE", sort: "newest", limit: 4 })
  ]);
  const publishers = await getOrderPublishers(data.recentOrders);
  const greetingName = profile?.display_name || "同学";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
      <SetupNotice />

      <section className="rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-200">
              <span className="size-2 rounded-full bg-emerald-400" />
              {profile?.campus_id ? "莆田学院" : "Campus Runner"}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">你好，{greetingName}</h1>
            <p className="mt-2 text-sm leading-6 text-white/65">今天需要帮忙吗？</p>
          </div>
          <Link href={profile ? "/profile" : "/login"} className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15" aria-label="个人中心">
            {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="48px" className="object-cover" /> : <UserRound className="size-6 text-white/70" />}
          </Link>
        </div>

        <Link href="/orders" className="mt-5 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-sm font-bold text-slate-500 shadow-sm">
          <Search className="size-5 text-blue-600" />
          搜索跑腿任务、取件地点
        </Link>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HomeAction href="/orders" icon={ClipboardList} label="接跑腿" hint="看看谁需要帮忙" />
          <HomeAction href="/carpool" icon={Car} label="同路结伴" hint="发布同路信息" highlight />
          <HomeAction href={profile ? "/my-orders" : "/login"} icon={ListChecks} label="我的订单" hint="查看进度和确认" />
          <HomeAction href="/marketplace" icon={Store} label="校园闲置" hint="同校好物流转" />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          { label: "待接任务", value: data.openCount, icon: PackageCheck, color: "text-blue-600" },
          { label: "进行中", value: data.myActiveCount, icon: Clock3, color: "text-violet-600" },
          { label: "待确认", value: data.waitingConfirmCount, icon: CheckCircle2, color: "text-orange-500" },
          { label: "校园认证", value: profile?.verification_status === "verified" ? "已认证" : "去认证", icon: BadgeCheck, color: "text-emerald-600" }
        ] satisfies Array<{ label: string; value: string | number; icon: LucideIcon; color: string }>).map(({ label, value, icon: StatIcon, color }) => (
          <div key={label} className="card p-4 sm:p-5">
            <StatIcon className={`size-5 ${color}`} />
            <div className="mt-3 text-2xl font-black">{value}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
          </div>
        ))}
      </section>

      {profile && profile.verification_status !== "verified" ? (
        <section className="mt-5 flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-orange-600" />
            <div>
              <strong className="text-sm text-orange-950">完成校园认证后才能接单</strong>
              <p className="mt-1 text-xs leading-5 text-orange-800/75">提交 12 位学号和手机号，由管理员审核。</p>
            </div>
          </div>
          <ButtonLink href="/profile" variant="outline" className="border-orange-300 text-orange-800 hover:border-orange-500">前往认证</ButtonLink>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Open orders</div>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">热门跑腿任务</h2>
          </div>
          <Link href="/orders" className="shrink-0 text-sm font-bold text-blue-700">全部</Link>
        </div>
        {data.recentOrders.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.recentOrders.map((order) => <OrderCard key={order.id} order={order} publisher={publishers[order.publisher_id]} />)}
          </div>
        ) : (
          <EmptyState title="暂时没有待接任务" description="可以发布一个任务，让同学顺路帮忙。" action={<ButtonLink href="/orders/create">发布跑腿</ButtonLink>} />
        )}
      </section>

      <section className="mt-9">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Campus market</div>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">校园二手</h2>
          </div>
          <Link href="/marketplace" className="shrink-0 text-sm font-bold text-blue-700">去逛</Link>
        </div>
        {marketplaceListings.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {marketplaceListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            <ShoppingBag className="mb-3 size-6 text-blue-600" />
            暂时没有在售闲置。
          </div>
        )}
      </section>
    </div>
  );
}

function HomeAction({ href, icon: Icon, label, hint, highlight }: { href: string; icon: LucideIcon; label: string; hint: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`rounded-2xl p-3 ${highlight ? "bg-blue-600 text-white" : "bg-white/10 text-white ring-1 ring-white/10"}`}>
      <span className={`grid size-9 place-items-center rounded-xl ${highlight ? "bg-white/15" : "bg-white/10"}`}><Icon className="size-5" /></span>
      <strong className="mt-3 block text-sm">{label}</strong>
      <span className={`mt-1 block text-[11px] leading-4 ${highlight ? "text-blue-50/80" : "text-white/55"}`}>{hint}</span>
    </Link>
  );
}
