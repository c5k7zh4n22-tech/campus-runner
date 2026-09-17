import { describe, expect, it } from "vitest";
import { orderSchema, profileSchema, registerSchema } from "./validation";

describe("input validation", () => {
  it("rejects non-positive rewards", () => {
    const result = orderSchema.safeParse({
      campusId: "00000000-0000-4000-8000-000000000001",
      pickupLocation: "菜鸟驿站",
      deliveryLocation: "6 号宿舍楼下",
      description: "帮我取一个快递",
      reward: 0,
      deadline: new Date(Date.now() + 3600_000).toISOString()
    });
    expect(result.success).toBe(false);
  });

  it("rejects deadlines in the past", () => {
    const result = orderSchema.safeParse({
      campusId: "00000000-0000-4000-8000-000000000001",
      pickupLocation: "菜鸟驿站",
      deliveryLocation: "6 号宿舍楼下",
      description: "帮我取一个快递",
      reward: 8,
      deadline: "2020-01-01T00:00:00.000Z"
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid order input", () => {
    const result = orderSchema.safeParse({
      campusId: "00000000-0000-4000-8000-000000000001",
      pickupLocation: "菜鸟驿站",
      deliveryLocation: "6 号宿舍楼下",
      description: "帮我取一个快递",
      reward: 8,
      deadline: new Date(Date.now() + 3600_000).toISOString()
    });
    expect(result.success).toBe(true);
  });

  it("requires a strong enough registration password", () => {
    expect(registerSchema.safeParse({ displayName: "小林", email: "lin@example.com", password: "123" }).success).toBe(false);
    expect(registerSchema.safeParse({ displayName: "小林", email: "lin@example.com", password: "password123" }).success).toBe(true);
  });

  it("validates profile phone numbers", () => {
    expect(profileSchema.safeParse({
      displayName: "小林",
      campusId: "00000000-0000-4000-8000-000000000001",
      phone: "123",
      studentId: "2026001"
    }).success).toBe(false);
    expect(profileSchema.safeParse({
      displayName: "小林",
      campusId: "00000000-0000-4000-8000-000000000001",
      phone: "13800138000",
      studentId: "2026001"
    }).success).toBe(true);
  });
});
