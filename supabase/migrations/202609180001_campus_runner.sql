-- Campus Runner MVP schema
-- Run this migration in Supabase SQL Editor or with: supabase db push

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'suspended', 'banned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_status as enum ('OPEN', 'PROCESSING', 'CLOSED');
exception when duplicate_object then null; end $$;

create table if not exists public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.campuses (name, slug, city)
values
  ('香港大学', 'hku', '香港'),
  ('香港中文大学', 'cuhk', '香港'),
  ('香港科技大学', 'hkust', '香港'),
  ('深圳大学', 'szu', '深圳'),
  ('中山大学', 'sysu', '广州')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 30),
  avatar_url text,
  phone text,
  student_id text,
  verification_status public.verification_status not null default 'unverified',
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  rating numeric(3,2) not null default 5.00 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.profiles(id) on delete restrict,
  runner_id uuid references public.profiles(id) on delete set null,
  campus_id uuid not null references public.campuses(id) on delete restrict,
  pickup_location text not null,
  delivery_location text not null,
  description text not null,
  reward numeric(10,2) not null check (reward > 0 and reward <= 9999),
  deadline timestamptz not null,
  status public.order_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  check (runner_id is null or runner_id <> publisher_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('fake_order', 'malicious_cancel', 'fraud', 'rude_behavior', 'other')),
  details text, 
  status public.report_status not null default 'OPEN',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (order_id is not null or reported_user_id is not null)
);

create index if not exists orders_hall_idx on public.orders (campus_id, status, created_at desc);
create index if not exists orders_publisher_idx on public.orders (publisher_id, created_at desc);
create index if not exists orders_runner_idx on public.orders (runner_id, created_at desc);
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, campus_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, '新用户'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'campus_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.verification_status is distinct from old.verification_status
     or new.rating is distinct from old.rating
     or new.review_count is distinct from old.review_count then
    raise exception '无权修改该资料字段';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

