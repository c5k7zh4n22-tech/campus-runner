import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BadgeCheck, Coins, MapPin, MessageSquareText, Phone, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { expressInterestAction, markListingSoldAction, removeListingAction, respondInterestAction } from "@/actions/marketplace";
import { reportAction } from "@/actions/orders";
import { getCurrentProfile, getPublicProfiles } from "@/lib/data";
import { getListingInterests, getMarketplaceContact, getMarketplaceListing } from "@/lib/marketplace";
import { LISTING_CATEGORY_LABELS, LISTING_CONDITION_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getMarketplaceListing(id);
  return { title: listing ? `闲置 · ${listing.title}` : "闲置详情" };
}

export default async function ListingDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, getCurrentProfile()]);
  const listing = await getMarketplaceListing(id);

  if (!listing) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black">闲置商品不存在</h1>
        <ButtonLink href="/marketplace" className="mt-6">返回闲置市场</ButtonLink>
      </div>
    );
  }

  const [profiles, interests, contact] = await Promise.all([
    getPublicProfiles([listing.seller_id, listing.buyer_id]),
    getListingInterests(listing.id),
    getMarketplaceContact(listing.id).catch(() => null)
  ]);
  const isSeller = profile?.id === listing.seller_id;
  const isAdmin = profile?.role === "admin";
  const myInterest = interests.find((interest) => interest.buyer_id === profile?.id);
  const seller = profiles[listing.seller_id];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" href="/marketplace"><ArrowLeft className="size-4" /> 返回闲置市场</Link>
      {query.created ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">商品发布成功。</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="grid min-h-[360px] place-items-center bg-gradient-to-br from-slate-100 to-blue-50">
              {listing.image_url ? <img src={listing.image_url} alt={listing.title} className="h-full max-h-[620px] w-full object-contain" /> : <ShoppingBag className="size-24 text-blue-200" />}
            </div>
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <ListingStatusBadge status={listing.status} />
                <span className="text-xs text-slate-400">发布于 {formatDateTime(listing.created_at)}</span>
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">{listing.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <strong className="text-3xl font-black text-blue-700">{listing.price === 0 ? "免费" : formatMoney(listing.price)}</strong>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{LISTING_CATEGORY_LABELS[listing.category]}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{LISTING_CONDITION_LABELS[listing.item_condition]}</span>
              </div>
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">{listing.description}</p>
              <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400"><MapPin className="size-4" /> 莆田学院 · 线下自行约定交易地点</div>
            </div>
          </section>

          {contact ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
              <div className="flex items-center gap-2 font-black text-emerald-900"><Phone className="size-5" /> 联系方式</div>
              <p className="mt-2 text-xs text-emerald-800/70">卖家已接受购买申请，以下联系方式仅订单双方可见。</p>
              <div className="mt-4 rounded-2xl bg-white p-4">
                <div className="font-black text-slate-900">{contact.display_name}</div>
                <div className="mt-1 text-sm text-slate-600">{contact.phone || "对方未填写手机号"}</div>
                <div className="mt-1 text-xs text-slate-400">{contact.email}</div>
              </div>
            </section>
          ) : null}

          {isSeller ? (
            <section className="card p-5 sm:p-7">
              <div className="flex items-center gap-2"><MessageSquareText className="size-5 text-blue-600" /><h2 className="text-lg font-black">收到的购买申请</h2></div>
              {interests.length ? (
                <div className="mt-4 space-y-3">
                  {interests.map((interest) => (
                    <article key={interest.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-black">{profiles[interest.buyer_id]?.display_name || "同校用户"}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDateTime(interest.created_at)} · {interest.status === "REQUESTED" ? "等待处理" : interest.status === "ACCEPTED" ? "已接受" : "已拒绝"}</div>
                        </div>
                        {interest.status === "REQUESTED" && listing.status === "ACTIVE" ? (
                          <div className="flex gap-2">
                            <ActionForm action={respondInterestAction}><input type="hidden" name="interestId" value={interest.id} /><input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="accept" value="true" /><SubmitButton>接受</SubmitButton></ActionForm>
                            <ActionForm action={respondInterestAction}><input type="hidden" name="interestId" value={interest.id} /><input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="accept" value="false" /><SubmitButton variant="outline">拒绝</SubmitButton></ActionForm>
                          </div>
                        ) : null}
                      </div>
                      {interest.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{interest.message}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <p className="mt-4 text-sm text-slate-400">还没有收到购买申请。</p>}
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><BadgeCheck className="size-4 text-blue-600" /> 卖家</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid size-11 place-items-center overflow-hidden rounded-full bg-blue-50 text-sm font-black text-blue-700">
                {seller?.avatar_url ? <img src={seller.avatar_url} alt="" className="size-full object-cover" /> : seller?.display_name?.slice(0,1) || <UserRound className="size-5" />}
              </div>
              <div><div className="font-black text-slate-800">{seller?.display_name || "同校用户"}</div><div className="text-xs text-slate-400">评分 {Number(seller?.rating || 5).toFixed(1)} · {seller?.review_count || 0} 条评价</div></div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="size-4 text-emerald-600" /> 交易操作</div>
            {!profile ? (
              <div className="mt-4"><ButtonLink href="/login" className="w-full">登录后操作</ButtonLink></div>
            ) : isSeller ? (
              <div className="mt-4 grid gap-3">
                {listing.status === "ACTIVE" || listing.status === "RESERVED" ? (
                  <ActionForm action={markListingSoldAction} confirmMessage="确认商品已经售出吗？"><input type="hidden" name="listingId" value={listing.id} /><SubmitButton className="w-full">标记已售出</SubmitButton></ActionForm>
                ) : null}
                {listing.status !== "SOLD" && listing.status !== "REMOVED" ? (
                  <ActionForm action={removeListingAction} confirmMessage="确定下架这个商品吗？"><input type="hidden" name="listingId" value={listing.id} /><SubmitButton className="w-full" variant="outline">下架商品</SubmitButton></ActionForm>
                ) : null}
              </div>
            ) : isAdmin ? (
              <div className="mt-4 grid gap-3">
                {listing.status !== "SOLD" && listing.status !== "REMOVED" ? (
                  <ActionForm action={removeListingAction} confirmMessage="确定以管理员身份下架该商品吗？">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <SubmitButton className="w-full" variant="danger">管理员下架商品</SubmitButton>
                  </ActionForm>
                ) : <p className="text-sm text-slate-500">该商品已结束。</p>}
              </div>
            ) : listing.status === "ACTIVE" ? (
              profile.verification_status === "verified" ? (
                myInterest ? (
                  <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
                    <div className="font-black">你已发送购买申请</div>
                    <p className="mt-1 text-xs">{myInterest.status === "REQUESTED" ? "等待卖家确认。" : myInterest.status === "ACCEPTED" ? "卖家已接受，请查看联系方式。" : "该申请已被拒绝，可以重新发送。"}</p>
                    {myInterest.status === "DECLINED" ? (
                      <ActionForm action={expressInterestAction} className="mt-3 grid gap-3"><input type="hidden" name="listingId" value={listing.id} /><textarea className="field min-h-20" name="message" maxLength={500} placeholder="重新给卖家留言" /><SubmitButton className="w-full">重新申请</SubmitButton></ActionForm>
                    ) : null}
                  </div>
                ) : (
                  <ActionForm action={expressInterestAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <textarea className="field min-h-24" name="message" maxLength={500} placeholder="告诉卖家你想购买，以及方便的交易时间（选填）" />
                    <SubmitButton className="w-full" pendingText="正在发送..."><Coins className="size-4" /> 我想要</SubmitButton>
                  </ActionForm>
                )
              ) : (
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-xs leading-6 text-amber-800">完成 12 位学号和手机号认证后才能发送购买申请。<ButtonLink href="/profile" variant="outline" className="mt-3 w-full">前往认证</ButtonLink></div>
              )
            ) : (
              <p className="mt-4 text-sm text-slate-500">该商品当前不可购买。</p>
            )}
          </section>

          {profile && !isSeller && !isAdmin ? (
            <details className="card p-5">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-rose-600"><AlertTriangle className="size-4" /> 举报卖家或商品</summary>
              <ActionForm action={reportAction} className="mt-4 grid gap-3">
                <input type="hidden" name="reportedUserId" value={listing.seller_id} />
                <select className="field" name="reason" defaultValue="fake_order"><option value="fake_order">虚假商品</option><option value="fraud">欺诈</option><option value="rude_behavior">不文明行为</option><option value="other">其他</option></select>
                <textarea className="field min-h-20" name="details" minLength={5} maxLength={1000} placeholder="请描述具体情况" required />
                <SubmitButton variant="danger">提交举报</SubmitButton>
              </ActionForm>
            </details>
          ) : null}

          <div className="rounded-2xl bg-slate-900 p-4 text-xs leading-6 text-white/60"><strong className="block text-white">安全提醒</strong>平台不提供在线支付。卖家接受购买申请后才会展示必要联系方式，请避免提前转账。</div>
        </aside>
      </div>
    </div>
  );
}
