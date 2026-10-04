import { z } from "zod";
import { apiError, apiException, apiOk } from "@/lib/api";
import { getOrderById, getPublicProfiles } from "@/lib/data";

export const runtime = "nodejs";

const idSchema = z.uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return apiError("bad_request", "订单 ID 不正确");

    const order = await getOrderById(parsed.data);
    if (!order) return apiError("not_found", "订单不存在");

    const profiles = await getPublicProfiles([order.publisher_id, order.runner_id]);
    return apiOk({ order, profiles });
  } catch (error) {
    return apiException(error);
  }
}
