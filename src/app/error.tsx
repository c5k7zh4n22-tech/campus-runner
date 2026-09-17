"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="size-14 text-rose-500" />
      <h1 className="mt-6 text-3xl font-black">页面暂时无法加载</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">请稍后重试。如果问题持续存在，请检查 Supabase 与服务环境变量。</p>
      <Button type="button" className="mt-6" onClick={reset}>重新加载</Button>
    </div>
  );
}
