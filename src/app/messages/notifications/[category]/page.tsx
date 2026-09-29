import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { NotificationFeed } from "@/components/messages/NotificationFeed";

export const metadata: Metadata = { title: "通知" };
export default async function NotificationsPage({ params }: { params: Promise<{ category: string }> }) {
  await requireProfile();
  const { category } = await params;
  if (category !== "order" && category !== "system") notFound();
  return <NotificationFeed key={category} category={category} />;
}
