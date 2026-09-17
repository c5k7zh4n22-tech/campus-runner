import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, MapPin, PackageCheck, Plus, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { getCurrentProfile, getDashboardData, getOrderPublishers } from "@/lib/data";
import { EmptyState } from "@/components/EmptyState";
import { OrderCard } from "@/components/OrderCard";
import { SetupNotice } from "@/components/SetupNotice";
import { ButtonLink } from "@/components/ui/Button";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const data = profile
    ? await getDashboardData(profile.id, profile.campus_id)
    : { openCount: 0, myActiveCount: 0, waitingConfirmCount: 0, recentOrders: [] };
  const publishers = await getOrderPublishers(data.recentOrders);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <SetupNotice />

      {!profile ? (
        <>
          <section className="grid overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 sm:p-12 lg:p-16">
              <div className="eyebrow">Campus mutual aid</div>
              <h1 className="mt-4 max-w-2xl text-4xl font-black leading-tight tracking-[-0.05em] text-slate-950 sm:text-6xl">
                校园里的小事，<br />
                <span className="text-blue-700">顺手就有人帮。</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
                发布代取快递、代买物品、送文件等跑腿任务。实名校园认证用户接单，状态实时可见，完成后互相评价。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/register" className="min-h-12 px-6">
                  免费注册 <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/orders" variant="outline" className="min-h-12 px-6">
                  先看跑腿大厅
                </ButtonLink>
              </div>
              <div className="mt-9 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                <span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />校园身份审核</span>
                <span className="flex items-center gap-2"><Clock3 className="size-4 text-blue-600" />订单状态透明</span>
                <span className="flex items-center gap-2"><BadgeCheck className="size-4 text-orange-500" />双向评价</span>
              </div>
            </div>
            <div className="relative min-h-[420px] overflow-hidden bg-slate-950 p-7 text-white sm:p-12">
              <div className="absolute -right-20 -top-20 size-64 rounded-full bg-blue-500/30 blur-3xl" />
              <div className="absolute -bottom-24 -left-16 size-72 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="inline-flex w-max items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold ring-1 ring-white/15">
                  <Sparkles className="size-3.5 text-blue-300" /> 今日校园互助
                </div>
                <div className="my-9 space-y-3">
                  <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">待接单</span>
                      <strong className="text-blue-700">¥8</strong>
                    </div>
                    <p className="mt-3 font-black">帮忙取一下菜鸟驿站快递</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><MapPin className="size-3.5 text-orange-500" />菜鸟驿站 → 3 号宿舍楼下</p>
                  </div>
                  <div className="translate-x-8 rounded-2xl bg-blue-600 p-4 shadow-2xl">
                    <div className="flex items-center justify-between text-xs"><span className="font-bold">跑腿员已接单</span><CheckCircle2 className="size-4" /></div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="size-9 rounded-full bg-white/20" />
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-2/3 rounded-full bg-white" /></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/50">每一单都由校园用户真实发布</p>
              </div>
            </div>
          </section>

          <section className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              ["01", "发布任务", "填写取送地点、跑腿费和截止时间。"],
              ["02", "等待接单", "已认证的校园用户查看并接取任务。"],
              ["03", "完成确认", "跑腿员提交，发布者确认后完成并评价。"]
            ].map(([step, title, text]) => (
              <article key={step} className="card p-6">
                <span className="text-xs font-black text-blue-600">{step}</span>
                <h2 className="mt-8 text-xl font-black">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </article>
            ))}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl sm:p-9">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  {profile.campus_id ? "已加入当前校园" : "请先完善学校信息"}
                </div>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">你好，{profile.display_name}</h1>
                <p className="mt-2 text-sm text-white/55">今天想发布任务，还是顺手帮个忙？</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/orders/create" className="bg-blue-600 text-white hover:bg-blue-500">
                  <Plus className="size-4" /> 发布跑腿
                </ButtonLink>
                <ButtonLink href="/orders" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15">去接单</ButtonLink>
              </div>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              { label: "待接订单", value: data.openCount, icon: PackageCheck, color: "text-blue-600" },
              { label: "我的进行中", value: data.myActiveCount, icon: Clock3, color: "text-violet-600" },
              { label: "待我确认", value: data.waitingConfirmCount, icon: CheckCircle2, color: "text-orange-500" },
              { label: "校园认证", value: profile.verification_status === "verified" ? "已通过" : "未通过", icon: BadgeCheck, color: "text-emerald-600" }
            ] satisfies Array<{ label: string; value: string | number; icon: LucideIcon; color: string }>).map(({ label, value, icon: StatIcon, color }) => (
              <div key={label} className="card p-4 sm:p-5">
                <StatIcon className={`size-5 ${color}`} />
                <div className="mt-4 text-2xl font-black">{value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
              </div>
            ))}
          </section>

          {profile.verification_status !== "verified" ? (
            <section className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-orange-600" />
                <div>
                  <strong className="text-sm text-orange-950">完成校园认证后才能接单</strong>
                  <p className="mt-1 text-xs leading-5 text-orange-800/75">填写学号和手机号，由管理员人工审核。</p>
                </div>
              </div>
              <ButtonLink href="/profile" variant="outline" className="border-orange-300 text-orange-800 hover:border-orange-500">前往认证</ButtonLink>
            </section>
          ) : null}

          <section className="mt-12">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="eyebrow">Open orders</div>
                <h2 className="mt-2 text-2xl font-black">最新跑腿</h2>
              </div>
              <Link href="/orders" className="text-sm font-bold text-blue-700">查看全部 →</Link>
            </div>
            {data.recentOrders.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.recentOrders.map((order) => <OrderCard key={order.id} order={order} publisher={publishers[order.publisher_id]} />)}
              </div>
            ) : (
              <EmptyState title="暂时没有待接订单" description="成为第一个发布任务的人吧。" action={<ButtonLink href="/orders/create">发布跑腿</ButtonLink>} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
