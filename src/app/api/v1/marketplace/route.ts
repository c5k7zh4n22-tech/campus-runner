import { z } from "zod";
import { apiError, apiException, apiOk, readJson, requireApiProfile, validationMessage } from "@/lib/api";
import { getPublicProfiles } from "@/lib/data";
import { getMarketplaceListings, getMyListingInterests } from "@/lib/marketplace";
import { createMarketplaceListing } from "@/lib/services/marketplace";
import { listingSchema } from "@/lib/validation";
import type { ListingCategory } from "@/lib/types";

export const runtime = "nodejs";

const categorySchema = z.enum(["ALL", "books", "electronics", "daily", "clothing", "sports", "tickets", "other"]);
const sortSchema = z.enum(["newest", "price_asc", "price_desc"]);

export async function GET(request: Request) {
  try {
    const profile = await requireApiProfile(request);
    const url = new URL(request.url);
    const category = categorySchema.catch("ALL").parse(url.searchParams.get("category") || "ALL") as ListingCategory | "ALL";
    const sort = sortSchema.catch("newest").parse(url.searchParams.get("sort") || "newest");
    const limit = Math.min(Number(url.searchParams.get("limit") || 60), 100);
    const [listings, myInterests] = await Promise.all([
      getMarketplaceListings({ category, sort, status: "ACTIVE", limit }),
      getMyListingInterests(profile.id)
    ]);
    const sellers = await getPublicProfiles(listings.map((listing) => listing.seller_id));
    return apiOk({ listings, sellers, myInterests });
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireApiProfile(request);
    const body = await readJson(request);
    const parsed = listingSchema.safeParse({
      title: body?.title,
      description: body?.description,
      price: body?.price,
      tradeMode: body?.tradeMode ?? undefined,
      category: body?.category,
      itemCondition: body?.itemCondition
    });
    if (!parsed.success) return apiError("bad_request", validationMessage(parsed.error));

    const listingId = await createMarketplaceListing(profile, parsed.data);
    return apiOk({ listingId }, { status: 201 });
  } catch (error) {
    return apiException(error);
  }
}
