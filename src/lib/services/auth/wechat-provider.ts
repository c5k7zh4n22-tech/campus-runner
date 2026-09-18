import "server-only";

import { isAdminClientConfigured } from "@/lib/services/admin-client";
import { isSupabaseConfigured, siteUrl } from "@/lib/supabase/config";

export interface WechatIdentity {
  providerUserId: string;
  unionId: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface WechatAuthProvider {
  isConfigured(): boolean;
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<WechatIdentity>;
}

type WechatTokenResponse = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserResponse = {
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

function cleanDisplayName(value?: string) {
  const characters = Array.from(value?.trim() || "微信用户");
  if (characters.length < 2) characters.push("用户");
  return characters.slice(0, 30).join("") || "微信用户";
}

export class OfficialAccountWechatProvider implements WechatAuthProvider {
  readonly appId =
    process.env.WECHAT_OFFICIAL_ACCOUNT_APP_ID ||
    process.env.WECHAT_APP_ID ||
    "";
  readonly appSecret =
    process.env.WECHAT_OFFICIAL_ACCOUNT_APP_SECRET ||
    process.env.WECHAT_APP_SECRET ||
    "";
  readonly redirectUri =
    process.env.WECHAT_REDIRECT_URI || `${siteUrl}/api/auth/wechat/callback`;

  isConfigured() {
    return Boolean(
      isSupabaseConfigured &&
        isAdminClientConfigured() &&
        this.appId &&
        this.appSecret &&
        this.redirectUri.startsWith("https://")
    );
  }

  getAuthorizationUrl(state: string) {
    const url = new URL("https://open.weixin.qq.com/connect/oauth2/authorize");
    url.searchParams.set("appid", this.appId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "snsapi_userinfo");
    url.searchParams.set("state", state);
    return `${url.toString()}#wechat_redirect`;
  }

  async exchangeCode(code: string): Promise<WechatIdentity> {
    const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
    tokenUrl.searchParams.set("appid", this.appId);
    tokenUrl.searchParams.set("secret", this.appSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("grant_type", "authorization_code");

    const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
    const token = (await tokenResponse.json()) as WechatTokenResponse;
    if (!tokenResponse.ok || token.errcode || !token.access_token || !token.openid) {
      throw new Error(token.errmsg || "WeChat token exchange failed");
    }

    const userUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
    userUrl.searchParams.set("access_token", token.access_token);
    userUrl.searchParams.set("openid", token.openid);
    userUrl.searchParams.set("lang", "zh_CN");
    const userResponse = await fetch(userUrl, { cache: "no-store" });
    const user = (await userResponse.json()) as WechatUserResponse;

    return {
      providerUserId: token.openid,
      unionId: token.unionid || user.unionid || null,
      displayName: cleanDisplayName(user.nickname),
      avatarUrl: user.headimgurl?.replace(/^http:/, "https:") || null
    };
  }
}

export function isWechatBrowser(userAgent: string | null | undefined) {
  return /MicroMessenger/i.test(userAgent ?? "");
}

export function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
