import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isWechatBrowser, sanitizeNextPath, wechatAuthProvider } from "@/lib/services/auth";
import { siteUrl } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!wechatAuthProvider.isConfigured()) {
    return NextResponse.redirect(new URL("/login?error=wechat_not_configured", request.url));
  }

  if (!isWechatBrowser(request.headers.get("user-agent"))) {
    return NextResponse.redirect(new URL("/login?error=wechat_only_in_wechat", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(wechatAuthProvider.getAuthorizationUrl(state));
  const secure = siteUrl.startsWith("https://");
  response.cookies.set("cr_wechat_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 600,
    path: "/"
  });
  response.cookies.set("cr_wechat_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 600,
    path: "/"
  });

  return response;
}
