import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <SearchX className="size-14 text-blue-600" />
      <h1 className="mt-6 text-3xl font-black">页面不存在</h1>
      <p className="mt-3 text-sm text-slate-500">你访问的订单或页面可能已被移除。</p>
      <ButtonLink href="/orders" className="mt-6">去跑腿大厅</ButtonLink>
    </div>
  );
}
