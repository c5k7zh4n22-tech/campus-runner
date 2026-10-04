import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { maybeOne, transaction } from "@/lib/db";
import { assignInviteCodeToProfile } from "@/lib/services/invitations";
import type { Profile } from "@/lib/types";
import type { AppUser } from "./types";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

type WechatCodeSessionResponse = {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
};

type MiniappIdentity = {
  openId: string;
  unionId: string | null;
};

type LoginInput = {
  code: string;
  displayName?: string;
  avatarUrl?: string | null;
  userAgent?: string | null;
};

function miniappAppId() {
  return process.env.WECHAT_MINIAPP_APP_ID || process.env.WECHAT_APP_ID || "";
}

function miniappAppSecret() {
  return process.env.WECHAT_MINIAPP_APP_SECRET || process.env.WECHAT_APP_SECRET || "";
}

export function isWechatMiniappConfigured() {
  return Boolean(process.env.WECHAT_MINIAPP_LOGIN_ENABLED === "true" && miniappAppId() && miniappAppSecret());
}

function cleanDisplayName(value?: string) {
  const chars = Array.from(value?.trim() || "微信用户");
  if (chars.length < 2) chars.push("用户");
  return chars.slice(0, 30).join("") || "微信用户";
}

function cleanAvatarUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString().replace(/^http:/, "https:");
  } catch {
    return null;
  }
}

function internalWechatEmail(openId: string) {
  const digest = createHash("sha256").update(openId).digest("hex").slice(0, 32);
  return `wechat-miniapp-${digest}@wechat.local`;
}

function disabledPasswordHash() {
  return `wechat-miniapp-disabled-${randomBytes(24).toString("base64url")}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function createToken() {
  return `crma_${randomBytes(32).toString("base64url")}`;
}

async function exchangeMiniappCode(code: string): Promise<MiniappIdentity> {
  if (!isWechatMiniappConfigured()) throw new Error("微信小程序登录尚未配置");

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", miniappAppId());
  url.searchParams.set("secret", miniappAppSecret());
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as WechatCodeSessionResponse;
  if (!response.ok || payload.errcode || !payload.openid) {
    throw new Error(payload.errmsg || "微信小程序登录失败");
  }

  return { openId: payload.openid, unionId: payload.unionid || null };
}

async function createApiSession(client: PoolClient, input: { userId: string; userAgent?: string | null }) {
  const token = createToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();
  await client.query(
    `insert into app_api_sessions (user_id, token_hash, client, expires_at, user_agent)
     values ($1, $2, 'miniapp', $3, $4)`,
    [input.userId, tokenHash, expiresAt, input.userAgent?.slice(0, 500) || null]
  );
  return { token, expiresAt };
}

export async function verifyApiSessionToken(token: string): Promise<AppUser | null> {
  if (!token.startsWith("crma_")) return null;
  const row = await maybeOne<{ id: string; email: string | null }>(
    `update app_api_sessions s
     set last_seen_at = now()
     from app_users u
     join profiles p on p.id = u.id
     where s.user_id = u.id
       and s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
       and p.status = 'active'
     returning u.id, u.email`,
    [hashToken(token)]
  );
  return row ? { id: row.id, email: row.email } : null;
}

async function findOrCreateWechatUser(client: PoolClient, identity: MiniappIdentity, input: LoginInput) {
  const existing = await client.query<{ user_id: string }>(
    "select user_id from app_user_identities where provider = 'wechat_miniapp' and provider_user_id = $1 limit 1",
    [identity.openId]
  );
  if (existing.rows[0]) {
    await client.query(
      "update app_user_identities set union_id = coalesce($1, union_id), updated_at = now() where provider = 'wechat_miniapp' and provider_user_id = $2",
      [identity.unionId, identity.openId]
    );
    return { userId: existing.rows[0].user_id, created: false };
  }

  const inserted = await client.query<{ id: string }>(
    "insert into app_users (email, password_hash, email_confirmed) values ($1, $2, true) returning id",
    [internalWechatEmail(identity.openId), disabledPasswordHash()]
  );
  const userId = inserted.rows[0].id;
  await client.query(
    "insert into profiles (id, display_name, avatar_url) values ($1, $2, $3)",
    [userId, cleanDisplayName(input.displayName), cleanAvatarUrl(input.avatarUrl)]
  );
  await assignInviteCodeToProfile(client, userId);
  await client.query(
    `insert into app_user_identities (user_id, provider, provider_user_id, union_id)
     values ($1, 'wechat_miniapp', $2, $3)`,
    [userId, identity.openId, identity.unionId]
  );
  return { userId, created: true };
}

export async function signInWithWechatMiniapp(input: LoginInput) {
  const identity = await exchangeMiniappCode(input.code);
  return transaction(async (client) => {
    const account = await findOrCreateWechatUser(client, identity, input);
    const session = await createApiSession(client, { userId: account.userId, userAgent: input.userAgent });
    const profile = await client.query<Profile>(
      "select * from profiles where id = $1",
      [account.userId]
    );
    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: { id: account.userId, email: null },
      profile: profile.rows[0] ?? null,
      isNewUser: account.created
    };
  });
}
