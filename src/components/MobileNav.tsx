"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, MessageCircle, Plus, UserRound } from "lucide-react";
import { useCallback } from "react";
import type { MessageSummary } from "@/lib/message-types";
import { UnreadBadge, messageRequest, useMessagePolling } from "./messages/shared";

const links = [
  { href: "/", label: "首页", icon: Home },
  { href: "/orders", label: "跑腿", icon: ClipboardList },
  { href: "/orders/create", label: "发布", icon: Plus },
  { href: "/messages", label: "消息", icon: MessageCircle },
  { href: "/profile", label: "我的", icon: UserRound }
];

export function MobileNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const loader = useCallback((signal: AbortSignal) => messageRequest<MessageSummary>("?view=summary", undefined, signal), []);
  const { data, error } = useMessagePolling(loader, signedIn, 30000);
  const unread = signedIn && !error ? data?.total || 0 : 0;

  return (
    <nav aria-label="手机主导航" className="mobile-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl md:hidden">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/"
          : href === "/orders" ? pathname.startsWith("/orders") && pathname !== "/orders/create"
          : href === "/profile" ? ["/profile", "/my-orders", "/login", "/register", "/admin"].some((path) => pathname === path || pathname.startsWith(`${path}/`))
          : pathname === href || pathname.startsWith(`${href}/`);
        const isCreate = href === "/orders/create";

        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition ${isCreate ? "text-blue-700" : active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}>
            <span className={isCreate ? "-mt-5 grid size-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "relative grid size-8 place-items-center"}>
              <Icon className="size-5" aria-hidden="true" />
              {href === "/messages" && <UnreadBadge count={unread} />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
