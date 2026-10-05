import "server-only";

import { maybeOne, query, transaction } from "@/lib/db";
import { storageService } from "./storage";
import type { ListingTradeMode, MarketplaceInterest, MarketplaceListing, Profile } from "@/lib/types";

export async function createMarketplaceListing(profile: Profile, input: {
  title: string;
  description: string;
  price: number;
  tradeMode: ListingTradeMode;
  category: string;
  itemCondition: string;
  image?: {
    data: ArrayBuffer;
    contentType: string;
    extension: string;
  } | null;
}) {
  if (!profile.campus_id) throw new Error("请先完善学校信息");
  if (profile.status !== "active") throw new Error("账号状态不可发布商品");

  let imageUrl: string | null = null;
  if (input.image) {
    const storagePath = `${profile.id}/listing-${Date.now()}.${input.image.extension}`;
    imageUrl = (await storageService.uploadFile({
      bucket: "marketplace",
      path: storagePath,
      data: input.image.data,
      contentType: input.image.contentType
    })).publicUrl;
  }

  const listing = await maybeOne<{ id: string }>(
    `insert into marketplace_listings (seller_id, campus_id, title, description, price, trade_mode, category, item_condition, image_url)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
    [profile.id, profile.campus_id, input.title, input.description, input.price, input.tradeMode, input.category, input.itemCondition, imageUrl]
  );
  if (!listing?.id) throw new Error("商品发布失败，请稍后重试");
  return listing.id;
}

export async function expressMarketplaceInterest(userId: string, input: { listingId: string; message: string }) {
  await transaction(async (client) => {
    const listing = (await client.query<MarketplaceListing>("select * from marketplace_listings where id = $1 for update", [input.listingId])).rows[0];
    if (!listing || listing.status !== "ACTIVE") throw new Error("商品当前不可购买");
    if (listing.seller_id === userId) throw new Error("不能购买自己发布的商品");
    await client.query("insert into marketplace_interests (listing_id, buyer_id, message) values ($1, $2, $3)", [
      input.listingId,
      userId,
      input.message || null
    ]);
  });
}

export async function respondMarketplaceInterest(userId: string, input: { interestId: string; accept: boolean }) {
  await transaction(async (client) => {
    const interest = (await client.query<MarketplaceInterest>("select * from marketplace_interests where id = $1 for update", [input.interestId])).rows[0];
    if (!interest) throw new Error("购买申请不存在");
    const listing = (await client.query<MarketplaceListing>("select * from marketplace_listings where id = $1 for update", [interest.listing_id])).rows[0];
    if (!listing || listing.seller_id !== userId) throw new Error("无权处理该申请");
    await client.query("update marketplace_interests set status = $1 where id = $2", [input.accept ? "ACCEPTED" : "DECLINED", input.interestId]);
    if (input.accept) {
      await client.query("update marketplace_listings set buyer_id = $1, status = 'RESERVED' where id = $2", [interest.buyer_id, listing.id]);
      await client.query("update marketplace_interests set status = 'DECLINED' where listing_id = $1 and id <> $2 and status = 'REQUESTED'", [listing.id, input.interestId]);
    }
  });
}

export async function markMarketplaceListingSold(userId: string, listingId: string) {
  const result = await query("update marketplace_listings set status = 'SOLD', sold_at = now() where id = $1 and seller_id = $2", [listingId, userId]);
  if (result.rowCount === 0) throw new Error("无权操作该商品");
}

export async function removeMarketplaceListing(userId: string, listingId: string) {
  const result = await query("update marketplace_listings set status = 'REMOVED', removed_at = now() where id = $1 and seller_id = $2", [listingId, userId]);
  if (result.rowCount === 0) throw new Error("无权操作该商品");
}
