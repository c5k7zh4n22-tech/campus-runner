import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { dbErrorMessage } from "@/lib/db";
import { authService } from "@/lib/services/auth";
import { verifyApiSessionToken } from "@/lib/services/auth/miniapp-auth-service";
import { getProfileByUserId } from "@/lib/services/profile";

export type ApiErrorCode = "bad_request" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "server_error" | "not_implemented" | "rate_limited";

const statusByCode: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  server_error: 500,
  not_implemented: 501,
  rate_limited: 429
};

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function apiError(code: ApiErrorCode, message: string, init?: ResponseInit) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status: statusByCode[code], ...init }
  );
}

export function validationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "提交内容不正确";
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function bearerToken(request?: Request) {
  const header = request?.headers.get("authorization") || "";
  const [scheme, token] = header.split(/\s+/, 2);
  return /^Bearer$/i.test(scheme) && token ? token : null;
}

function publicApiUser<T extends { email: string | null } | null>(user: T): T {
  if (user?.email?.endsWith("@wechat.local")) return { ...user, email: null };
  return user;
}

export async function getApiUser(request?: Request) {
  const token = bearerToken(request);
  if (token) return publicApiUser(await verifyApiSessionToken(token));
  return publicApiUser(await authService.getCurrentUser());
}

export async function getApiProfile(request?: Request) {
  const user = await getApiUser(request);
  if (!user) return null;
  return getProfileByUserId(user.id);
}

export async function requireApiProfile(request?: Request) {
  const profile = await getApiProfile(request);
  if (!profile) throw new ApiUnauthorizedError();
  return profile;
}

export function apiException(error: unknown) {
  if (error instanceof ApiUnauthorizedError) return apiError("unauthorized", "请先登录");
  if (error instanceof ApiForbiddenError) return apiError("forbidden", error.message);
  if (error instanceof ApiNotFoundError) return apiError("not_found", error.message);
  if (error instanceof ApiConflictError) return apiError("conflict", error.message);
  console.error("API request failed", error);
  return apiError("server_error", dbErrorMessage(error));
}

export class ApiUnauthorizedError extends Error {
  constructor() {
    super("请先登录");
  }
}

export class ApiForbiddenError extends Error {
  constructor(message = "无权操作") {
    super(message);
  }
}

export class ApiNotFoundError extends Error {
  constructor(message = "资源不存在") {
    super(message);
  }
}

export class ApiConflictError extends Error {
  constructor(message = "当前状态不允许操作") {
    super(message);
  }
}
