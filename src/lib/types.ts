export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "banned";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type OrderStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "WAITING_CONFIRM" | "COMPLETED" | "CANCELLED";
export type ReportStatus = "OPEN" | "PROCESSING" | "CLOSED";

export interface Campus {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  campus_id: string | null;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  student_id: string | null;
  verification_status: VerificationStatus;
  role: UserRole;
  status: UserStatus;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  campus_id: string | null;
  display_name: string;
  avatar_url: string | null;
  verification_status: VerificationStatus;
  role: UserRole;
  rating: number;
  review_count: number;
  created_at: string;
}

export interface Order {
  id: string;
  publisher_id: string;
  runner_id: string | null;
  campus_id: string;
  pickup_location: string;
  delivery_location: string;
  description: string;
  reward: number;
  deadline: string;
  status: OrderStatus;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  order_id: string | null;
  reported_user_id: string | null;
  reason: "fake_order" | "malicious_cancel" | "fraud" | "rude_behavior" | "other";
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type ActionResult = {
  error?: string;
  success?: string;
};

export type ListingStatus = "ACTIVE" | "RESERVED" | "SOLD" | "REMOVED";
export type ListingInterestStatus = "REQUESTED" | "ACCEPTED" | "DECLINED";
export type ListingCategory = "books" | "electronics" | "daily" | "clothing" | "sports" | "tickets" | "other";
export type ListingCondition = "new" | "like_new" | "good" | "fair";

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  campus_id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  item_condition: ListingCondition;
  image_url: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
  removed_at: string | null;
}

export interface MarketplaceInterest {
  id: string;
  listing_id: string;
  buyer_id: string;
  message: string | null;
  status: ListingInterestStatus;
  created_at: string;
  updated_at: string;
}
