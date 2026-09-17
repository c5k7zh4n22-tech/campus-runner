import "server-only";

import { isSupabaseConfigured, siteUrl } from "@/lib/supabase/config";

export const wechatAppId = process.env.WECHAT_APP_ID ?? "";
export const wechatAppSecret = process.env.WECHAT_APP_SECRET ?? "";
export const wechatRedirectUri =
  process.env.WECHAT_REDIRECT_URI || `${siteUrl}/api/auth/wechat/callback`;

export function isWechatLoginConfigured() {
  return Boolean(
    isSupabaseConfigured &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      wechatAppId &&
      wechatAppSecret &&
      wechatRedirectUri.startsWith("https://")
  );
}

export function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
