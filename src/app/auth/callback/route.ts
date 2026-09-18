import { NextResponse } from "next/server";
import { authService } from "@/lib/services/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const result = await authService.exchangeCodeForSession(code);
    if (!result.error) return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/"}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
