import { z } from "zod";
import { apiError, apiException, apiOk, requireApiProfile } from "@/lib/api";
import { transitionOrder } from "@/lib/services/orders";

export const runtime = "nodejs";

const idSchema = z.uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireApiProfile(request);
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return apiError("bad_request", "订单 ID 不正确");

    await transitionOrder(profile.id, parsed.data, "confirm");
    return apiOk({ updated: true });
  } catch (error) {
    return apiException(error);
  }
}
