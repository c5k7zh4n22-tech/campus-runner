import { CarpoolCreate } from "@/components/carpool/Carpool";
import { requireVerifiedProfile } from "@/lib/auth";
export const metadata={title:"发起拼车"};
export default async function Page(){await requireVerifiedProfile();return <CarpoolCreate />;}
