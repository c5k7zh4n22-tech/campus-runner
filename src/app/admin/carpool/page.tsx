import { CarpoolPlaceAdmin } from "@/components/carpool/Carpool";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";
export const metadata={title:"同路地点"};
export default async function Page(){await requireAdmin();return <><AdminNav active="/admin/carpool" /><CarpoolPlaceAdmin /></>;}
