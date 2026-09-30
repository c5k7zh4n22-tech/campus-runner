import { NextResponse, type NextRequest } from "next/server";
import { resolveInvitationCodeWithRateLimit } from "@/lib/services/invitations";

export const runtime = "nodejs";

function clientRateKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `invite:${forwarded || realIp || "unknown"}`;
}

export async function POST(request: NextRequest) {
  let code = "";
  try {
    const body = await request.json() as { code?: unknown };
    code = typeof body.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ ok: false, message: "邀请码无效或暂不可用" }, { status: 400 });
  }

  const result = await resolveInvitationCodeWithRateLimit(code, clientRateKey(request));
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.limited ? 429 : 400 });
  }

  return NextResponse.json({
    ok: true,
    invitation: {
      code: result.invitation.code,
      source: result.invitation.source,
      maskedName: result.invitation.maskedName,
      campusName: result.invitation.campusName
    }
  });
}
