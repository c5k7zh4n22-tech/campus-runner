"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Action = (state: ActionResult, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
  confirmMessage
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state.error ? (
        <p className="col-span-full flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="col-span-full flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.success}
        </p>
      ) : null}
      <span className={cn("sr-only", pending && "not-sr-only")} aria-live="polite">
        {pending ? "正在处理" : ""}
      </span>
    </form>
  );
}
