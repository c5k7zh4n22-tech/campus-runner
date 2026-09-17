import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarClock, CircleUserRound, Clock3, Coins, MapPin, MessageSquareText, Phone, ShieldCheck } from "lucide-react";
import { acceptOrderAction, reportAction, reviewOrderAction, transitionOrderAction } from "@/actions/orders";
import { getCurrentProfile, getOrderById, getOrderContact, getOrderReviews, getPublicProfiles, hasReviewed } from "@/lib/data";
import { REPORT_REASON_LABELS } from "@/lib/constants";
import { isParticipant } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { ActionForm } from "@/components/ui/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrderById(id);
  return { title: order ? `订单 · ${order.description.slice(0, 18)}` : "订单详情" };
}

const timelineLabels: Array<{ status: OrderStatus; label: string }> = [
  { status: "PENDING", label: "已发布" },
  { status: "ACCEPTED", label: "已接单" },
  { status: "IN_PROGRESS", label: "执行中" },
  { status: "WAITING_CONFIRM", label: "待确认" },
  { status: "COMPLETED", label: "已完成" }
];

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, getCurrentProfile()]);
  const order = await getOrderById(id);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black">订单不存在</h1>
        <ButtonLink href="/orders" className="mt-6">返回跑腿大厅</ButtonLink>
      </div>
    );
  }

  const profiles = await getPublicProfiles([order.publisher_id, order.runner_id]);
  const participant = profile ? isParticipant(order, profile.id) : false;
  const contact = participant && ["ACCEPTED", "IN_PROGRESS", "WAITING_CONFIRM", "COMPLETED"].includes(order.status)
    ? await getOrderContact(order.id)
    : null;
  const reviews = order.status === "COMPLETED" ? await getOrderReviews(order.id) : [];
  const reviewed = profile && order.status === "COMPLETED" ? await hasReviewed(order.id, profile.id) : false;
  const currentStatusIndex = timelineLabels.findIndex((item) => item.status === order.status);

  const actionButtons: React.ReactNode[] = [];
  if (profile && order.status === "PENDING" && order.publisher_id !== profile.id) {
    actionButtons.push(
      <ActionForm key="accept" action={acceptOrderAction} confirmMessage="确认接取这个跑腿任务吗？">
        <input type="hidden" name="orderId" value={order.id} />
        <SubmitButton className="w-full" pendingText="正在抢单...">立即接单</SubmitButton>
      </ActionForm>
    );
  }
  if (profile?.id === order.runner_id && order.status === "ACCEPTED") {
    actionButtons.push(
      <ActionForm key="start" action={transitionOrderAction}>
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="start" />
        <SubmitButton className="w-full">开始执行</SubmitButton>
      </ActionForm>
    );
  }
  if (profile?.id === order.runner_id && order.status === "IN_PROGRESS") {
    actionButtons.push(
      <ActionForm key="submit" action={transitionOrderAction} confirmMessage="确认已经完成任务并提交给发布者确认吗？">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="submit" />
        <SubmitButton className="w-full">提交完成</SubmitButton>
      </ActionForm>
    );
  }
  if (profile?.id === order.publisher_id && order.status === "WAITING_CONFIRM") {
    actionButtons.push(
      <ActionForm key="confirm" action={transitionOrderAction} confirmMessage="确认任务已经完成吗？确认后订单将结束。">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="confirm" />
        <SubmitButton className="w-full">确认完成</SubmitButton>
      </ActionForm>,
      <ActionForm key="return" action={transitionOrderAction} confirmMessage="将订单退回给跑腿员继续处理吗？">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="return_to_progress" />
        <SubmitButton className="w-full" variant="outline">退回继续处理</SubmitButton>
      </ActionForm>
    );
  }
  if (profile?.id === order.publisher_id && order.status === "PENDING") {
    actionButtons.push(
      <ActionForm key="cancel-pending" action={transitionOrderAction} confirmMessage="确定取消这个待接订单吗？">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="cancel_pending" />
        <SubmitButton className="w-full" variant="danger">取消订单</SubmitButton>
      </ActionForm>
    );
  }
  if (profile && participant && ["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
    actionButtons.push(
      <ActionForm key="cancel-active" action={transitionOrderAction} confirmMessage="取消后订单将立即结束，确定继续吗？">
        <input type="hidden" name="orderId" value={order.id} />
        <input type="hidden" name="transition" value="cancel_active" />
        <SubmitButton className="w-full" variant="outline">取消进行中的订单</SubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" href="/orders"><ArrowLeft className="size-4" /> 返回跑腿大厅</Link>

      {query.created ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">订单发布成功，正在等待校园用户接单。</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={order.status} />
              <span className="text-xs text-slate-400">订单号 {order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <h1 className="mt-6 text-2xl font-black leading-9 text-slate-950 sm:text-3xl">{order.description}</h1>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-orange-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-700"><MapPin className="size-4" /> 取货地点</div>
                <div className="mt-2 font-black text-slate-800">{order.pickup_location}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700"><MapPin className="size-4" /> 送达地点</div>
                <div className="mt-2 font-black text-slate-800">{order.delivery_location}</div>
              </div>
            </div>

            <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
              <div><dt className="flex items-center gap-2 text-xs text-slate-400"><Coins className="size-4" /> 跑腿费</dt><dd className="mt-2 text-2xl font-black text-blue-700">{formatMoney(order.reward)}</dd></div>
              <div><dt className="flex items-center gap-2 text-xs text-slate-400"><CalendarClock className="size-4" /> 截止时间</dt><dd className="mt-2 text-sm font-bold text-slate-800">{formatDateTime(order.deadline)}</dd></div>
              <div><dt className="flex items-center gap-2 text-xs text-slate-400"><Clock3 className="size-4" /> 发布时间</dt><dd className="mt-2 text-sm font-bold text-slate-800">{formatDateTime(order.created_at)}</dd></div>
            </dl>
          </section>

          {order.status === "CANCELLED" ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-100 p-5">
              <div className="flex items-center gap-2 font-black text-slate-700"><AlertTriangle className="size-5" /> 订单已取消</div>
              <p className="mt-2 text-sm text-slate-500">{order.cancel_reason === "cancel_active" ? "参与者取消了订单。" : "发布者或管理员取消了订单。"}</p>
            </section>
          ) : (
            <section className="card p-5 sm:p-7">
              <h2 className="text-lg font-black">订单进度</h2>
              <div className="mt-6 grid gap-2 sm:grid-cols-5">
                {timelineLabels.map((item, index) => {
                  const complete = currentStatusIndex >= index;
                  return (
                    <div key={item.status} className="flex items-center gap-3 sm:block">
                      <div className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${complete ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>{index + 1}</div>
                      <div className={`mt-0 text-xs font-bold sm:mt-2 ${complete ? "text-slate-800" : "text-slate-400"}`}>{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {contact ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
              <div className="flex items-center gap-2 font-black text-emerald-900"><Phone className="size-5" /> 联系信息</div>
              <p className="mt-2 text-xs text-emerald-800/70">订单已建立参与关系，以下信息仅你和对方可见。</p>
              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="font-black text-slate-900">{contact.display_name}</div>
                <div className="mt-1 text-sm text-slate-600">{contact.phone || "对方未填写手机号"}</div>
                <div className="mt-1 text-xs text-slate-400">{contact.email}</div>
              </div>
            </section>
          ) : participant && order.status !== "PENDING" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">联系方式仅在有效进行中的订单中显示。</section>
          ) : null}

          {order.status === "COMPLETED" && participant && profile ? (
            <section className="card p-5 sm:p-7">
              <div className="flex items-center gap-2"><MessageSquareText className="size-5 text-blue-600" /><h2 className="text-lg font-black">订单评价</h2></div>
              {reviews.length ? (
                <div className="mt-4 space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center gap-2 text-amber-500">{"★".repeat(review.rating)}<span className="text-xs text-slate-400">{review.reviewer_id === profile.id ? "我的评价" : "对方评价"}</span></div>
                      {review.comment ? <p className="mt-2 text-sm text-slate-600">{review.comment}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {!reviewed ? (
                <ActionForm action={reviewOrderAction} className="mt-5 grid gap-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="revieweeId" value={profile.id === order.publisher_id ? order.runner_id || "" : order.publisher_id} />
                  <label className="label">评分<select className="field" name="rating" defaultValue="5"><option value="5">5 分 · 非常好</option><option value="4">4 分 · 很好</option><option value="3">3 分 · 一般</option><option value="2">2 分 · 较差</option><option value="1">1 分 · 很差</option></select></label>
                  <label className="label">文字评价（选填）<textarea className="field min-h-24" name="comment" maxLength={500} placeholder="分享这次合作体验..." /></label>
                  <SubmitButton>提交评价</SubmitButton>
                </ActionForm>
              ) : <p className="mt-4 text-sm text-slate-500">你已提交评价。</p>}
            </section>
          ) : null}

          {profile && !participant && order.status === "COMPLETED" ? (
            <section className="card p-5 text-sm text-slate-500">订单评价仅对本次订单参与者可见。</section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><BadgeCheck className="size-4 text-blue-600" /> 参与用户</div>
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-sm font-black text-orange-700">{profiles[order.publisher_id]?.display_name?.slice(0, 1) || "发"}</div>
                <div className="min-w-0"><div className="font-bold text-slate-800">{profiles[order.publisher_id]?.display_name || "发布者"}</div><div className="text-xs text-slate-400">发布者 · 评分 {Number(profiles[order.publisher_id]?.rating || 5).toFixed(1)}</div></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-blue-50 text-sm font-black text-blue-700">{order.runner_id ? profiles[order.runner_id]?.display_name?.slice(0, 1) || "跑" : <CircleUserRound className="size-5" />}</div>
                <div className="min-w-0"><div className="font-bold text-slate-800">{order.runner_id ? profiles[order.runner_id]?.display_name || "跑腿员" : "等待接单"}</div><div className="text-xs text-slate-400">跑腿员 {order.runner_id ? `· 评分 ${Number(profiles[order.runner_id]?.rating || 5).toFixed(1)}` : ""}</div></div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="size-4 text-emerald-600" /> 订单操作</div>
            {profile ? (
              <>
                <div className="mt-4 grid gap-3">{actionButtons.length ? actionButtons : <p className="text-sm leading-6 text-slate-500">当前身份和订单状态下没有可执行操作。</p>}</div>
                {participant && order.status !== "COMPLETED" && order.status !== "CANCELLED" ? (
                  <details className="mt-5 border-t border-slate-100 pt-4">
                    <summary className="cursor-pointer text-xs font-bold text-rose-600">举报异常订单</summary>
                    <ActionForm action={reportAction} className="mt-3 grid gap-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <select className="field" name="reason" defaultValue="fake_order">{Object.entries(REPORT_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                      <textarea className="field min-h-20" name="details" placeholder="请描述具体情况" minLength={5} required />
                      <SubmitButton variant="danger">提交举报</SubmitButton>
                    </ActionForm>
                  </details>
                ) : null}
              </>
            ) : (
              <div className="mt-4"><ButtonLink href="/login" className="w-full">登录后操作</ButtonLink></div>
            )}
          </section>

          <div className="rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-white/60">
            <strong className="block text-white">安全提示</strong>
            平台不会在公开大厅展示手机号。接单后请先确认任务细节，涉及贵重物品请当面核对。
          </div>
        </aside>
      </div>

      {!participant && order.status === "PENDING" && profile ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <ActionForm action={acceptOrderAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton className="w-full" pendingText="正在抢单...">立即接单 · {formatMoney(order.reward)}</SubmitButton>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
