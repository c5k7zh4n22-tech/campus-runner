import { AdminNav } from "@/components/AdminNav";
import { AnnouncementForm } from "@/components/messages/AnnouncementForm";
export default function AnnouncementsPage() {
  return <><AdminNav active="/admin/announcements" /><h1 className="page-title">平台公告</h1><p className="mt-3 text-sm text-slate-500">公告将发送到每位正常状态用户的系统通知。</p><AnnouncementForm /></>;
}
