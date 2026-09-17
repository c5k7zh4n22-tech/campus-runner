import { DatabaseZap } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <DatabaseZap className="mt-0.5 size-5 shrink-0" />
      <div>
        <strong className="block">Supabase 尚未连接</strong>
        <span>当前页面可浏览，但注册、登录和订单数据要在配置环境变量并执行数据库迁移后才能使用。</span>
      </div>
    </div>
  );
}
