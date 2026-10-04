import { apiError, apiException, apiOk, readJson, requireApiProfile, validationMessage } from "@/lib/api";
import { updateProfile } from "@/lib/services/profile";
import { profileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireApiProfile(request);
    return apiOk({ profile });
  } catch (error) {
    return apiException(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireApiProfile(request);
    const body = await readJson(request);
    const parsed = profileSchema.safeParse({
      displayName: body?.displayName,
      campusId: body?.campusId
    });
    if (!parsed.success) return apiError("bad_request", validationMessage(parsed.error));

    await updateProfile(profile.id, parsed.data);
    return apiOk({ updated: true });
  } catch (error) {
    return apiException(error);
  }
}
