import Link from "next/link";
import Image from "next/image";
import { ClipboardList, LogOut, Plus, ShieldCheck, UserRound } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import type { Profile } from "@/lib/types";
import { ButtonLink } from "./ui/Button";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/20">跑</span>
          <span>
            <strong className="block whitespace-nowrap text-xs font-black tracking-tight text-slate-900 sm:text-sm">Campus Runner</strong>
            <span className="hidden text-[10px] text-slate-400 sm:block">校园跑腿</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/orders">跑腿大厅</Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/marketplace">闲置市场</Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/my-orders">我的订单</Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950" href="/profile">个人资料</Link>
          {profile?.role === "admin" ? <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50" href="/admin">管理后台</Link> : null}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {profile ? (
            <>
              <ButtonLink href="/orders/create" className="hidden sm:inline-flex" variant="secondary">
                <Plus className="size-4" /> 发布跑腿
              </ButtonLink>
              <Link href="/profile" className="relative flex size-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200" aria-label="个人资料">
                {profile.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="40px" className="object-cover" /> : <UserRound className="size-5" />}
              </Link>
              <details className="relative md:hidden">
                <summary className="grid min-h-11 cursor-pointer list-none place-items-center rounded-xl px-2 text-xs font-bold text-slate-600">更多</summary>
                <div className="absolute right-0 top-full mt-2 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <Link href="/my-orders" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-700"><ClipboardList className="size-4" />我的订单</Link>
                  {profile.role === "admin" ? <Link href="/admin" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-violet-700"><ShieldCheck className="size-4" />管理后台</Link> : null}
                  <form action={signOutAction}><button className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm text-slate-500" type="submit"><LogOut className="size-4" />退出登录</button></form>
                </div>
              </details>
              <form action={signOutAction} className="hidden md:block">
                <button type="submit" className="grid size-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="退出登录">
                  <LogOut className="size-5" />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link className="flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-slate-600 sm:px-3" href="/login">登录</Link>
              <ButtonLink href="/register">注册</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
