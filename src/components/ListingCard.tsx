import Link from "next/link";
import Image from "next/image";
import { MapPin, ShoppingBag } from "lucide-react";
import { LISTING_CATEGORY_LABELS, LISTING_CONDITION_LABELS, LISTING_TRADE_MODE_LABELS } from "@/lib/constants";
import type { MarketplaceListing } from "@/lib/types";
import { formatMoney, formatRelativeTime } from "@/lib/utils";
import { ListingStatusBadge } from "./ListingStatusBadge";

export function ListingCard({ listing }: { listing: MarketplaceListing }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition sm:rounded-3xl sm:hover:-translate-y-0.5 sm:hover:border-blue-200 sm:hover:shadow-lg sm:hover:shadow-blue-950/5">
      <Link href={`/marketplace/${listing.id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-slate-100 sm:aspect-[4/3]">
          {listing.image_url ? (
            <Image src={listing.image_url} alt={listing.title} fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid size-full place-items-center text-blue-200"><ShoppingBag className="size-10 sm:size-16" /></div>
          )}
          <ListingStatusBadge status={listing.status} className="absolute left-2 top-2 bg-white/90 backdrop-blur sm:left-3 sm:top-3" />
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <div className="grid gap-1 sm:flex sm:items-start sm:justify-between sm:gap-3">
          <Link href={`/marketplace/${listing.id}`} className="line-clamp-2 text-sm font-black leading-5 text-slate-900 hover:text-blue-700 sm:text-base sm:leading-6">{listing.title}</Link>
          <strong className="shrink-0 text-base font-black text-blue-700 sm:text-xl">{listing.price === 0 ? "免费" : formatMoney(listing.price)}</strong>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500 sm:mt-3 sm:gap-2 sm:text-[11px]">
          <span className="rounded-full bg-slate-100 px-2 py-1">{LISTING_CATEGORY_LABELS[listing.category]}</span>
          <span className="hidden rounded-full bg-slate-100 px-2 py-1 sm:inline">{LISTING_CONDITION_LABELS[listing.item_condition]}</span>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{LISTING_TRADE_MODE_LABELS[listing.trade_mode]}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400 sm:mt-4 sm:text-xs">
          <span className="flex items-center gap-1"><MapPin className="size-3.5" /> 莆田学院</span>
          <span>{formatRelativeTime(listing.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
