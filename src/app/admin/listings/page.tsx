import { ShoppingBag } from "lucide-react";
import { removeListingAction } from "@/actions/marketplace";
import { getAdminMarketplaceListings } from "@/lib/marketplace";
import { getPublicProfiles } from "@/lib/data";
import { LISTING_CATEGORY_LABELS, LISTING_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { AdminNav } from "@/components/AdminNav";
import { ListingStatusBadge } from "@/components/ListingStatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const listings = await getAdminMarketplaceListings(params.status);
  const sellers = await getPublicProfiles(listings.map((listing) => listing.seller_id));

  return (
    <>
      <AdminNav active="/admin/listings" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">Marketplace</div><h1 className="page-title mt-3">闲置管理</h1><p className="mt-3 text-sm text-slate-500">查看全站闲置并处理违规商品。</p></div>
        <form className="flex gap-2"><select className="field min-w-32" name="status" defaultValue={params.status || "ALL"}><option value="ALL">全部状态</option>{Object.entries(LISTING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">筛选</button></form>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => (
          <article key={listing.id} className="card overflow-hidden">
            <div className="grid aspect-[4/3] place-items-center bg-slate-100">
              {listing.image_url ? <img src={listing.image_url} alt="" className="size-full object-cover" /> : <ShoppingBag className="size-12 text-slate-300" />}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2"><ListingStatusBadge status={listing.status} /><span className="text-xs text-slate-400">{LISTING_CATEGORY_LABELS[listing.category]}</span></div>
              <h2 className="mt-3 line-clamp-2 font-black">{listing.title}</h2>
              <p className="mt-1 text-sm font-bold text-blue-700">{listing.price === 0 ? "免费" : formatMoney(listing.price)}</p>
              <p className="mt-2 text-xs text-slate-400">卖家：{sellers[listing.seller_id]?.display_name || "未知"} · {formatDateTime(listing.created_at)}</p>
              {listing.status !== "SOLD" && listing.status !== "REMOVED" ? <ActionForm action={removeListingAction} className="mt-4" confirmMessage="确定以管理员身份下架该商品吗？"><input type="hidden" name="listingId" value={listing.id} /><SubmitButton className="w-full" variant="danger">下架商品</SubmitButton></ActionForm> : null}
            </div>
          </article>
        ))}
        {!listings.length ? <div className="sm:col-span-2 xl:col-span-3"><EmptyState icon={ShoppingBag} title="暂无闲置商品" description="用户发布的商品会显示在这里。" /></div> : null}
      </section>
    </>
  );
}
