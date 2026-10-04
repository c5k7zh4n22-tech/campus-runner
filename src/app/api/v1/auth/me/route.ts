import { apiException, apiOk, getApiProfile, getApiUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const [user, profile] = await Promise.all([getApiUser(request), getApiProfile(request)]);
    return apiOk({ authenticated: Boolean(user), user, profile });
  } catch (error) {
    return apiException(error);
  }
}
