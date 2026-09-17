import { ShieldX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-rose-50 text-rose-600"><ShieldX className="size-8" /></div>
      <h1 className="mt-6 text-3xl font-black">没有访问权限</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">该页面仅限管理员访问，权限会在服务端再次验证。</p>
      <ButtonLink href="/" className="mt-6">返回首页</ButtonLink>
    </div>
  );
}
