-- Campus marketplace for buying and selling second-hand items.
do $$ begin
  create type public.listing_status as enum ('ACTIVE', 'RESERVED', 'SOLD', 'REMOVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.listing_interest_status as enum ('REQUESTED', 'ACCEPTED', 'DECLINED');
exception when duplicate_object then null; end $$;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid references public.profiles(id) on delete set null,
  campus_id uuid not null references public.campuses(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 5 and 1500),
  price numeric(10,2) not null check (price >= 0 and price <= 99999),
  category text not null check (category in ('books', 'electronics', 'daily', 'clothing', 'sports', 'tickets', 'other')),
  item_condition text not null check (item_condition in ('new', 'like_new', 'good', 'fair')),
  image_url text,
  status public.listing_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  removed_at timestamptz,
  check (buyer_id is null or buyer_id <> seller_id)
);

create table if not exists public.marketplace_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status public.listing_interest_status not null default 'REQUESTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index if not exists marketplace_listings_hall_idx on public.marketplace_listings (campus_id, status, created_at desc);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings (seller_id, created_at desc);
create index if not exists marketplace_interests_listing_idx on public.marketplace_interests (listing_id, created_at desc);
create index if not exists marketplace_interests_buyer_idx on public.marketplace_interests (buyer_id, created_at desc);
create unique index if not exists marketplace_interests_one_accepted_idx
on public.marketplace_interests (listing_id)
where status = 'ACCEPTED';

drop trigger if exists marketplace_listings_set_updated_at on public.marketplace_listings;
create trigger marketplace_listings_set_updated_at
before update on public.marketplace_listings
for each row execute function public.set_updated_at();

drop trigger if exists marketplace_interests_set_updated_at on public.marketplace_interests;
create trigger marketplace_interests_set_updated_at
before update on public.marketplace_interests
for each row execute function public.set_updated_at();

create or replace function public.create_marketplace_listing(
  p_title text,
  p_description text,
  p_price numeric,
  p_category text,
  p_item_condition text,
  p_image_url text default null
)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_listing public.marketplace_listings;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.status <> 'active' then raise exception '账号不可用'; end if;
  if v_profile.verification_status <> 'verified' then raise exception '请先完成校园认证'; end if;
  if v_profile.campus_id is null then raise exception '请先完善校园资料'; end if;
  if trim(coalesce(p_title, '')) = '' then raise exception '商品标题不能为空'; end if;
  if trim(coalesce(p_description, '')) = '' then raise exception '商品描述不能为空'; end if;
  if p_price is null or p_price < 0 then raise exception '商品价格不能小于 0'; end if;
  if p_category not in ('books', 'electronics', 'daily', 'clothing', 'sports', 'tickets', 'other') then raise exception '商品分类不合法'; end if;
  if p_item_condition not in ('new', 'like_new', 'good', 'fair') then raise exception '商品成色不合法'; end if;

  insert into public.marketplace_listings (
    seller_id, campus_id, title, description, price, category, item_condition, image_url
  ) values (
    v_user_id, v_profile.campus_id, trim(p_title), trim(p_description), p_price, p_category, p_item_condition, nullif(trim(coalesce(p_image_url, '')), '')
  ) returning * into v_listing;

  return v_listing;
end;
$$;

create or replace function public.create_marketplace_interest(p_listing_id uuid, p_message text default null)
returns public.marketplace_interests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_listing public.marketplace_listings;
  v_interest public.marketplace_interests;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if not found or v_profile.status <> 'active' then raise exception '账号不可用'; end if;
  if v_profile.verification_status <> 'verified' then raise exception '请先完成校园认证'; end if;

  select * into v_listing from public.marketplace_listings where id = p_listing_id for update;
  if not found then raise exception '商品不存在'; end if;
  if v_listing.seller_id = v_user_id then raise exception '不能购买自己发布的商品'; end if;
  if v_listing.status <> 'ACTIVE' then raise exception '商品当前不可购买'; end if;
  if v_listing.campus_id <> v_profile.campus_id then raise exception '只能联系同一校园的卖家'; end if;

  insert into public.marketplace_interests (listing_id, buyer_id, message)
  values (p_listing_id, v_user_id, nullif(trim(coalesce(p_message, '')), ''))
  on conflict (listing_id, buyer_id) do update
  set message = excluded.message, status = 'REQUESTED', updated_at = now()
  returning * into v_interest;

  return v_interest;
end;
$$;

