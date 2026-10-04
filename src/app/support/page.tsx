import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { SupportHome } from "@/components/support/SupportPanel";
export const metadata: Metadata = { title: "客服与售后" };
export default async function Page() { await requireProfile(); return <SupportHome />; }
