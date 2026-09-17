import Link from "next/link";
import { ClipboardList, LogOut, Plus, ShieldCheck, UserRound } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import type { Profile } from "@/lib/types";
import { ButtonLink } from "./ui/Button";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/20">跑</span>
          <span>
            <strong className="block text-sm font-black tracking-tight text-slate-900">Campus Runner</strong>
            <span className="hidden text-[10px] text-slate-400 sm:block">校园跑腿</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/orders">跑腿大厅</Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/my-orders">我的订单</Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/profile">个人资料</Link>
          {profile?.role === "admin" ? <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50" href="/admin">管理后台</Link> : null}
        </nav>

        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <ButtonLink href="/orders/create" className="hidden sm:inline-flex" variant="secondary">
                <Plus className="size-4" /> 发布跑腿
              </ButtonLink>
              <Link href="/profile" className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200" aria-label="个人资料">
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : <UserRound className="size-5" />}
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="退出登录">
                  <LogOut className="size-5" />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 sm:block" href="/login">登录</Link>
              <ButtonLink href="/register">注册</ButtonLink>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
        <Link className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600" href="/orders"><ClipboardList className="size-4" />跑腿大厅</Link>
        <Link className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600" href="/my-orders"><ClipboardList className="size-4" />我的订单</Link>
        <Link className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-600" href="/orders/create"><Plus className="size-4" />发布</Link>
        {profile?.role === "admin" ? <Link className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-violet-700" href="/admin"><ShieldCheck className="size-4" />管理</Link> : null}
      </div>
    </header>
  );
}
