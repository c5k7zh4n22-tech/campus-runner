import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { ChatThread } from "@/components/messages/ChatThread";

export const metadata: Metadata = { title: "聊天" };
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <ChatThread key={id} id={id} />;
}
