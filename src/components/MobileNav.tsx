"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, ListChecks, Plus, UserRound } from "lucide-react";

const links = [
  { href: "/", label: "首页", icon: Home },
  { href: "/orders", label: "跑腿", icon: ClipboardList },
  { href: "/orders/create", label: "发布", icon: Plus },
  { href: "/my-orders", label: "订单", icon: ListChecks },
  { href: "/profile", label: "我的", icon: UserRound }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="手机主导航" className="mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/"
          : href === "/orders" ? pathname.startsWith("/orders") && pathname !== "/orders/create"
          : href === "/my-orders" ? pathname.startsWith("/my-orders")
          : href === "/profile" ? ["/profile", "/login", "/register", "/admin"].some((path) => pathname === path || pathname.startsWith(`${path}/`))
          : pathname === href || pathname.startsWith(`${href}/`);
        const isCreate = href === "/orders/create";

        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition ${isCreate ? "text-blue-700" : active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
            <span className={isCreate ? "-mt-5 grid size-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "grid size-8 place-items-center"}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
