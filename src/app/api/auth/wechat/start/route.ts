import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  isWechatLoginConfigured,
  sanitizeNextPath,
  wechatAppId,
  wechatRedirectUri
} from "@/lib/wechat/config";
import { siteUrl } from "@/lib/supabase/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const next = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (!isWechatLoginConfigured()) {
    return NextResponse.redirect(new URL("/login?error=wechat_not_configured", request.url));
  }

  const state = randomBytes(24).toString("hex");
  const authorizeUrl = new URL("https://open.weixin.qq.com/connect/qrconnect");
  authorizeUrl.searchParams.set("appid", wechatAppId);
  authorizeUrl.searchParams.set("redirect_uri", wechatRedirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "snsapi_login");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(`${authorizeUrl.toString()}#wechat_redirect`);
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
