"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { siteUrl } from "@/lib/supabase/config";

function firstIssue(result: { success: false; error: { issues: Array<{ message: string }> } }) {
  return result.error.issues[0]?.message ?? "提交内容不正确";
}

export async function signUpAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) return { error: firstIssue(parsed) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置，请联系管理员。" };

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${siteUrl}/auth/callback`
    }
  });

  if (error) return { error: error.message };
  if (!data.session) return { success: "注册成功，请打开邮箱完成验证后登录。" };
  redirect("/profile");
}

export async function signInAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) return { error: firstIssue(parsed) };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase 尚未配置，请联系管理员。" };

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message === "Invalid login credentials" ? "邮箱或密码错误" : error.message };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
