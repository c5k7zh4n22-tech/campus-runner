import { Flag, ShieldAlert } from "lucide-react";
import { updateReportAction } from "@/actions/admin";
import { getAdminReports, getPublicProfiles } from "@/lib/data";
import { REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { AdminNav } from "@/components/AdminNav";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const reports = await getAdminReports(params.status);
  const profiles = await getPublicProfiles(reports.flatMap((report) => [report.reporter_id, report.reported_user_id]));

  return (
    <>
      <AdminNav active="/admin/reports" />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="eyebrow">Reports</div><h1 className="page-title mt-3">举报处理</h1><p className="mt-3 text-sm text-slate-500">查看举报详情并记录处理结论。</p></div>
        <form className="flex gap-2"><select className="field min-w-32" name="status" defaultValue={params.status || "ALL"}><option value="ALL">全部状态</option>{Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">筛选</button></form>
      </div>

      <section className="mt-7 space-y-4">
        {reports.map((report) => (
          <article key={report.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-black"><Flag className="size-4 text-rose-500" />{REPORT_REASON_LABELS[report.reason]}</div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{report.details || "无补充说明"}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{REPORT_STATUS_LABELS[report.status]}</span>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
              <span>举报人：{profiles[report.reporter_id]?.display_name || "未知"}</span>
              <span>被举报用户：{report.reported_user_id ? profiles[report.reported_user_id]?.display_name || "未知" : "未指定"}</span>
              <span>举报时间：{formatDateTime(report.created_at)}</span>
              <span>关联订单：{report.order_id ? report.order_id.slice(0, 8).toUpperCase() : "无"}</span>
            </div>
            {report.status !== "CLOSED" ? (
              <ActionForm action={updateReportAction} className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-[180px_1fr_auto] sm:items-start">
                <input type="hidden" name="reportId" value={report.id} />
                <select className="field" name="status" defaultValue={report.status === "OPEN" ? "PROCESSING" : "CLOSED"}><option value="PROCESSING">标记处理中</option><option value="CLOSED">关闭举报</option></select>
                <textarea className="field min-h-11 resize-y" name="note" placeholder="填写处理结论" required />
                <SubmitButton>保存处理</SubmitButton>
              </ActionForm>
            ) : report.resolution_note ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">处理结论：{report.resolution_note}</p> : null}
          </article>
        ))}
        {!reports.length ? <EmptyState icon={ShieldAlert} title="暂无举报" description="用户提交举报后会显示在这里。" /> : null}
      </section>
    </>
  );
}
