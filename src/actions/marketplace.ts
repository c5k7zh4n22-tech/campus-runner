"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, maybeOne, query, transaction } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { storageService } from "@/lib/services/storage";
import { listingInterestSchema, listingSchema } from "@/lib/validation";
import type { ActionResult, MarketplaceInterest, MarketplaceListing, Profile } from "@/lib/types";

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

async function currentProfile() {
  const user = await authService.getCurrentUser();
  if (!user) return null;
  return maybeOne<Profile>("select * from profiles where id = $1", [user.id]);
}

export async function createListingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = listingSchema.safeParse({ title: formData.get("title"), description: formData.get("description"), price: formData.get("price"), category: formData.get("category"), itemCondition: formData.get("itemCondition") });
  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const profile = await currentProfile();
  if (!profile) return { error: "请先登录" };
  if (!profile.campus_id) return { error: "请先完善学校信息" };
  if (profile.status !== "active") return { error: "账号状态不可发布商品" };

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) return { error: "商品图片不能超过 5MB" };
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return { error: "商品图片仅支持 JPG、PNG 或 WebP" };
    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${profile.id}/listing-${Date.now()}.${extension}`;
    try {
      imageUrl = (await storageService.uploadFile({ bucket: "marketplace", path: storagePath, data: await image.arrayBuffer(), contentType: image.type })).publicUrl;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "商品图片上传失败" };
    }
  }

  let listingId: string;
  try {
    const listing = await maybeOne<{ id: string }>(
      `insert into marketplace_listings (seller_id, campus_id, title, description, price, category, item_condition, image_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [profile.id, profile.campus_id, parsed.data.title, parsed.data.description, parsed.data.price, parsed.data.category, parsed.data.itemCondition, imageUrl]
    );
    if (!listing?.id) return { error: "商品发布失败，请稍后重试" };
    listingId = listing.id;
    revalidatePath("/marketplace");
    revalidatePath("/marketplace/my-listings");
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  redirect(`/marketplace/${listingId}?created=1`);
}

export async function expressInterestAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = listingInterestSchema.safeParse({ listingId: formData.get("listingId"), message: formData.get("message") });
  if (!parsed.success) return { error: issueMessage(parsed.error) };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  try {
    await transaction(async (client) => {
      const listing = (await client.query<MarketplaceListing>("select * from marketplace_listings where id = $1 for update", [parsed.data.listingId])).rows[0];
      if (!listing || listing.status !== "ACTIVE") throw new Error("商品当前不可购买");
      if (listing.seller_id === user.id) throw new Error("不能购买自己发布的商品");
      await client.query("insert into marketplace_interests (listing_id, buyer_id, message) values ($1, $2, $3)", [parsed.data.listingId, user.id, parsed.data.message || null]);
    });
    revalidatePath(`/marketplace/${parsed.data.listingId}`);
    revalidatePath("/marketplace");
    return { success: "购买意向已发送，等待卖家确认。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function respondInterestAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const interestId = String(formData.get("interestId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";
  if (!interestId || !listingId) return { error: "购买申请不存在" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  try {
    await transaction(async (client) => {
      const interest = (await client.query<MarketplaceInterest>("select * from marketplace_interests where id = $1 for update", [interestId])).rows[0];
      if (!interest) throw new Error("购买申请不存在");
      const listing = (await client.query<MarketplaceListing>("select * from marketplace_listings where id = $1 for update", [interest.listing_id])).rows[0];
      if (!listing || listing.seller_id !== user.id) throw new Error("无权处理该申请");
      await client.query("update marketplace_interests set status = $1 where id = $2", [accept ? "ACCEPTED" : "DECLINED", interestId]);
      if (accept) {
        await client.query("update marketplace_listings set buyer_id = $1, status = 'RESERVED' where id = $2", [interest.buyer_id, listing.id]);
        await client.query("update marketplace_interests set status = 'DECLINED' where listing_id = $1 and id <> $2 and status = 'REQUESTED'", [listing.id, interestId]);
      }
    });
    revalidatePath(`/marketplace/${listingId}`);
    revalidatePath("/marketplace/my-listings");
    return { success: accept ? "已接受购买申请，商品已预订。" : "已拒绝该购买申请。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function markListingSoldAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "商品不存在" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  const result = await query("update marketplace_listings set status = 'SOLD', sold_at = now() where id = $1 and seller_id = $2", [listingId, user.id]);
  if (result.rowCount === 0) return { error: "无权操作该商品" };
  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  return { success: "商品已标记为售出。" };
}

export async function removeListingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "商品不存在" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "请先登录" };
  const result = await query("update marketplace_listings set status = 'REMOVED', removed_at = now() where id = $1 and seller_id = $2", [listingId, user.id]);
  if (result.rowCount === 0) return { error: "无权操作该商品" };
  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  return { success: "商品已下架。" };
}
