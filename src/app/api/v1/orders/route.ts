import { z } from "zod";
import { apiError, apiException, apiOk, readJson, requireApiProfile, validationMessage } from "@/lib/api";
import { getOrderPublishers, getOrders } from "@/lib/data";
import { createOrder } from "@/lib/services/orders";
import { orderSchema } from "@/lib/validation";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";

const orderStatusSchema = z.enum(["ALL", "PENDING", "ACCEPTED", "IN_PROGRESS", "WAITING_CONFIRM", "COMPLETED", "CANCELLED"]);
const orderSortSchema = z.enum(["newest", "deadline", "reward"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = orderStatusSchema.catch("PENDING").parse(url.searchParams.get("status") || "PENDING") as OrderStatus | "ALL";
    const sort = orderSortSchema.catch("newest").parse(url.searchParams.get("sort") || "newest");
    const campusId = url.searchParams.get("campusId") || undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
    const orders = await getOrders({ campusId, status, sort, limit });
    const publishers = await getOrderPublishers(orders);
    return apiOk({ orders, publishers });
  } catch (error) {
    return apiException(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireApiProfile(request);
    const body = await readJson(request);
    const parsed = orderSchema.safeParse({
      campusId: body?.campusId,
      pickupLocation: body?.pickupLocation,
      deliveryLocation: body?.deliveryLocation,
      description: body?.description,
      reward: body?.reward,
      deadline: body?.deadline
    });
    if (!parsed.success) return apiError("bad_request", validationMessage(parsed.error));

    const orderId = await createOrder(profile, parsed.data);
    return apiOk({ orderId }, { status: 201 });
  } catch (error) {
    return apiException(error);
  }
}
