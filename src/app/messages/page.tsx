import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { MessageCenter } from "@/components/messages/MessageCenter";

export const metadata: Metadata = { title: "消息中心" };
export default async function MessagesPage() {
  await requireProfile();
  return <MessageCenter />;
}
