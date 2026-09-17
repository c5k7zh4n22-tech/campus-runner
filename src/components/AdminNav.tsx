import Link from "next/link";
import { BarChart3, Flag, ScrollText, ShoppingBag, UsersRound } from "lucide-react";

const links = [
  { href: "/admin", label: "概览", icon: BarChart3 },
  { href: "/admin/users", label: "用户", icon: UsersRound },
  { href: "/admin/orders", label: "订单", icon: ScrollText },
  { href: "/admin/listings", label: "闲置", icon: ShoppingBag },
  { href: "/admin/reports", label: "举报", icon: Flag }
];

export function AdminNav({ active }: { active: string }) {
  return (
    <nav className="mb-7 flex gap-2 overflow-x-auto pb-1">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
            active === href ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-950"
          }`}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
