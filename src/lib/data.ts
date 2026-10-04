import "server-only";

import { cache } from "react";
import { maybeOne, query } from "./db";
import { authService } from "./services/auth";
import type { Campus, Order, OrderStatus, Profile, PublicProfile, Report, Review, VerificationStatus } from "./types";

export const getCurrentUser = cache(async function getCurrentUser() {
  return authService.getCurrentUser();
});

export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return maybeOne<Profile>("select * from profiles where id = $1", [user.id]);
});

export const getCurrentProfileForLayout = cache(async function getCurrentProfileForLayout(): Promise<Profile | null> {
  try {
    return await getCurrentProfile();
  } catch (error) {
    console.error("Failed to load current profile for layout", error);
    return null;
  }
});

export const getCampuses = cache(async function getCampuses(): Promise<Campus[]> {
  const result = await query<Campus>("select * from campuses where is_active = true order by name");
  return result.rows;
});

export async function getOrders(filters?: {
  campusId?: string;
  status?: OrderStatus | "ALL";
  sort?: "newest" | "deadline" | "reward";
  limit?: number;
}): Promise<Order[]> {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters?.campusId) {
    values.push(filters.campusId);
    where.push(`campus_id = $${values.length}`);
  }
  if (filters?.status && filters.status !== "ALL") {
    values.push(filters.status);
    where.push(`status = $${values.length}`);
  }
  const orderBy = filters?.sort === "deadline" ? "deadline asc" : filters?.sort === "reward" ? "reward desc" : "created_at desc";
  values.push(filters?.limit ?? 50);
  const result = await query<Order>(
    `select * from orders ${where.length ? `where ${where.join(" and ")}` : ""} order by ${orderBy} limit $${values.length}`,
    values
  );
  return result.rows;
}

export const getOrderById = cache(async function getOrderById(id: string): Promise<Order | null> {
  return maybeOne<Order>("select * from orders where id = $1", [id]);
});

export async function getPublicProfiles(ids: Array<string | null | undefined>): Promise<Record<string, PublicProfile>> {
  const cleanIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (cleanIds.length === 0) return {};
  const result = await query<PublicProfile>(
    "select id, campus_id, display_name, avatar_url, verification_status, role, rating, review_count, created_at from profiles where id = any($1::uuid[])",
    [cleanIds]
  );
  return result.rows.reduce<Record<string, PublicProfile>>((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});
}

export async function getMyOrders(userId: string): Promise<Order[]> {
  const result = await query<Order>(
    "select * from orders where publisher_id = $1 or runner_id = $1 order by created_at desc limit 100",
    [userId]
  );
  return result.rows;
}

export async function getOrderPublishers(orders: Order[]) {
  return getPublicProfiles(orders.map((order) => order.publisher_id));
}

export async function getReviewsForUser(userId: string, limit = 10): Promise<Review[]> {
  const result = await query<Review>("select * from reviews where reviewee_id = $1 order by created_at desc limit $2", [userId, limit]);
  return result.rows;
}

export async function getOrderContact(orderId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return maybeOne<{ profile_id: string; display_name: string; phone: string | null; email: string | null }>(
    `select p.id as profile_id, p.display_name, p.phone, u.email
     from orders o
     join profiles p on p.id = case when o.publisher_id = $2 then o.runner_id else o.publisher_id end
     join app_users u on u.id = p.id
     where o.id = $1 and (o.publisher_id = $2 or o.runner_id = $2) and o.runner_id is not null`,
    [orderId, user.id]
  );
}

export async function getDashboardData(userId: string, campusId: string | null) {
  const [counts, recent] = await Promise.all([
    maybeOne<{ open: number; active: number; waiting: number }>(`select
      (select count(*)::int from orders where status = 'PENDING') as open,
      (select count(*)::int from orders where (publisher_id = $1 or runner_id = $1)
        and status in ('ACCEPTED','IN_PROGRESS','WAITING_CONFIRM')) as active,
      (select count(*)::int from orders where publisher_id = $1 and status = 'WAITING_CONFIRM') as waiting`, [userId]),
    query<Order>(
      campusId
        ? "select * from orders where campus_id = $1 and status = 'PENDING' order by created_at desc limit 4"
        : "select * from orders where status = 'PENDING' order by created_at desc limit 4",
      campusId ? [campusId] : []
    )
  ]);
  return {
    openCount: counts?.open ?? 0,
    myActiveCount: counts?.active ?? 0,
    waitingConfirmCount: counts?.waiting ?? 0,
    recentOrders: recent.rows
  };
}

export async function getAdminDashboard() {
  const [users, orders, reports, completed] = await Promise.all([
    maybeOne<{ count: string }>("select count(*)::text from profiles"),
    maybeOne<{ count: string }>("select count(*)::text from orders"),
    maybeOne<{ count: string }>("select count(*)::text from reports where status = 'OPEN'"),
    maybeOne<{ count: string }>("select count(*)::text from orders where status = 'COMPLETED'")
  ]);
  return {
    users: Number(users?.count ?? 0),
    orders: Number(orders?.count ?? 0),
    openReports: Number(reports?.count ?? 0),
    completed: Number(completed?.count ?? 0)
  };
}

export async function getAdminUsers(status?: string) {
  const result = status && status !== "ALL"
    ? await query<Profile>("select * from profiles where status = $1 order by created_at desc limit 200", [status])
    : await query<Profile>("select * from profiles order by created_at desc limit 200");
  return result.rows;
}

export async function getAdminOrders(status?: string) {
  const result = status && status !== "ALL"
    ? await query<Order>("select * from orders where status = $1 order by created_at desc limit 200", [status])
    : await query<Order>("select * from orders order by created_at desc limit 200");
  return result.rows;
}

export async function getAdminReports(status?: string) {
  const result = status && status !== "ALL"
    ? await query<Report>("select * from reports where status = $1 order by created_at desc limit 200", [status])
    : await query<Report>("select * from reports order by created_at desc limit 200");
  return result.rows;
}

export async function getVerificationQueue() {
  const result = await query<Profile>("select * from profiles where verification_status = 'pending' order by updated_at asc");
  return result.rows;
}

export async function isVerificationApproved(userId: string): Promise<VerificationStatus> {
  const row = await maybeOne<{ verification_status: VerificationStatus }>("select verification_status from profiles where id = $1", [userId]);
  return row?.verification_status ?? "unverified";
}

export async function getOrderReviews(orderId: string): Promise<Review[]> {
  const result = await query<Review>("select * from reviews where order_id = $1 order by created_at asc", [orderId]);
  return result.rows;
}

export async function hasReviewed(orderId: string, reviewerId: string) {
  const row = await maybeOne<{ id: string }>("select id from reviews where order_id = $1 and reviewer_id = $2", [orderId, reviewerId]);
  return Boolean(row);
}
