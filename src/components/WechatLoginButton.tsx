import Link from "next/link";
import { MessageCircleMore } from "lucide-react";

export function WechatLoginButton({
  configured,
  inWechat,
  next = "/",
  mode = "login"
}: {
  configured: boolean;
  inWechat: boolean;
  next?: string;
  mode?: "login" | "register";
}) {
  const label = mode === "register" ? "微信一键授权 / 注册" : "微信一键授权";

  if (!configured) {
    return (
      <div className="grid gap-2">
        <button type="button" disabled className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#07c160]/55 px-4 text-sm font-bold text-white">
          <MessageCircleMore className="size-5" /> {label}
        </button>
        <p className="text-center text-xs text-amber-700">微信授权正在配置中，请先使用邮箱密码</p>
      </div>
    );
  }

  if (!inWechat) {
    return (
      <div className="grid gap-2">
        <button type="button" disabled className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#07c160]/55 px-4 text-sm font-bold text-white">
          <MessageCircleMore className="size-5" /> {label}
        </button>
        <p className="text-center text-xs text-amber-700">请在微信内打开本页面后使用一键授权</p>
      </div>
    );
  }

  return (
    <Link
      href={`/api/auth/wechat/start?next=${encodeURIComponent(next)}`}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07c160] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#06ad56] active:scale-[0.99]"
    >
      <MessageCircleMore className="size-5" /> {label}
    </Link>
  );
}
