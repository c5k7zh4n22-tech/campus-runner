import "server-only";

import { createClient } from "./supabase/server";
import type { Campus, Order, OrderStatus, Profile, PublicProfile, Report, Review, VerificationStatus } from "./types";

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle();
  return (data as Profile | null) ?? null;
}

export async function getCampuses(): Promise<Campus[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("campuses").select("*").eq("is_active", true).order("name");
  return (data as Campus[] | null) ?? [];
}

export async function getOrders(filters?: {
  campusId?: string;
  status?: OrderStatus | "ALL";
  sort?: "newest" | "deadline" | "reward";
  limit?: number;
}): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase.from("orders").select("*");
  if (filters?.campusId) query = query.eq("campus_id", filters.campusId);
  if (filters?.status && filters.status !== "ALL") query = query.eq("status", filters.status);

  if (filters?.sort === "deadline") {
    query = query.order("deadline", { ascending: true });
  } else if (filters?.sort === "reward") {
    query = query.order("reward", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data } = await query.limit(filters?.limit ?? 50);
  return (data as Order[] | null) ?? [];
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  return (data as Order | null) ?? null;
}

export async function getPublicProfiles(ids: Array<string | null | undefined>): Promise<Record<string, PublicProfile>> {
  const supabase = await createClient();
  const cleanIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!supabase || cleanIds.length === 0) return {};

  const { data } = await supabase.from("public_profiles").select("*").in("id", cleanIds);
  return ((data as PublicProfile[] | null) ?? []).reduce<Record<string, PublicProfile>>((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});
}

export async function getMyOrders(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("orders")
    .select("*")
    .or(`publisher_id.eq.${userId},runner_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as Order[] | null) ?? [];
}

export async function getOrderPublishers(orders: Order[]) {
  return getPublicProfiles(orders.map((order) => order.publisher_id));
}

export async function getReviewsForUser(userId: string, limit = 10): Promise<Review[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as Review[] | null) ?? [];
}

export async function getOrderContact(orderId: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("get_order_contact", { p_order_id: orderId });
  return (data as Array<{ profile_id: string; display_name: string; phone: string | null; email: string | null }> | null)?.[0] ?? null;
}

export async function getDashboardData(userId: string, campusId: string | null) {
  const supabase = await createClient();
  if (!supabase) {
    return { openCount: 0, myActiveCount: 0, waitingConfirmCount: 0, recentOrders: [] as Order[] };
  }

  const openQuery = supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "PENDING");
  const activeQuery = supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .or(`publisher_id.eq.${userId},runner_id.eq.${userId}`)
    .in("status", ["ACCEPTED", "IN_PROGRESS", "WAITING_CONFIRM"]);
  const waitingQuery = supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("publisher_id", userId)
    .eq("status", "WAITING_CONFIRM");

  let recentQuery = supabase.from("orders").select("*").eq("status", "PENDING").order("created_at", { ascending: false }).limit(4);
  if (campusId) {
    recentQuery = supabase.from("orders").select("*").eq("campus_id", campusId).eq("status", "PENDING").order("created_at", { ascending: false }).limit(4);
  }

  const [openResult, activeResult, waitingResult, recentResult] = await Promise.all([
    openQuery,
    activeQuery,
    waitingQuery,
    recentQuery
  ]);

  return {
    openCount: openResult.count ?? 0,
    myActiveCount: activeResult.count ?? 0,
    waitingConfirmCount: waitingResult.count ?? 0,
    recentOrders: (recentResult.data as Order[] | null) ?? []
  };
}

export async function getAdminDashboard() {
  const supabase = await createClient();
  if (!supabase) return { users: 0, orders: 0, openReports: 0, completed: 0 };
  const [users, orders, reports, completed] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "OPEN"),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "COMPLETED")
  ]);
  return {
    users: users.count ?? 0,
    orders: orders.count ?? 0,
    openReports: reports.count ?? 0,
    completed: completed.count ?? 0
  };
}

export async function getAdminUsers(status?: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "ALL") query = query.eq("status", status);
  const { data } = await query;
  return (data as Profile[] | null) ?? [];
}

export async function getAdminOrders(status?: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "ALL") query = query.eq("status", status);
  const { data } = await query;
  return (data as Order[] | null) ?? [];
}

export async function getAdminReports(status?: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "ALL") query = query.eq("status", status);
  const { data } = await query;
  return (data as Report[] | null) ?? [];
}

export async function getVerificationQueue() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("verification_status", "pending")
    .order("updated_at", { ascending: true });
  return (data as Profile[] | null) ?? [];
}

export async function isVerificationApproved(userId: string): Promise<VerificationStatus> {
  const supabase = await createClient();
  if (!supabase) return "unverified";
  const { data } = await supabase.from("profiles").select("verification_status").eq("id", userId).maybeSingle();
  return (data?.verification_status as VerificationStatus | undefined) ?? "unverified";
}


export async function getOrderReviews(orderId: string): Promise<Review[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  return (data as Review[] | null) ?? [];
}

export async function hasReviewed(orderId: string, reviewerId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_id", orderId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle();
  return Boolean(data);
}
