import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { signUpAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata: Metadata = { title: "注册" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full">
        <SetupNotice />
        <div className="card p-6 sm:p-8">
          <div className="eyebrow">Join your campus</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight">创建校园账号</h1>
          <p className="mt-2 text-sm text-slate-500">当前仅开放莆田学院。注册后使用 12 位学号和手机号提交校园认证。</p>

          <ActionForm action={signUpAction} className="mt-7 grid gap-4">
            <label className="label">
              昵称
              <input className="field" name="displayName" autoComplete="nickname" placeholder="别人如何称呼你" minLength={2} required />
            </label>
            <label className="label">
              邮箱
              <input className="field" type="email" name="email" autoComplete="email" placeholder="name@example.com" required />
            </label>
            <label className="label">
              密码
              <input className="field" type="password" name="password" autoComplete="new-password" placeholder="至少 8 位" minLength={8} required />
            </label>
            <SubmitButton className="mt-1 w-full">注册并继续 <ArrowRight className="size-4" /></SubmitButton>
          </ActionForm>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            你的手机号、学号只用于校园认证，不会展示在公开订单中。
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            已有账号？ <Link className="font-bold text-blue-700" href="/login">去登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
