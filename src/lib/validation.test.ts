import { describe, expect, it } from "vitest";
import { listingSchema, orderSchema, profileSchema, registerSchema, verificationSchema } from "./validation";

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
    expect(registerSchema.safeParse({ displayName: "小林", email: "lin@example.com", password: "password123", inviteCode: "ABCD2345", inviteConfirmedCode: "ABCD2345" }).success).toBe(true);
  });

  it("requires both a 12-digit student ID and a valid phone number", () => {
    expect(verificationSchema.safeParse({ studentId: "2026001", phone: "13800138000" }).success).toBe(false);
    expect(verificationSchema.safeParse({ studentId: "202600000001", phone: "" }).success).toBe(false);
    expect(verificationSchema.safeParse({ studentId: "202600000001", phone: "123" }).success).toBe(false);
    expect(verificationSchema.safeParse({ studentId: "202600000001", phone: "13800138000" }).success).toBe(true);
  });


  it("allows zero-priced offline listings but requires a positive platform listing price", () => {
    const baseListing = {
      title: "闲置教材",
      description: "教材保存完好，可在校内自取",
      price: 0,
      category: "books",
      itemCondition: "good"
    };

    expect(listingSchema.safeParse({ ...baseListing, tradeMode: "OFFLINE" }).success).toBe(true);
    expect(listingSchema.safeParse({ ...baseListing, tradeMode: "PLATFORM" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...baseListing, price: 10, tradeMode: "PLATFORM" }).success).toBe(true);
  });

  it("keeps the profile form limited to the single active campus", () => {
    expect(profileSchema.safeParse({
      displayName: "小林",
      campusId: "00000000-0000-4000-8000-000000000001"
    }).success).toBe(true);
  });
});
