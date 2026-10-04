import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { SupportConversation } from "@/components/support/SupportPanel";
export const metadata: Metadata = { title: "售后工单" };
export default async function Page({params}:{params:Promise<{id:string}>}) {
  await requireProfile(); const {id}=await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <SupportConversation key={id} id={id} />;
}
