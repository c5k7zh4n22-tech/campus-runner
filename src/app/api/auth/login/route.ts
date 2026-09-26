import { NextResponse, type NextRequest } from "next/server";
import { authService } from "@/lib/services/auth";
import { loginSchema } from "@/lib/validation";

const loginErrors = new Set([
  "invalid_credentials",
  "invalid_form",
  "auth_not_configured",
  "login_failed"
]);

function loginUrl(request: NextRequest, error?: string) {
  const url = new URL("/login", request.url);
  if (error && loginErrors.has(error)) url.searchParams.set("error", error);
  return url;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return NextResponse.redirect(loginUrl(request, "invalid_form"), 303);
  }

  try {
    const result = await authService.signInWithPassword(parsed.data.email, parsed.data.password);
    if (result.error) {
      const error = result.error === "认证服务尚未配置" ? "auth_not_configured" : "invalid_credentials";
      return NextResponse.redirect(loginUrl(request, error), 303);
    }
  } catch (error) {
    console.error("Password login failed", error);
    return NextResponse.redirect(loginUrl(request, "login_failed"), 303);
  }

  return NextResponse.redirect(new URL("/", request.url), 303);
}
