"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, verificationSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function updateProfileAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    campusId: formData.get("campusId")
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "资料格式不正确" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "登录已过期，请重新登录" };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      campus_id: parsed.data.campusId
    })
    .eq("id", authData.user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "个人资料已更新。" };
}

export async function submitVerificationAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = verificationSchema.safeParse({
    studentId: formData.get("studentId"),
    phone: formData.get("phone")
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "认证资料格式不正确" };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };

  const { error } = await supabase.rpc("submit_verification", {
    p_student_id: parsed.data.studentId,
    p_phone: parsed.data.phone
  });

  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { success: "认证资料已提交，管理员审核后即可接单。" };
}

export async function uploadAvatarAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "请选择头像文件" };
  if (file.size > 2 * 1024 * 1024) return { error: "头像不能超过 2MB" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { error: "头像仅支持 JPG、PNG 或 WebP" };
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置" };
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { error: "登录已过期，请重新登录" };

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${authData.user.id}/avatar-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true
    });

  if (uploadError) return { error: uploadError.message };

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(storagePath);
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrlData.publicUrl })
    .eq("id", authData.user.id);

  if (updateError) return { error: updateError.message };
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "头像已更新。" };
}
