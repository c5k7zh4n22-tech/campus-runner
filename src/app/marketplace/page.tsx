import type { Metadata } from "next";
import { Plus, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { getPublicProfiles } from "@/lib/data";
import { getMarketplaceListings, getMyListingInterests } from "@/lib/marketplace";
import { requireProfile } from "@/lib/auth";
import { LISTING_CATEGORY_LABELS } from "@/lib/constants";
import type { ListingCategory } from "@/lib/types";
import { ListingCard } from "@/components/ListingCard";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "闲置市场" };

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ category?: string; sort?: string }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const category = (params.category || "ALL") as ListingCategory | "ALL";
  const sort = (params.sort || "newest") as "newest" | "price_asc" | "price_desc";
  const [listings, myInterests] = await Promise.all([
    getMarketplaceListings({ category, sort, status: "ACTIVE" }),
    getMyListingInterests(profile.id)
  ]);
  const sellers = await getPublicProfiles(listings.map((listing) => listing.seller_id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Campus market</div>
          <h1 className="page-title mt-3">校园闲置</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">买闲置、卖闲置，同校认证用户线下交易。平台不参与收款。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/marketplace/my-listings" variant="outline"><ShoppingBag className="size-4" /> 我的闲置</ButtonLink>
          <ButtonLink href="/marketplace/create"><Plus className="size-4" /> 发布闲置</ButtonLink>
        </div>
      </div>

      {myInterests.length ? (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          你有 <strong>{myInterests.length}</strong> 条购买申请。卖家接受后，可在商品详情中查看联系方式。
        </div>
      ) : null}

      <form className="card mt-7 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <label className="label">
          <span className="flex items-center gap-2"><ShoppingBag className="size-4" /> 分类</span>
          <select className="field" name="category" defaultValue={category}>
            <option value="ALL">全部分类</option>
            {Object.entries(LISTING_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="label">
          <span className="flex items-center gap-2"><SlidersHorizontal className="size-4" /> 排序</span>
          <select className="field" name="sort" defaultValue={sort}>
            <option value="newest">最新发布</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
          </select>
        </label>
        <button className="min-h-11 self-end rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800">应用筛选</button>
      </form>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.length ? listings.map((listing) => (
          <div key={listing.id}>
            <ListingCard listing={listing} />
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-400">
              <span>卖家：{sellers[listing.seller_id]?.display_name || "同校用户"}</span>
              {myInterests.some((interest) => interest.listing_id === listing.id) ? <span className="font-bold text-blue-600">已申请</span> : null}
            </div>
          </div>
        )) : (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
            <EmptyState icon={ShoppingBag} title="暂时没有符合条件的闲置" description="可以调整分类，或者发布自己的第一件闲置。" action={<ButtonLink href="/marketplace/create">发布闲置</ButtonLink>} />
          </div>
        )}
      </section>

      {profile.verification_status !== "verified" ? (
        <p className="mt-6 text-center text-xs text-amber-700">发布商品和发送购买申请前，需要完成 12 位学号 + 手机号认证。</p>
      ) : null}
    </div>
  );
}
