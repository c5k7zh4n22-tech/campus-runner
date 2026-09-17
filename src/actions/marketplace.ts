"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listingInterestSchema, listingSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

function issueMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export async function createListingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = listingSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    category: formData.get("category"),
    itemCondition: formData.get("itemCondition")
  });
  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "请先登录" };

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 5 * 1024 * 1024) return { error: "商品图片不能超过 5MB" };
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      return { error: "商品图片仅支持 JPG、PNG 或 WebP" };
    }
    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `${authData.user.id}/listing-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("marketplace").upload(storagePath, await image.arrayBuffer(), {
      contentType: image.type,
      upsert: false
    });
    if (uploadError) return { error: uploadError.message };
    imageUrl = supabase.storage.from("marketplace").getPublicUrl(storagePath).data.publicUrl;
  }

  const { data, error } = await supabase.rpc("create_marketplace_listing", {
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_price: parsed.data.price,
    p_category: parsed.data.category,
    p_item_condition: parsed.data.itemCondition,
    p_image_url: imageUrl
  });
  if (error) return { error: error.message };
  const listing = data as { id: string } | null;
  if (!listing?.id) return { error: "商品发布失败，请稍后重试" };

  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  redirect(`/marketplace/${listing.id}?created=1`);
}

export async function expressInterestAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = listingInterestSchema.safeParse({
    listingId: formData.get("listingId"),
    message: formData.get("message")
  });
  if (!parsed.success) return { error: issueMessage(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("create_marketplace_interest", {
    p_listing_id: parsed.data.listingId,
    p_message: parsed.data.message
  });
  if (error) return { error: error.message };

  revalidatePath(`/marketplace/${parsed.data.listingId}`);
  revalidatePath("/marketplace");
  return { success: "购买意向已发送，等待卖家确认。" };
}

export async function respondInterestAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const interestId = String(formData.get("interestId") ?? "");
  const listingId = String(formData.get("listingId") ?? "");
  const accept = String(formData.get("accept") ?? "") === "true";
  if (!interestId || !listingId) return { error: "购买申请不存在" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("respond_marketplace_interest", {
    p_interest_id: interestId,
    p_accept: accept
  });
  if (error) return { error: error.message };

  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace/my-listings");
  return { success: accept ? "已接受购买申请，商品已预订。" : "已拒绝该购买申请。" };
}

export async function markListingSoldAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "商品不存在" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("mark_marketplace_listing_sold", { p_listing_id: listingId });
  if (error) return { error: error.message };

  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  return { success: "商品已标记为售出。" };
}

export async function removeListingAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const listingId = String(formData.get("listingId") ?? "");
  if (!listingId) return { error: "商品不存在" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { error } = await supabase.rpc("remove_marketplace_listing", { p_listing_id: listingId });
  if (error) return { error: error.message };

  revalidatePath(`/marketplace/${listingId}`);
  revalidatePath("/marketplace");
  revalidatePath("/marketplace/my-listings");
  return { success: "商品已下架。" };
}
