import { CarpoolTripDetail } from "@/components/carpool/Carpool";
import { requireProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { z } from "zod";
export const metadata={title:"同路结伴"};
export default async function Page({params}:{params:Promise<{id:string}>}){await requireProfile();const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();return <CarpoolTripDetail key={id} id={id}/>;}
