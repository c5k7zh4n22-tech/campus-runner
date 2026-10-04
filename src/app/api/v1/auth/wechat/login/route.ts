import { z } from "zod";
import { apiError, apiException, apiOk, readJson, validationMessage } from "@/lib/api";
import { isWechatMiniappConfigured, signInWithWechatMiniapp } from "@/lib/services/auth/miniapp-auth-service";

export const runtime = "nodejs";

const loginSchema = z.object({
  code: z.string().trim().min(1, "缺少微信登录 code"),
  displayName: z.string().trim().min(1).max(30).optional(),
  avatarUrl: z.string().trim().url().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  try {
    if (!isWechatMiniappConfigured()) {
      return apiError("not_implemented", "微信小程序登录尚未配置，请先设置 WECHAT_MINIAPP_LOGIN_ENABLED、WECHAT_MINIAPP_APP_ID 和 WECHAT_MINIAPP_APP_SECRET。");
    }

    const body = await readJson(request);
    const parsed = loginSchema.safeParse({
      code: body?.code,
      displayName: body?.displayName,
      avatarUrl: body?.avatarUrl
    });
    if (!parsed.success) return apiError("bad_request", validationMessage(parsed.error));

    const session = await signInWithWechatMiniapp({
      code: parsed.data.code,
      displayName: parsed.data.displayName,
      avatarUrl: parsed.data.avatarUrl || null,
      userAgent: request.headers.get("user-agent")
    });

    return apiOk({
      token: session.token,
      tokenType: "Bearer",
      expiresAt: session.expiresAt,
      user: session.user,
      profile: session.profile,
      isNewUser: session.isNewUser
    });
  } catch (error) {
    return apiException(error);
  }
}
