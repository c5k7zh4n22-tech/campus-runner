"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { submitVerification, updateProfile, uploadAvatar } from "@/lib/services/profile";
import { profileSchema, verificationSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function updateProfileAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({ displayName: formData.get("displayName"), campusId: formData.get("campusId") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "资料格式不正确" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "登录已过期，请重新登录" };
  try {
    await updateProfile(user.id, parsed.data);
    revalidatePath("/profile");
    revalidatePath("/");
    return { success: "个人资料已更新。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function submitVerificationAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = verificationSchema.safeParse({ studentId: formData.get("studentId"), phone: formData.get("phone") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "认证资料格式不正确" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "登录已过期，请重新登录" };
  try {
    await submitVerification(user.id, parsed.data);
    revalidatePath("/profile");
    return { success: "认证资料已提交，管理员审核后即可接单。" };
  } catch (error) {
    return { error: dbErrorMessage(error) };
  }
}

export async function uploadAvatarAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "请选择头像文件" };
  if (file.size > 2 * 1024 * 1024) return { error: "头像不能超过 2MB" };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { error: "头像仅支持 JPG、PNG 或 WebP" };
  const user = await authService.getCurrentUser();
  if (!user) return { error: "登录已过期，请重新登录" };
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  try {
    await uploadAvatar({ userId: user.id, data: await file.arrayBuffer(), contentType: file.type, extension });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "头像上传失败" };
  }
  revalidatePath("/profile");
  revalidatePath("/");
  return { success: "头像已更新。" };
}
