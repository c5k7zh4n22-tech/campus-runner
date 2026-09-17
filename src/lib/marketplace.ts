import "server-only";

import { createClient } from "./supabase/server";
import type { MarketplaceInterest, MarketplaceListing, ListingCategory } from "./types";

export async function getMarketplaceListings(filters?: {
  category?: ListingCategory | "ALL";
  sort?: "newest" | "price_asc" | "price_desc";
  status?: "ACTIVE" | "ALL";
  limit?: number;
}): Promise<MarketplaceListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase.from("marketplace_listings").select("*");
  if (filters?.category && filters.category !== "ALL") query = query.eq("category", filters.category);
  if (filters?.status && filters.status !== "ALL") query = query.eq("status", filters.status);

  if (filters?.sort === "price_asc") {
    query = query.order("price", { ascending: true });
  } else if (filters?.sort === "price_desc") {
    query = query.order("price", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data } = await query.limit(filters?.limit ?? 60);
  return (data as MarketplaceListing[] | null) ?? [];
}

export async function getMarketplaceListing(id: string): Promise<MarketplaceListing | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("marketplace_listings").select("*").eq("id", id).maybeSingle();
  return (data as MarketplaceListing | null) ?? null;
}

export async function getMyMarketplaceListings(userId: string): Promise<MarketplaceListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });
  return (data as MarketplaceListing[] | null) ?? [];
}

export async function getListingInterests(listingId: string): Promise<MarketplaceInterest[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("marketplace_interests")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });
  return (data as MarketplaceInterest[] | null) ?? [];
}

export async function getMyListingInterests(buyerId: string): Promise<MarketplaceInterest[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("marketplace_interests")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  return (data as MarketplaceInterest[] | null) ?? [];
}

export async function getMarketplaceContact(listingId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("get_marketplace_contact", { p_listing_id: listingId });
  return (data as Array<{ profile_id: string; display_name: string; phone: string | null; email: string | null }> | null)?.[0] ?? null;
}

export async function getListingsByIds(ids: string[]): Promise<Record<string, MarketplaceListing>> {
  const supabase = await createClient();
  const cleanIds = [...new Set(ids.filter(Boolean))];
  if (!supabase || cleanIds.length === 0) return {};
  const { data } = await supabase.from("marketplace_listings").select("*").in("id", cleanIds);
  return ((data as MarketplaceListing[] | null) ?? []).reduce<Record<string, MarketplaceListing>>((acc, listing) => {
    acc[listing.id] = listing;
    return acc;
  }, {});
}

export async function getAdminMarketplaceListings(status?: string): Promise<MarketplaceListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("marketplace_listings").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "ALL") query = query.eq("status", status);
  const { data } = await query;
  return (data as MarketplaceListing[] | null) ?? [];
}
