"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { messageRequest } from "./shared";

export function ContactButton({ kind, id }: { kind: "order" | "listing"; id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try { const conversation = await messageRequest<{ id: string }>("", { action: "start", kind, id }); router.push(`/messages/${conversation.id}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "暂时无法联系，请重试"); }
    finally { setBusy(false); }
  }
  return <div className="my-4"><button onClick={start} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50"><MessageCircle className="size-4" />{busy ? "正在打开…" : kind === "order" ? "联系对方" : "咨询卖家"}</button>{error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</div>;
}
