import { CarpoolHall } from "@/components/carpool/Carpool";
import { requireProfile } from "@/lib/auth";
export const metadata={title:"我的结伴"};
export default async function Page(){await requireProfile();return <CarpoolHall mine />;}
