"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CopyButton({ value, label }: { value: string | null; label: string }) {
  const [state, setState] = useState<"idle" | "success" | "error">("idle");

  async function copyValue() {
    if (!value) {
      setState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setState("success");
      window.setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      window.setTimeout(() => setState("idle"), 2200);
    }
  }

  return (
    <div className="grid gap-1">
      <Button type="button" variant="outline" onClick={copyValue} disabled={!value}>
        <Copy className="size-4" /> {label}
      </Button>
      <span className={`text-xs ${state === "error" ? "text-rose-600" : "text-emerald-600"}`} aria-live="polite">
        {state === "success" ? "已复制" : state === "error" ? "复制失败，请手动复制" : ""}
      </span>
    </div>
  );
}
