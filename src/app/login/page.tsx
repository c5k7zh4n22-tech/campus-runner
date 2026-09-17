import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Mail } from "lucide-react";
import { signInAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SetupNotice } from "@/components/SetupNotice";
import { WechatLoginButton } from "@/components/WechatLoginButton";
import { isWechatBrowser, isWechatLoginConfigured } from "@/lib/wechat/config";

export const metadata: Metadata = { title: "登录" };

const errorMessages: Record<string, string> = {
  wechat_not_configured: "微信授权暂未开放，请使用邮箱密码登录。",
  wechat_only_in_wechat: "微信一键授权仅支持在微信内打开本页面。",
  wechat_state_invalid: "微信授权状态已失效，请重试。",
  wechat_denied: "你取消了微信授权。",
  wechat_token_failed: "微信授权失败，请重试。",
  wechat_session_failed: "微信登录会话创建失败，请重试。",
  wechat_callback_failed: "微信登录暂时不可用，请稍后重试。",
  auth_callback_failed: "邮箱验证链接已失效，请重新登录。"
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const configured = isWechatLoginConfigured();
  const inWechat = isWechatBrowser(requestHeaders.get("user-agent"));
  const errorMessage = params.error ? errorMessages[params.error] || "登录失败，请重试。" : null;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full">
        <SetupNotice />
        <div className="card p-6 sm:p-8">
          <div className="eyebrow">Welcome back</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight">登录 Campus Runner</h1>
          <p className="mt-2 text-sm text-slate-500">在微信内打开时可直接使用微信一键授权，电脑端可使用邮箱密码。</p>

          {errorMessage ? <p className="mt-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p> : null}

          <div className="mt-7">
            <WechatLoginButton configured={configured} inWechat={inWechat} next="/" />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> 其他方式 <span className="h-px flex-1 bg-slate-200" />
          </div>

          <details className="group" open={!configured || !inWechat}>
            <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <Mail className="size-4" /> 邮箱密码登录
            </summary>
            <ActionForm action={signInAction} className="mt-4 grid gap-4">
              <label className="label">邮箱<input className="field" type="email" name="email" autoComplete="email" placeholder="name@example.com" required /></label>
              <label className="label">密码<input className="field" type="password" name="password" autoComplete="current-password" placeholder="至少 6 位" required /></label>
              <SubmitButton className="mt-1 w-full" variant="secondary">邮箱登录 <ArrowRight className="size-4" /></SubmitButton>
            </ActionForm>
          </details>

          <p className="mt-6 text-center text-sm text-slate-500">
            还没有账号？ <Link className="font-bold text-blue-700" href="/register">立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
