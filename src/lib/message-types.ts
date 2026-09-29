export type MessageCategory = "order" | "system";
export interface ConversationRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  preview: string | null;
  updated_at: string;
  unread: number;
  image_url: string | null;
  context_title: string;
  href: string;
}
export interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}
export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  href: string | null;
  created_at: string;
  read_at: string | null;
}
export interface MessageSummary {
  total: number;
  categories: Array<{ category: MessageCategory; unread: number; preview: string | null; created_at: string | null }>;
}
export interface InboxData {
  conversations: ConversationRow[];
  hasMore: boolean;
  summary: MessageSummary;
}
export interface ThreadData {
  conversation: ConversationRow;
  messages: ChatMessage[];
  hasMore: boolean;
  userId: string;
}
