import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Plus, ShoppingBag } from "lucide-react";
import { respondInterestAction } from "@/actions/marketplace";
import { getMyMarketplaceListings, getListingInterests } from "@/lib/marketplace";
import { getPublicProfiles } from "@/lib/data";
import { requireProfile } from "@/lib/auth";
import { LISTING_CATEGORY_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "我的闲置" };

export default async function MyListingsPage() {
  const profile = await requireProfile();
  const listings = await getMyMarketplaceListings(profile.id);
  const interestGroups = await Promise.all(listings.map(async (listing) => ({ listing, interests: await getListingInterests(listing.id) })));
  const buyerProfiles = await getPublicProfiles(interestGroups.flatMap((group) => group.interests.map((interest) => interest.buyer_id)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700" href="/marketplace"><ArrowLeft className="size-4" /> 返回闲置市场</Link>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">My listings</div><h1 className="page-title mt-3">我的闲置</h1><p className="mt-3 text-sm text-slate-500">管理已发布商品和收到的购买申请。</p></div>
        <ButtonLink href="/marketplace/create"><Plus className="size-4" /> 发布新闲置</ButtonLink>
      </div>

      {!listings.length ? (
        <div className="mt-7"><EmptyState icon={ShoppingBag} title="还没有发布闲置" description="把宿舍里不再使用的好物分享给同校同学吧。" action={<ButtonLink href="/marketplace/create">发布闲置</ButtonLink>} /></div>
      ) : (
        <div className="mt-7 space-y-6">
          {interestGroups.map(({ listing, interests }) => (
            <section key={listing.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><ListingStatusBadge status={listing.status} /><span className="text-xs text-slate-400">{LISTING_CATEGORY_LABELS[listing.category]}</span></div>
                  <Link href={`/marketplace/${listing.id}`} className="mt-3 block text-xl font-black hover:text-blue-700">{listing.title}</Link>
                  <div className="mt-1 text-sm font-bold text-blue-700">{listing.price === 0 ? "免费" : formatMoney(listing.price)}</div>
                </div>
                <ButtonLink href={`/marketplace/${listing.id}`} variant="outline">查看商品</ButtonLink>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <h2 className="flex items-center gap-2 text-sm font-black"><PackageCheck className="size-4 text-blue-600" /> 购买申请 {interests.length ? `(${interests.length})` : ""}</h2>
                {interests.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{interests.map((interest) => <article key={interest.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-black">{buyerProfiles[interest.buyer_id]?.display_name || "同校用户"}</div><div className="mt-1 text-[11px] text-slate-400">{formatDateTime(interest.created_at)} · {interest.status === "REQUESTED" ? "等待处理" : interest.status === "ACCEPTED" ? "已接受" : "已拒绝"}</div></div>{interest.status === "REQUESTED" && listing.status === "ACTIVE" ? <div className="flex gap-2"><ActionForm action={respondInterestAction}><input type="hidden" name="interestId" value={interest.id} /><input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="accept" value="true" /><SubmitButton>接受</SubmitButton></ActionForm><ActionForm action={respondInterestAction}><input type="hidden" name="interestId" value={interest.id} /><input type="hidden" name="listingId" value={listing.id} /><input type="hidden" name="accept" value="false" /><SubmitButton variant="outline">拒绝</SubmitButton></ActionForm></div> : null}</div>{interest.message ? <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">{interest.message}</p> : null}</article>)}</div> : <p className="mt-3 text-xs text-slate-400">暂时没有购买申请。</p>}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
