import Link from "next/link";
import { MapPin, ShoppingBag } from "lucide-react";
import { LISTING_CATEGORY_LABELS, LISTING_CONDITION_LABELS } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";
import { formatMoney, formatRelativeTime } from "@/lib/utils";
import { ListingStatusBadge } from "./ListingStatusBadge";

export function ListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5">
      <Link href={`/marketplace/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} className="size-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid size-full place-items-center text-blue-200"><ShoppingBag className="size-16" /></div>
          )}
          <ListingStatusBadge status={listing.status} className="absolute left-3 top-3 bg-white/90 backdrop-blur" />
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/marketplace/${listing.id}`} className="line-clamp-2 text-base font-black leading-6 text-slate-900 hover:text-blue-700">{listing.title}</Link>
          <strong className="shrink-0 text-xl font-black text-blue-700">{listing.price === 0 ? "免费" : formatMoney(listing.price)}</strong>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1">{LISTING_CATEGORY_LABELS[listing.category]}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1">{LISTING_CONDITION_LABELS[listing.item_condition]}</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1"><MapPin className="size-3.5" /> 莆田学院</span>
          <span>{formatRelativeTime(listing.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
