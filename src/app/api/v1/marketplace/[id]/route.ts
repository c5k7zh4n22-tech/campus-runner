import { z } from "zod";
import { apiError, apiException, apiOk, requireApiProfile } from "@/lib/api";
import { getPublicProfiles } from "@/lib/data";
import { getMarketplaceListing } from "@/lib/marketplace";

export const runtime = "nodejs";

const idSchema = z.uuid();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireApiProfile(request);
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return apiError("bad_request", "商品 ID 不正确");

    const listing = await getMarketplaceListing(parsed.data);
    if (!listing) return apiError("not_found", "商品不存在");

    const profiles = await getPublicProfiles([listing.seller_id, listing.buyer_id]);
    return apiOk({ listing, profiles });
  } catch (error) {
    return apiException(error);
  }
}
