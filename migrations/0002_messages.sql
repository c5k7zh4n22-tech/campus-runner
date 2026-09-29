create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references profiles(id) on delete cascade,
  member_b uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  listing_id uuid references marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (member_a < member_b),
  check (num_nonnulls(order_id, listing_id) = 1)
);
create unique index if not exists conversations_order_pair on conversations(member_a, member_b, order_id) where order_id is not null;
create unique index if not exists conversations_listing_pair on conversations(member_a, member_b, listing_id) where listing_id is not null;
create index if not exists conversations_a_updated on conversations(member_a, updated_at desc, id);
create index if not exists conversations_b_updated on conversations(member_b, updated_at desc, id);

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (sender_id, client_id)
);
create index if not exists chat_messages_conversation_id on chat_messages(conversation_id, id desc);
create index if not exists chat_messages_unread on chat_messages(conversation_id, sender_id) where read_at is null;

create table if not exists notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references profiles(id) on delete cascade,
  category text not null check (category in ('order', 'system')),
  title text not null,
  body text not null,
  href text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_recipient_category on notifications(recipient_id, category, id desc);
create index if not exists notifications_unread on notifications(recipient_id) where read_at is null;

-- These triggers keep notifications atomic with the business state change,
-- including changes made by existing admin and order service code.
create or replace function notify_order_status() returns trigger language plpgsql as $$
declare label text;
begin
  if new.status is not distinct from old.status then return new; end if;
  label := case new.status
    when 'ACCEPTED' then '订单已接单'
    when 'IN_PROGRESS' then '跑腿正在配送 / 处理中'
    when 'WAITING_CONFIRM' then '跑腿已提交，请确认完成'
    when 'COMPLETED' then '订单已确认完成'
    when 'CANCELLED' then '订单已取消'
    else '订单状态更新' end;
  insert into notifications(recipient_id, category, title, body, href)
  select distinct recipient, 'order', label, new.description, '/orders/' || new.id
  from unnest(array[new.publisher_id, new.runner_id]) as recipient where recipient is not null;
  return new;
end $$;
drop trigger if exists orders_notify_status on orders;
create trigger orders_notify_status after update of status on orders for each row execute function notify_order_status();

create or replace function notify_verification_result() returns trigger language plpgsql as $$
begin
  if new.verification_status is distinct from old.verification_status
     and new.verification_status in ('verified', 'rejected') then
    insert into notifications(recipient_id, category, title, body, href)
    values (new.id, 'system', '校园认证审核结果',
      case when new.verification_status = 'verified' then '你的校园认证已通过，可以开始接单了。'
      else '你的校园认证未通过，请检查资料并重新提交。' end, '/profile');
  end if;
  return new;
end $$;
drop trigger if exists profiles_notify_verification on profiles;
create trigger profiles_notify_verification after update of verification_status on profiles for each row execute function notify_verification_result();
