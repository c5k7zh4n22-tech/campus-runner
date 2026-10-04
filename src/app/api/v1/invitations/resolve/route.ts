import { apiError, apiOk, readJson } from "@/lib/api";
import { resolveInvitationCodeWithRateLimit } from "@/lib/services/invitations";

export const runtime = "nodejs";

function clientRateKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return `v1-invite:${forwarded || realIp || "unknown"}`;
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) return apiError("bad_request", "邀请码无效或暂不可用");

  const result = await resolveInvitationCodeWithRateLimit(code, clientRateKey(request));
  if (!result.ok) return apiError(result.limited ? "rate_limited" : "bad_request", result.message);

  return apiOk({
    invitation: {
      code: result.invitation.code,
      source: result.invitation.source,
      maskedName: result.invitation.maskedName,
      campusName: result.invitation.campusName
    }
  });
}
