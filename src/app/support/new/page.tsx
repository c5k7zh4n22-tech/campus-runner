import type { Metadata } from "next";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { SupportCreate } from "@/components/support/SupportPanel";
export const metadata: Metadata = { title: "提交售后问题" };
export default async function Page({searchParams}:{searchParams:Promise<{order?:string}>}) {
  await requireProfile();
  const {order}=await searchParams;
  return <SupportCreate orderId={z.uuid().safeParse(order).success ? order:undefined} />;
}