create or replace function public.respond_marketplace_interest(p_interest_id uuid, p_accept boolean)
returns public.marketplace_interests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_interest public.marketplace_interests;
  v_listing public.marketplace_listings;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  select * into v_interest from public.marketplace_interests where id = p_interest_id for update;
  if not found then raise exception '购买申请不存在'; end if;

  select * into v_listing from public.marketplace_listings where id = v_interest.listing_id for update;
  if not found or v_listing.seller_id <> v_user_id then raise exception '只有卖家可以处理购买申请'; end if;

  if p_accept then
    if v_listing.status <> 'ACTIVE' then raise exception '商品当前不可预订'; end if;
    update public.marketplace_interests
    set status = 'DECLINED'
    where listing_id = v_listing.id and id <> p_interest_id and status = 'REQUESTED';

    update public.marketplace_listings
    set status = 'RESERVED', buyer_id = v_interest.buyer_id
    where id = v_listing.id;
  end if;

  update public.marketplace_interests
  set status = case when p_accept then 'ACCEPTED'::public.listing_interest_status else 'DECLINED'::public.listing_interest_status end
  where id = p_interest_id
  returning * into v_interest;

  return v_interest;
end;
$$;

create or replace function public.mark_marketplace_listing_sold(p_listing_id uuid)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.marketplace_listings;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  update public.marketplace_listings
  set status = 'SOLD', sold_at = now()
  where id = p_listing_id
    and seller_id = v_user_id
    and status in ('ACTIVE', 'RESERVED')
  returning * into v_listing;

  if not found then raise exception '商品不存在或当前状态不能标记为已售'; end if;
  return v_listing;
end;
$$;

create or replace function public.remove_marketplace_listing(p_listing_id uuid)
returns public.marketplace_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.marketplace_listings;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  update public.marketplace_listings
  set status = 'REMOVED', removed_at = now()
  where id = p_listing_id
    and status <> 'SOLD'
    and (seller_id = v_user_id or public.is_admin())
  returning * into v_listing;

  if not found then raise exception '商品不存在或无权下架'; end if;
  return v_listing;
end;
$$;

create or replace function public.get_marketplace_contact(p_listing_id uuid)
returns table (profile_id uuid, display_name text, phone text, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.marketplace_listings;
  v_other_id uuid;
begin
  if v_user_id is null then raise exception '请先登录'; end if;

  select * into v_listing from public.marketplace_listings where id = p_listing_id;
  if not found then raise exception '商品不存在'; end if;
  if v_user_id <> v_listing.seller_id and v_user_id <> v_listing.buyer_id then
    raise exception '无权查看联系方式';
  end if;
  if v_listing.status not in ('RESERVED', 'SOLD') then
    raise exception '卖家接受购买申请后才可查看联系方式';
  end if;

  v_other_id := case when v_user_id = v_listing.seller_id then v_listing.buyer_id else v_listing.seller_id end;

  return query
  select p.id, p.display_name, p.phone, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_other_id;
end;
$$;

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_interests enable row level security;

drop policy if exists "marketplace_listings_read_campus" on public.marketplace_listings;
create policy "marketplace_listings_read_campus" on public.marketplace_listings
for select using (
  auth.uid() is not null
  and (
    seller_id = auth.uid()
    or buyer_id = auth.uid()
    or public.is_admin()
    or (
      status <> 'REMOVED'
      and campus_id = (select campus_id from public.profiles where id = auth.uid())
    )
  )
);

drop policy if exists "marketplace_interests_read_participants" on public.marketplace_interests;
create policy "marketplace_interests_read_participants" on public.marketplace_interests
for select using (
  buyer_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.marketplace_listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  )
);

revoke insert, update, delete on public.marketplace_listings from anon, authenticated;
revoke insert, update, delete on public.marketplace_interests from anon, authenticated;
grant select on public.marketplace_listings to authenticated;
grant select on public.marketplace_interests to authenticated;

revoke all on function public.create_marketplace_listing(text, text, numeric, text, text, text) from public;
revoke all on function public.create_marketplace_interest(uuid, text) from public;
revoke all on function public.respond_marketplace_interest(uuid, boolean) from public;
revoke all on function public.mark_marketplace_listing_sold(uuid) from public;
revoke all on function public.remove_marketplace_listing(uuid) from public;
revoke all on function public.get_marketplace_contact(uuid) from public;

grant execute on function public.create_marketplace_listing(text, text, numeric, text, text, text) to authenticated;
grant execute on function public.create_marketplace_interest(uuid, text) to authenticated;
grant execute on function public.respond_marketplace_interest(uuid, boolean) to authenticated;
grant execute on function public.mark_marketplace_listing_sold(uuid) to authenticated;
grant execute on function public.remove_marketplace_listing(uuid) to authenticated;
grant execute on function public.get_marketplace_contact(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace', 'marketplace', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketplace_images_public_read" on storage.objects;
create policy "marketplace_images_public_read" on storage.objects
for select using (bucket_id = 'marketplace');

drop policy if exists "marketplace_images_insert_own_folder" on storage.objects;
create policy "marketplace_images_insert_own_folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'marketplace' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "marketplace_images_update_own_folder" on storage.objects;
create policy "marketplace_images_update_own_folder" on storage.objects
for update to authenticated
using (bucket_id = 'marketplace' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'marketplace' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "marketplace_images_delete_own_folder" on storage.objects;
create policy "marketplace_images_delete_own_folder" on storage.objects
for delete to authenticated
using (bucket_id = 'marketplace' and (storage.foldername(name))[1] = auth.uid()::text);
