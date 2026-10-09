import { CarpoolHall } from "@/components/carpool/Carpool";
import { requireProfile } from "@/lib/auth";
export const metadata={title:"同路结伴"};
export default async function Page(){await requireProfile();return <CarpoolHall />;}
