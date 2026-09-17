import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signInAction } from "@/actions/auth";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { SetupNotice } from "@/components/SetupNotice";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md items-center px-4 py-10">
      <div className="w-full">
        <SetupNotice />
        <div className="card p-6 sm:p-8">
          <div className="eyebrow">Welcome back</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight">登录 Campus Runner</h1>
          <p className="mt-2 text-sm text-slate-500">继续处理你的发布和接单任务。</p>

          <ActionForm action={signInAction} className="mt-7 grid gap-4">
            <label className="label">
              邮箱
              <input className="field" type="email" name="email" autoComplete="email" placeholder="name@example.com" required />
            </label>
            <label className="label">
              密码
              <input className="field" type="password" name="password" autoComplete="current-password" placeholder="至少 6 位" required />
            </label>
            <SubmitButton className="mt-1 w-full">登录 <ArrowRight className="size-4" /></SubmitButton>
          </ActionForm>

          <p className="mt-6 text-center text-sm text-slate-500">
            还没有账号？ <Link className="font-bold text-blue-700" href="/register">立即注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
