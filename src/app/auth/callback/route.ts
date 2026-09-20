import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/config";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectUrl = new URL("/login", siteUrl);
  const hasProviderCallback =
    requestUrl.searchParams.has("code") ||
    requestUrl.searchParams.has("token_hash") ||
    requestUrl.searchParams.has("error");

  if (hasProviderCallback) redirectUrl.searchParams.set("error", "auth_callback_unsupported");

  return NextResponse.redirect(redirectUrl);
}
