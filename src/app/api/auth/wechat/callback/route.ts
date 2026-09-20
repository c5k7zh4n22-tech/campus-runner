import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?error=wechat_not_configured", request.url));
}
