"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, MessageCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { unreadLabel } from "@/lib/message-validation";
import { createReadReceiptBatcher } from "@/lib/read-receipt-batcher";

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function messageRequest<T>(url = "", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/messages${url}`, {
    method: body ? "POST" : "GET", cache: "no-store", signal,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error || "请求失败，请重试", response.status);
  return data;
}
let unreadTimer: ReturnType<typeof setTimeout> | undefined;
export function updateUnread() {
  clearTimeout(unreadTimer);
  unreadTimer = setTimeout(() => window.dispatchEvent(new Event("messages-updated")), 250);
}
const queueReadReceipt = createReadReceiptBatcher((receipt) => messageRequest("", receipt));

// One in-flight request per view; abort obsolete searches and stop polling hidden tabs.
export function useMessagePolling<T>(loader: (signal: AbortSignal) => Promise<T>, enabled = true, intervalMs = 5000) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    let lastLoaded = 0;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (pending) return;
      clearTimeout(timer);
      if (document.visibilityState !== "visible" || Date.now() - lastLoaded < 750) {
        timer = setTimeout(load, intervalMs);
        return;
      }
      pending = true;
      setBusy(true);
      try {
        const result = await loader(controller.signal);
        if (!controller.signal.aborted) { setData(result); setError(undefined); failures = 0; }
      } catch (cause) {
        if (!controller.signal.aborted) { setError(cause instanceof Error ? cause : new Error("加载失败")); failures++; }
      } finally {
        pending = false;
        lastLoaded = Date.now();
        if (!controller.signal.aborted) setBusy(false);
        if (!controller.signal.aborted) timer = setTimeout(load, Math.min(intervalMs * 2 ** failures, 60000));
      }
    }
    void load();
    function changed() { lastLoaded = 0; void load(); }
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("messages-updated", changed);
    return () => {
      controller.abort(); clearTimeout(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("messages-updated", changed);
    };
  }, [loader, enabled, version, intervalMs]);
  return { data, error, busy, refresh };
}

export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-label={`${count} 条未读消息`} className="absolute -right-1 -top-1 z-10 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-white">{unreadLabel(count)}</span>;
}
export function Avatar({ src, name }: { src: string | null; name: string }) {
  return <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-50 text-lg font-bold text-blue-600">
    {src ? <Image unoptimized src={src} alt="" fill sizes="48px" className="object-cover" /> : name.slice(0, 1)}
  </span>;
}
export function messageTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  return date.toLocaleDateString() === today.toLocaleDateString()
    ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}
export function LoadingMessages() {
  return <div role="status" className="space-y-4 p-5"><span className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />正在加载消息…</span>{[1, 2, 3].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />)}</div>;
}
export function MessageFailure({ error, retry }: { error: Error; retry: () => void }) {
  return <div role="alert" className="m-4 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><p>{error.message}</p>
    {error instanceof RequestError && error.status === 401
      ? <Link href="/login" className="mt-2 inline-flex min-h-11 items-center font-bold text-blue-700">前往登录</Link>
      : <button type="button" onClick={retry} className="mt-2 flex min-h-11 items-center gap-2 font-bold text-blue-700"><RefreshCw className="size-4" />重试</button>}
  </div>;
}
export function NoMessages({ title = "还没有聊天消息", description = "从订单详情联系对方，或在闲置详情咨询卖家。" }: { title?: string; description?: string }) {
  return <div className="px-6 py-14 text-center"><MessageCircle className="mx-auto mb-4 size-10 text-blue-200" /><h2 className="font-bold text-slate-700">{title}</h2><p className="mt-2 text-xs leading-6 text-slate-400">{description}</p></div>;
}

// Read receipts are sent only when the rendered item enters the visible viewport.
export function ReadOnView({ payload, children, className }: { payload?: Record<string, unknown>; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    if (!serialized || !ref.current) return;
    let visible = false, done = false, pending = false, disposed = false;
    async function read() {
      if (!visible || done || pending || document.visibilityState !== "visible") return;
      pending = true;
      try { await queueReadReceipt(JSON.parse(serialized)); done = true; if (!disposed) updateUnread(); }
      catch { /* Keep unread and retry while visible. */ }
      finally { pending = false; }
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; void read(); }, { threshold: 0.5 });
    observer.observe(ref.current);
    const timer = setInterval(read, 5000);
    document.addEventListener("visibilitychange", read);
    return () => { disposed = true; observer.disconnect(); clearInterval(timer); document.removeEventListener("visibilitychange", read); };
  }, [serialized]);
  return <div ref={ref} className={className}>{children}</div>;
}
