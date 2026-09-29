import type { Metadata, Viewport } from "next";
import { MobileNav } from "@/components/MobileNav";
import { getCurrentProfileForLayout } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Campus Runner | 校园跑腿",
    template: "%s | Campus Runner"
  },
  description: "面向大学校园内部的互助跑腿平台。发布任务，顺手帮忙。",
  applicationName: "Campus Runner"
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f7fb"
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfileForLayout();

  return (
    <html lang="zh-CN">
      <body>
        <NavigationProgress />
        <SiteHeader profile={profile} />
        <main>{children}</main>
        <MobileNav signedIn={Boolean(profile)} />
        <footer className="mt-8 border-t border-slate-200 bg-white sm:mt-20">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-4 py-8 text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
            <span>© 2026 Campus Runner · 校园互助跑腿 MVP</span>
            <span>仅限已认证校园用户参与交易，请遵守校规与平台规则。</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
