import { CarpoolCreate } from "@/components/carpool/Carpool";
import { requireVerifiedProfile } from "@/lib/auth";
import type { TripType } from "@/lib/carpool";
export const metadata={title:"发布同路信息"};
export default async function Page(){await requireVerifiedProfile();const defaultType:TripType="MATCH_FIRST";return <CarpoolCreate defaultType={defaultType} />;}
