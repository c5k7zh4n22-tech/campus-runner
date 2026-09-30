"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type InviteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "valid"; code: string; maskedName: string; campusName: string }
  | { status: "invalid"; message: string };

function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase();
}

export function RegisterInviteField({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<InviteState>(initialCode ? { status: "loading" } : { status: "idle" });
  const normalizedCode = useMemo(() => normalizeInviteCode(code), [code]);
  const confirmedCode = state.status === "valid" ? state.code : "";

  async function validateInvite(value = normalizedCode) {
    const nextCode = normalizeInviteCode(value);
    if (!nextCode) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await fetch("/api/invitations/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: nextCode })
      });
      const payload = await response.json() as {
        ok?: boolean;
        message?: string;
        invitation?: { code: string; maskedName: string; campusName: string };
      };

      if (!response.ok || !payload.ok || !payload.invitation) {
        setState({ status: "invalid", message: payload.message || "邀请码无效或暂不可用" });
        return;
      }

      setCode(payload.invitation.code);
      setState({
        status: "valid",
        code: payload.invitation.code,
        maskedName: payload.invitation.maskedName,
        campusName: payload.invitation.campusName
      });
    } catch {
      setState({ status: "invalid", message: "邀请码校验失败，请稍后再试" });
    }
  }

  useEffect(() => {
    if (!initialCode) return;
    const timer = window.setTimeout(() => {
      void validateInvite(initialCode);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <div className="grid gap-2">
      <input type="hidden" name="inviteConfirmedCode" value={confirmedCode} />
      <label className="label">
        邀请码（选填）
        <div className="flex gap-2">
          <input
            className="field"
            name="inviteCode"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setState({ status: event.target.value.trim() ? "idle" : "idle" });
            }}
            placeholder="输入短码或 12 位学号"
            autoComplete="off"
            inputMode="text"
          />
          <Button type="button" variant="outline" className="shrink-0 px-3" onClick={() => validateInvite()} disabled={!normalizedCode || state.status === "loading"}>
            {state.status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "校验"}
          </Button>
        </div>
      </label>

      {state.status === "valid" ? (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> 邀请人：{state.maskedName} · {state.campusName}</span>
          <button
            type="button"
            className="shrink-0 text-xs font-bold text-emerald-800"
            onClick={() => {
              setCode("");
              setState({ status: "idle" });
            }}
          >
            清除
          </button>
        </div>
      ) : null}

      {state.status === "invalid" ? (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <span className="flex items-start gap-2"><XCircle className="mt-0.5 size-4 shrink-0" /> {state.message}</span>
          <button
            type="button"
            className="shrink-0 text-xs font-bold text-rose-800"
            onClick={() => {
              setCode("");
              setState({ status: "idle" });
            }}
          >
            清除
          </button>
        </div>
      ) : null}

      <p className="text-xs leading-5 text-slate-400">邀请码需要先校验确认；也可以留空直接注册。</p>
    </div>
  );
}
