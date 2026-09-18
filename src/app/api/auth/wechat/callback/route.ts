import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/services/admin-client";
import {
  authAdminService,
  sanitizeNextPath,
  wechatAuthProvider
} from "@/lib/services/auth";

export const runtime = "nodejs";

function redirectWithError(request: NextRequest, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
}

export async function GET(request: NextRequest) {
  if (!wechatAuthProvider.isConfigured()) {
    return redirectWithError(request, "wechat_not_configured");
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const denied = requestUrl.searchParams.has("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("cr_wechat_state")?.value;
  const next = sanitizeNextPath(cookieStore.get("cr_wechat_next")?.value ?? null);

  if (denied) return redirectWithError(request, "wechat_denied");
  if (!code || !returnedState || !expectedState || returnedState !== expectedState) {
    return redirectWithError(request, "wechat_state_invalid");
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.delete("cr_wechat_state");
  response.cookies.delete("cr_wechat_next");

  try {
    const identity = await wechatAuthProvider.exchangeCode(code);
    const stableIdentity = identity.unionId || identity.providerUserId;
    const identityHash = createHash("sha256").update(stableIdentity).digest("hex").slice(0, 40);
    const email = `wechat_${identityHash}@wechat.campus-runner.local`;
    const metadata = {
      display_name: identity.displayName,
      avatar_url: identity.avatarUrl,
      login_provider: "wechat",
      wechat_openid: identity.providerUserId,
      wechat_unionid: identity.unionId
    };

    let user = await authAdminService.findUserByEmail(email);
    if (!user) {
      user = await authAdminService.createConfirmedUser({
        email,
        password: identityHash,
        metadata
      });
    } else {
      await authAdminService.updateUserMetadata(user.id, { ...user.metadata, ...metadata });
    }

    const adminDb = createSupabaseAdminClient();

    const { data: campus } = await adminDb
      .from("campuses")
      .select("id")
      .eq("slug", "ptu")
      .maybeSingle();

    await adminDb
      .from("profiles")
      .update({
        display_name: identity.displayName,
        avatar_url: identity.avatarUrl,
        campus_id: campus?.id ?? null
      })
      .eq("id", user.id);

    const tokenHash = await authAdminService.generateMagicLinkToken(
      email,
      new URL(next, request.url).toString()
    );

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
