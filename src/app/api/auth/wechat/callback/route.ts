import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import {
  isWechatLoginConfigured,
  sanitizeNextPath,
  wechatAppId,
  wechatAppSecret
} from "@/lib/wechat/config";

export const runtime = "nodejs";

type WechatTokenResponse = {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatUserResponse = {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

function redirectWithError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

function cleanDisplayName(value?: string) {
  const characters = Array.from(value?.trim() || "微信用户");
  if (characters.length < 2) characters.push("用户");
  return characters.slice(0, 30).join("") || "微信用户";
}

export async function GET(request: NextRequest) {
  if (!isWechatLoginConfigured()) {
    return redirectWithError(request, "wechat_not_configured");
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("cr_wechat_state")?.value;
  const next = sanitizeNextPath(cookieStore.get("cr_wechat_next")?.value ?? null);

  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return redirectWithError(request, "wechat_state_invalid");
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.delete("cr_wechat_state");
  response.cookies.delete("cr_wechat_next");

  try {
    const tokenUrl = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
    tokenUrl.searchParams.set("appid", wechatAppId);
    tokenUrl.searchParams.set("secret", wechatAppSecret);
    tokenUrl.searchParams.set("code", code);
    tokenUrl.searchParams.set("grant_type", "authorization_code");

    const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
    const tokenData = (await tokenResponse.json()) as WechatTokenResponse;

    if (!tokenResponse.ok || tokenData.errcode || !tokenData.access_token || !tokenData.openid) {
      console.error("WeChat token exchange failed", tokenData.errcode, tokenData.errmsg);
      return redirectWithError(request, "wechat_token_failed");
    }

    const userInfoUrl = new URL("https://api.weixin.qq.com/sns/userinfo");
    userInfoUrl.searchParams.set("access_token", tokenData.access_token);
    userInfoUrl.searchParams.set("openid", tokenData.openid);
    userInfoUrl.searchParams.set("lang", "zh_CN");

    const userResponse = await fetch(userInfoUrl, { cache: "no-store" });
    const wechatUser = (await userResponse.json()) as WechatUserResponse;
    const stableIdentity = tokenData.unionid || wechatUser.unionid || tokenData.openid;
    const identityHash = createHash("sha256").update(stableIdentity).digest("hex").slice(0, 40);
    const email = `wechat_${identityHash}@wechat.campus-runner.local`;
    const displayName = cleanDisplayName(wechatUser.nickname);
    const avatarUrl = wechatUser.headimgurl?.replace(/^http:/, "https:") || null;

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return redirectWithError(request, "wechat_not_configured");

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let user = null;
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      user = data.users.find((item) => item.email?.toLowerCase() === email) ?? null;
      if (user || data.users.length < 1000) break;
    }

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: identityHash,
        user_metadata: {
          display_name: displayName,
          avatar_url: avatarUrl,
          login_provider: "wechat",
          wechat_openid: tokenData.openid,
          wechat_unionid: tokenData.unionid || wechatUser.unionid || null
        }
      });
      if (error) throw error;
      user = data.user;
    } else {
      const { data: updatedUser, error: updateUserError } = await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          display_name: displayName,
          avatar_url: avatarUrl,
          login_provider: "wechat",
          wechat_openid: tokenData.openid,
          wechat_unionid: tokenData.unionid || wechatUser.unionid || user.user_metadata?.wechat_unionid || null
        }
      });
      if (updateUserError) throw updateUserError;
      user = updatedUser.user;
    }

    if (!user) return redirectWithError(request, "wechat_session_failed");

    const { data: campus } = await admin
      .from("campuses")
      .select("id")
      .eq("slug", "ptu")
      .maybeSingle();

    await admin
      .from("profiles")
      .update({
        display_name: displayName,
        avatar_url: avatarUrl,
        campus_id: campus?.id ?? null
      })
      .eq("id", user.id);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: new URL(next, request.url).toString() }
    });
    if (linkError) throw linkError;

    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) return redirectWithError(request, "wechat_session_failed");

    const sessionClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    });

    const { error: verifyError } = await sessionClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash
    });
    if (verifyError) {
      console.error("WeChat Supabase session failed", verifyError.message);
      return redirectWithError(request, "wechat_session_failed");
    }

    return response;
  } catch (error) {
    console.error("WeChat callback failed", error);
    return redirectWithError(request, "wechat_callback_failed");
  }
}