create or replace function public.create_order(
  p_campus_id uuid,
  p_pickup_location text,
  p_delivery_location text,
  p_description text,
  p_reward numeric,
  p_deadline timestamptz
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception '请先登录';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.status <> 'active' then
    raise exception '账号不可用';
  end if;

  if v_profile.campus_id is null or v_profile.campus_id <> p_campus_id then
    raise exception '只能在与个人资料一致的校园发布订单';
  end if;

  if trim(coalesce(p_pickup_location, '')) = '' or trim(coalesce(p_delivery_location, '')) = '' then
    raise exception '取货地点和送达地点不能为空';
  end if;

  if trim(coalesce(p_description, '')) = '' then
    raise exception '跑腿描述不能为空';
  end if;

  if p_reward is null or p_reward <= 0 then
    raise exception '跑腿费必须大于 0';
  end if;

  if p_deadline is null or p_deadline <= now() then
    raise exception '截止时间必须晚于当前时间';
  end if;

  insert into public.orders (
    publisher_id, campus_id, pickup_location, delivery_location,
    description, reward, deadline, status
  )
  values (
    v_user_id, p_campus_id, trim(p_pickup_location), trim(p_delivery_location),
    trim(p_description), p_reward, p_deadline, 'PENDING'
  )
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.accept_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception '请先登录';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.status <> 'active' then
    raise exception '账号不可用';
  end if;

  if v_profile.verification_status <> 'verified' then
    raise exception '请先完成校园身份认证';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception '订单不存在';
  end if;

  if v_order.publisher_id = v_user_id then
    raise exception '不能接取自己发布的订单';
  end if;

  if v_order.status <> 'PENDING' or v_order.runner_id is not null then
    raise exception '订单已被接取或已失效';
  end if;

  if v_order.deadline <= now() then
    raise exception '订单已过期';
  end if;

  update public.orders
  set runner_id = v_user_id, status = 'ACCEPTED', accepted_at = now()
  where id = p_order_id
    and status = 'PENDING'
    and runner_id is null
    and deadline > now()
  returning * into v_order;

  if not found then
    raise exception '订单已被其他用户接走';
  end if;

  return v_order;
end;
$$;

create or replace function public.transition_order(p_order_id uuid, p_action text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
  v_new_status public.order_status;
begin
  if v_user_id is null then
    raise exception '请先登录';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception '订单不存在';
  end if;

  case p_action
    when 'start' then
      if v_order.runner_id <> v_user_id then raise exception '只有跑腿员可以开始任务'; end if;
      if v_order.status <> 'ACCEPTED' then raise exception '当前订单不能开始'; end if;
      v_new_status := 'IN_PROGRESS';
    when 'submit' then
      if v_order.runner_id <> v_user_id then raise exception '只有跑腿员可以提交完成'; end if;
      if v_order.status <> 'IN_PROGRESS' then raise exception '当前订单不能提交完成'; end if;
      v_new_status := 'WAITING_CONFIRM';
    when 'confirm' then
      if v_order.publisher_id <> v_user_id then raise exception '只有发布者可以确认完成'; end if;
      if v_order.status <> 'WAITING_CONFIRM' then raise exception '当前订单不能确认完成'; end if;
      v_new_status := 'COMPLETED';
    when 'return_to_progress' then
      if v_order.publisher_id <> v_user_id then raise exception '只有发布者可以退回任务'; end if;
      if v_order.status <> 'WAITING_CONFIRM' then raise exception '当前订单不能退回'; end if;
      v_new_status := 'IN_PROGRESS';
    when 'cancel_pending' then
      if v_order.publisher_id <> v_user_id then raise exception '只有发布者可以取消订单'; end if;
      if v_order.status <> 'PENDING' then raise exception '当前订单不能取消'; end if;
      v_new_status := 'CANCELLED';
    when 'cancel_active' then
      if v_order.publisher_id <> v_user_id and v_order.runner_id <> v_user_id then
        raise exception '只有订单参与者可以取消订单';
      end if;
      if v_order.status not in ('ACCEPTED', 'IN_PROGRESS') then raise exception '当前订单不能取消'; end if;
      v_new_status := 'CANCELLED';
    else
      raise exception '不支持的订单操作';
  end case;

  update public.orders
  set
    status = v_new_status,
    started_at = case when v_new_status = 'IN_PROGRESS' and v_order.started_at is null then now() else started_at end,
    completed_at = case when v_new_status = 'COMPLETED' then now() else completed_at end,
    cancelled_at = case when v_new_status = 'CANCELLED' then now() else cancelled_at end,
    cancel_reason = case when v_new_status = 'CANCELLED' then p_action else cancel_reason end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.get_order_contact(p_order_id uuid)
returns table (profile_id uuid, display_name text, phone text, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders;
begin
  if v_user_id is null then
    raise exception '请先登录';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception '订单不存在'; end if;
  if v_user_id <> v_order.publisher_id and v_user_id <> v_order.runner_id then
    raise exception '无权查看联系方式';
  end if;
  if v_order.status not in ('ACCEPTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'COMPLETED') then
    raise exception '订单尚未建立联系关系';
  end if;

  return query
  select p.id, p.display_name, p.phone, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id in (v_order.publisher_id, v_order.runner_id)
    and p.id <> v_user_id;
end;
$$;

create or replace function public.submit_verification(p_student_id text, p_phone text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_user_id is null then raise exception '请先登录'; end if;
  if trim(coalesce(p_student_id, '')) = '' then raise exception '学号不能为空'; end if;
  if p_phone !~ '^1[3-9][0-9]{9}$' then raise exception '手机号格式不正确'; end if;

  update public.profiles
  set student_id = trim(p_student_id), phone = p_phone, verification_status = 'pending'
  where id = v_user_id and status = 'active'
  returning * into v_profile;

  if not found then raise exception '资料不存在或账号不可用'; end if;
  return v_profile;
end;
$$;

create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.user_status)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception '无管理员权限'; end if;
  if p_user_id = auth.uid() then raise exception '不能修改自己的管理员状态'; end if;

  update public.profiles set status = p_status where id = p_user_id returning * into v_profile;
  if not found then raise exception '用户不存在'; end if;
  return v_profile;
end;
$$;

create or replace function public.admin_review_verification(
  p_user_id uuid,
  p_status public.verification_status
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then raise exception '无管理员权限'; end if;
  if p_status not in ('verified', 'rejected', 'unverified') then
    raise exception '认证状态不合法';
  end if;

  update public.profiles
  set verification_status = p_status
  where id = p_user_id
  returning * into v_profile;

  if not found then raise exception '用户不存在'; end if;
  return v_profile;
end;
$$;

create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then raise exception '无管理员权限'; end if;

  update public.orders
  set status = 'CANCELLED', cancelled_at = now(), cancel_reason = coalesce(nullif(trim(p_reason), ''), '管理员处理')
  where id = p_order_id and status not in ('COMPLETED', 'CANCELLED')
  returning * into v_order;

  if not found then raise exception '订单不存在或当前状态不能取消'; end if;
  return v_order;
end;
$$;

create or replace function public.admin_update_report(
  p_report_id uuid,
  p_status public.report_status,
  p_note text
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
begin
  if not public.is_admin() then raise exception '无管理员权限'; end if;

  update public.reports
  set status = p_status,
      resolution_note = nullif(trim(p_note), ''),
      resolved_by = auth.uid(),
      resolved_at = case when p_status = 'CLOSED' then now() else resolved_at end
  where id = p_report_id
  returning * into v_report;

  if not found then raise exception '举报不存在'; end if;
  return v_report;
end;
$$;

create or replace function public.recalculate_profile_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = new.reviewee_id), 5.00),
    review_count = (select count(*) from public.reviews where reviewee_id = new.reviewee_id)
  where id = new.reviewee_id;
  return new;
end;
$$;

drop trigger if exists on_review_created on public.reviews;
create trigger on_review_created
after insert on public.reviews
for each row execute function public.recalculate_profile_rating();

-- Public profile projection: excludes phone, student ID, status, and email.
create or replace view public.public_profiles
with (security_barrier = true)
as
select id, campus_id, display_name, avatar_url, verification_status, role, rating, review_count, created_at
from public.profiles;

alter view public.public_profiles set (security_invoker = false);

-- Row Level Security
alter table public.campuses enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

drop policy if exists "campuses_are_public" on public.campuses;
create policy "campuses_are_public" on public.campuses
for select using (is_active = true);

drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "orders_are_public" on public.orders;
create policy "orders_are_public" on public.orders
for select using (true);

drop policy if exists "reviews_are_public" on public.reviews;
create policy "reviews_are_public" on public.reviews
for select using (true);

drop policy if exists "reviews_insert_participants" on public.reviews;
create policy "reviews_insert_participants" on public.reviews
for insert with check (
  auth.uid() = reviewer_id
  and exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.status = 'COMPLETED'
      and (
        (o.publisher_id = auth.uid() and o.runner_id = reviewee_id)
        or (o.runner_id = auth.uid() and o.publisher_id = reviewee_id)
      )
  )
);

drop policy if exists "reports_read_own_or_admin" on public.reports;
create policy "reports_read_own_or_admin" on public.reports
for select using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
for insert with check (reporter_id = auth.uid());

-- Keep direct mutations behind trusted functions.
revoke insert, update, delete on public.orders from anon, authenticated;
revoke update, delete on public.reviews from anon, authenticated;
revoke update, delete on public.reports from anon, authenticated;
revoke insert, update, delete on public.campuses from anon, authenticated;

grant select on public.campuses to anon, authenticated;
grant select on public.orders to anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, campus_id) on public.profiles to authenticated;
grant insert on public.reports to authenticated;
grant usage on schema public to anon, authenticated;

revoke all on function public.create_order(uuid, text, text, text, numeric, timestamptz) from public;
revoke all on function public.accept_order(uuid) from public;
revoke all on function public.transition_order(uuid, text) from public;
revoke all on function public.get_order_contact(uuid) from public;
revoke all on function public.submit_verification(text, text) from public;
revoke all on function public.admin_set_user_status(uuid, public.user_status) from public;
revoke all on function public.admin_review_verification(uuid, public.verification_status) from public;
revoke all on function public.admin_cancel_order(uuid, text) from public;
revoke all on function public.admin_update_report(uuid, public.report_status, text) from public;

grant execute on function public.create_order(uuid, text, text, text, numeric, timestamptz) to authenticated;
grant execute on function public.accept_order(uuid) to authenticated;
grant execute on function public.transition_order(uuid, text) to authenticated;
grant execute on function public.get_order_contact(uuid) to authenticated;
grant execute on function public.submit_verification(text, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, public.user_status) to authenticated;
grant execute on function public.admin_review_verification(uuid, public.verification_status) to authenticated;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;
grant execute on function public.admin_update_report(uuid, public.report_status, text) to authenticated;

-- Avatar storage (public read; users may only write inside their own folder).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar_public_read" on storage.objects;
create policy "avatar_public_read" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "avatar_insert_own_folder" on storage.objects;
create policy "avatar_insert_own_folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_update_own_folder" on storage.objects;
create policy "avatar_update_own_folder" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_delete_own_folder" on storage.objects;
create policy "avatar_delete_own_folder" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Promote the first administrator manually after registration:
-- update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';
