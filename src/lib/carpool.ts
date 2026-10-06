import { z } from "zod";

export const TRIP_STATUS = { OPEN: "招募中", FULL: "已满员", EXPIRED: "已过期", DEPARTED: "已出发", COMPLETED: "已结束", CANCELLED: "已取消" };
export const MEMBER_STATUS = { PENDING: "待确认", PAYMENT_PENDING: "待支付", APPROVED: "已加入", REJECTED: "未通过", LEFT: "已退出" };
export const GENDER_PREFERENCE = { ANY: "不限", MALE: "仅男生", FEMALE: "仅女生" };
export type GenderPreference = keyof typeof GENDER_PREFERENCE;
export interface CarpoolPlace { id: string; name: string; active: boolean }
export interface CarpoolTrip {
  id: string; owner_id: string; origin: string; destination: string; origin_id: string; destination_id: string;
  departure_start: string; departure_end: string; capacity: number; occupied: number; luggage: string; gender_preference: GenderPreference;
  status: "OPEN"|"DEPARTED"|"COMPLETED"|"CANCELLED"; display_status: keyof typeof TRIP_STATUS;
  version: number; host_name: string; my_status: keyof typeof MEMBER_STATUS|null; my_size: number|null;
}
export interface CarpoolMember { user_id: string; name: string; party_size: number; status: keyof typeof MEMBER_STATUS }
export interface CarpoolDetail { trip: CarpoolTrip; meeting: string|null; members: CarpoolMember[]; isOwner: boolean; canChat: boolean; canDepart: boolean; verified: boolean }
export interface CarpoolMessage { id: string; sender_id: string; name: string; body: string; created_at: string }
export class CarpoolError extends Error { constructor(message: string, public status=400){super(message);} }
const uuid=z.uuid();
const integerId=z.string().regex(/^[1-9]\d{0,17}$/);
const date=z.string().datetime({offset:true});
const genderPreference=z.enum(["ANY","MALE","FEMALE"]);
export const carpoolQuery=z.object({view:z.enum(["list","detail","chat","places"]).default("list"),id:uuid.optional(),mine:z.enum(["true","false"]).default("false"),origin:uuid.optional(),destination:uuid.optional(),originText:z.string().trim().max(80).optional(),destinationText:z.string().trim().max(80).optional(),gender:genderPreference.optional(),from:date.optional(),to:date.optional(),page:z.coerce.number().int().min(0).max(10000).default(0),before:integerId.optional(),after:integerId.optional()})
  .refine(v=>!["detail","chat"].includes(v.view)||Boolean(v.id)).refine(v=>!(v.before&&v.after)).refine(v=>!v.from||!v.to||Date.parse(v.from)<Date.parse(v.to));
export const carpoolMutation=z.discriminatedUnion("action",[
  z.object({action:z.literal("create"),genderPreference:genderPreference.optional(),genderConfirmed:z.boolean().optional(),originId:uuid.optional(),destinationId:uuid.optional(),originName:z.string().trim().min(2).max(80).optional(),destinationName:z.string().trim().min(2).max(80).optional(),start:date,end:date,capacity:z.number().int().min(2).max(6),partySize:z.number().int().min(1).max(6),luggage:z.string().trim().max(200),meeting:z.string().trim().min(2).max(500),clientId:uuid}).refine(v=>Boolean(v.originId)!==Boolean(v.originName)&&Boolean(v.destinationId)!==Boolean(v.destinationName),{message:"请填写出发地与目的地"}),
  z.object({action:z.literal("apply"),genderConfirmed:z.boolean().optional(),id:uuid,partySize:z.number().int().min(1).max(6)}),
  z.object({action:z.literal("respond"),id:uuid,userId:uuid,accept:z.boolean()}),
  z.object({action:z.literal("pay"),id:uuid}),
  z.object({action:z.literal("leave"),id:uuid}),
  z.object({action:z.literal("state"),id:uuid,state:z.enum(["DEPARTED","COMPLETED","CANCELLED"]),version:z.number().int().positive()}),
  z.object({action:z.literal("meeting"),id:uuid,meeting:z.string().trim().min(2).max(500),version:z.number().int().positive()}),
  z.object({action:z.literal("send"),id:uuid,body:z.string().trim().min(1).max(2000),clientId:uuid}),
  z.object({action:z.literal("read"),id:uuid,through:integerId}),
  z.object({action:z.literal("place"),id:uuid.optional(),name:z.string().trim().min(2).max(80),active:z.boolean()})
]);
export type CarpoolMutation=z.infer<typeof carpoolMutation>;
export function maskCarpoolName(name:string){return `${Array.from(name)[0]||"同"}同学`;}
