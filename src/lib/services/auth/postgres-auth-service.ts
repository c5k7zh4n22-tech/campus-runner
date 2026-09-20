import "server-only";

import { createHmac, randomBytes, timingSafeEqual, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { transaction, maybeOne, isDatabaseConfigured } from "@/lib/db";
import type { AppUser, AuthResult, AuthService } from "./types";

const scrypt = promisify(scryptCallback);
const cookieName = process.env.AUTH_COOKIE_NAME || "cr_session";
const maxAgeSeconds = 60 * 60 * 24 * 30;
const truthyValues = new Set(["1", "true", "yes", "on"]);
const falsyValues = new Set(["0", "false", "no", "off"]);

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  status: string | null;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

function encodeSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function sessionCookieSecure() {
  const explicit = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (explicit && truthyValues.has(explicit)) return true;
  if (explicit && falsyValues.has(explicit)) return false;

  const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (configuredUrl) return configuredUrl.startsWith("https://");

  return process.env.NODE_ENV === "production";
}

function decodeSession(value: string | undefined) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
  if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return decoded.sub;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

async function setSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    maxAge: maxAgeSeconds,
    path: "/"
  });
}

export class PostgresAuthService implements AuthService {
  isConfigured() {
    return isDatabaseConfigured() && Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
  }

  async getCurrentUser(): Promise<AppUser | null> {
    if (!this.isConfigured()) return null;
    const cookieStore = await cookies();
    const userId = decodeSession(cookieStore.get(cookieName)?.value);
    if (!userId) return null;
    const user = await maybeOne<{ id: string; email: string }>(
      "select u.id, u.email from app_users u join profiles p on p.id = u.id where u.id = $1 and p.status = 'active'",
      [userId]
    );
    return user ? { id: user.id, email: user.email } : null;
  }

  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    if (!this.isConfigured()) return { error: "认证服务尚未配置" };
    const user = await maybeOne<UserRow>(
      "select u.id, u.email, u.password_hash, p.status from app_users u join profiles p on p.id = u.id where lower(u.email) = lower($1)",
      [email]
    );
    if (!user || user.status !== "active" || !(await verifyPassword(password, user.password_hash))) {
      return { error: "邮箱或密码错误" };
    }
    await setSession(user.id);
    return {};
  }

  async signUpWithPassword(input: {
    email: string;
    password: string;
    displayName: string;
    redirectTo: string;
  }): Promise<AuthResult & { sessionCreated: boolean }> {
    if (!this.isConfigured()) return { error: "认证服务尚未配置", sessionCreated: false };
    try {
      const passwordHash = await hashPassword(input.password);
      const user = await transaction(async (client) => {
        const inserted = await client.query<{ id: string; email: string }>(
          "insert into app_users (email, password_hash, email_confirmed) values (lower($1), $2, true) returning id, email",
          [input.email, passwordHash]
        );
        const row = inserted.rows[0];
        await client.query(
          "insert into profiles (id, display_name) values ($1, $2)",
          [row.id, input.displayName]
        );
        return row;
      });
      await setSession(user.id);
      return { sessionCreated: true };
    } catch (error) {
      if (error instanceof Error && /duplicate|unique/i.test(error.message)) return { error: "该邮箱已注册", sessionCreated: false };
      return { error: error instanceof Error ? error.message : "注册失败", sessionCreated: false };
    }
  }

  async signOut(): Promise<AuthResult> {
    const cookieStore = await cookies();
    cookieStore.delete(cookieName);
    return {};
  }

  async exchangeCodeForSession(): Promise<AuthResult> {
    return { error: "当前认证服务不支持邮箱链接回调" };
  }

  async verifyMagicLinkToken(): Promise<AuthResult> {
    return { error: "当前认证服务不支持 Magic Link" };
  }
}
