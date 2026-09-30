"use server";

import { redirect } from "next/navigation";
import { authService } from "@/lib/services/auth";
import { loginSchema, registerSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { siteUrl } from "@/lib/config";

function firstIssue(result: { success: false; error: { issues: Array<{ message: string }> } }) {
  return result.error.issues[0]?.message ?? "提交内容不正确";
}

export async function signUpAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode"),
    inviteConfirmedCode: formData.get("inviteConfirmedCode")
  });

  if (!parsed.success) return { error: firstIssue(parsed) };

  const inviteCode = parsed.data.inviteCode?.trim().toUpperCase() || "";
  const inviteConfirmedCode = parsed.data.inviteConfirmedCode?.trim().toUpperCase() || "";
  if (inviteCode && inviteCode !== inviteConfirmedCode) {
    return { error: "请先校验并确认邀请码，或清除后继续注册。" };
  }

  const result = await authService.signUpWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    displayName: parsed.data.displayName,
    redirectTo: `${siteUrl}/auth/callback`,
    inviteCode: inviteCode || undefined
  });

  if (result.error) return { error: result.error };
  if (!result.sessionCreated) return { success: "注册成功，请打开邮箱完成验证后登录。" };
  redirect("/profile");
}

export async function signInAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) return { error: firstIssue(parsed) };

  const result = await authService.signInWithPassword(parsed.data.email, parsed.data.password);
  if (result.error) return { error: result.error === "Invalid login credentials" ? "邮箱或密码错误" : result.error };
  redirect("/");
}

export async function signOutAction() {
  await authService.signOut();
  redirect("/");
}
