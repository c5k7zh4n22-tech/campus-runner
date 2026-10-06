import { CarpoolCreate } from "@/components/carpool/Carpool";
import { requireVerifiedProfile } from "@/lib/auth";
import type { TripType } from "@/lib/carpool";
export const metadata={title:"发起拼车"};
export default async function Page({searchParams}:{searchParams:Promise<{type?:string}>}){await requireVerifiedProfile();const {type}=await searchParams;const defaultType:TripType=type==="RIDE_FOUND"?"RIDE_FOUND":"MATCH_FIRST";return <CarpoolCreate defaultType={defaultType} />;}
