"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { getProfileByUserId } from "@/lib/services/profile";
import { createMarketplaceListing, expressMarketplaceInterest, markMarketplaceListingSold, removeMarketplaceListing, respondMarketplaceInterest } from "@/lib/services/marketplace";
import { listingInterestSchema, listingSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

async function currentProfile() {
  const user = await authService.getCurrentUser();
  if (!user) return null;
  return getProfileByUserId(user.id);
}

export async function createListingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = listingSchema.safeParse({ title: formData.get("title"), description: formData.get("description"), price: formData.get("price"), tradeMode: formData.get("tradeMode"), category: formData.get("category"), itemCondition: formData.get("itemCondition") });
  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const profile = await currentProfile();
  if (!profile) return { error: "请先登录" };

  let imageInput: { data: ArrayBuffer; contentType: string; extension: string } | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) return { error: "商品图片不能超过 5MB" };
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) return { error: "商品图片仅支持 JPG、PNG 或 WebP" };
    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    imageInput = { data: await image.arrayBuffer(), contentType: image.type, extension };
  }

  let listingId: string;
  try {
    listingId = await createMarketplaceListing(profile, { ...parsed.data, image: imageInput });
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
    await expressMarketplaceInterest(user.id, parsed.data);
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
    await respondMarketplaceInterest(user.id, { interestId, accept });
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
  try {
    await markMarketplaceListingSold(user.id, listingId);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
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
  try {
    await removeMarketplaceListing(user.id, listingId);
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  return { success: "商品已下架。" };
}
