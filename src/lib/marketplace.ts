import "server-only";

import { getCurrentUser } from "./data";
import { maybeOne, query } from "./db";
import type { ListingCategory, MarketplaceInterest, MarketplaceListing } from "./types";

export async function getMarketplaceListings(filters?: {
  category?: ListingCategory | "ALL";
  sort?: "newest" | "price_asc" | "price_desc";
  status?: "ACTIVE" | "ALL";
  limit?: number;
}): Promise<MarketplaceListing[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters?.category && filters.category !== "ALL") {
    values.push(filters.category);
    where.push(`category = $${values.length}`);
  }
  if (filters?.status && filters.status !== "ALL") {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }
  const orderBy = filters?.sort === "price_asc" ? "price asc" : filters?.sort === "price_desc" ? "price desc" : "created_at desc";
  values.push(filters?.limit ?? 60);
  const result = await query<MarketplaceListing>(
    `select * from marketplace_listings ${where.length ? `where ${where.join(" and ")}` : ""} order by ${orderBy} limit $${values.length}`,
    values
  );
  return result.rows;
}

export async function getMarketplaceListing(id: string): Promise<MarketplaceListing | null> {
  return maybeOne<MarketplaceListing>("select * from marketplace_listings where id = $1", [id]);
}

export async function getMyMarketplaceListings(userId: string): Promise<MarketplaceListing[]> {
  const result = await query<MarketplaceListing>("select * from marketplace_listings where seller_id = $1 order by created_at desc", [userId]);
  return result.rows;
}

export async function getListingInterests(listingId: string): Promise<MarketplaceInterest[]> {
  const result = await query<MarketplaceInterest>("select * from marketplace_interests where listing_id = $1 order by created_at desc", [listingId]);
  return result.rows;
}

export async function getMyListingInterests(buyerId: string): Promise<MarketplaceInterest[]> {
  const result = await query<MarketplaceInterest>("select * from marketplace_interests where buyer_id = $1 order by created_at desc", [buyerId]);
  return result.rows;
}

export async function getMarketplaceContact(listingId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return maybeOne<{ profile_id: string; display_name: string; phone: string | null; email: string | null }>(
    `select p.id as profile_id, p.display_name, p.phone, u.email
     from marketplace_listings l
     join profiles p on p.id = case when l.seller_id = $2 then l.buyer_id else l.seller_id end
     join app_users u on u.id = p.id
     where l.id = $1 and (l.seller_id = $2 or l.buyer_id = $2) and l.buyer_id is not null`,
    [listingId, user.id]
  );
}

export async function getListingsByIds(ids: string[]): Promise<Record<string, MarketplaceListing>> {
  const cleanIds = [...new Set(ids.filter(Boolean))];
  if (cleanIds.length === 0) return {};
  const result = await query<MarketplaceListing>("select * from marketplace_listings where id = any($1::uuid[])", [cleanIds]);
  return result.rows.reduce<Record<string, MarketplaceListing>>((acc, listing) => {
    acc[listing.id] = listing;
    return acc;
  }, {});
}

export async function getAdminMarketplaceListings(status?: string): Promise<MarketplaceListing[]> {
  const result = status && status !== "ALL"
    ? await query<MarketplaceListing>("select * from marketplace_listings where status = $1 order by created_at desc limit 200", [status])
    : await query<MarketplaceListing>("select * from marketplace_listings order by created_at desc limit 200");
  return result.rows;
}
