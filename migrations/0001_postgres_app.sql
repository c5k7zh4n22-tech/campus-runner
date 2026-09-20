create extension if not exists pgcrypto;

do $$ begin
  create type user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type user_status as enum ('active', 'suspended', 'banned');
exception when duplicate_object then null; end $$;
do $$ begin
  create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type order_status as enum ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'WAITING_CONFIRM', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type report_status as enum ('OPEN', 'PROCESSING', 'CLOSED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type listing_status as enum ('ACTIVE', 'RESERVED', 'SOLD', 'REMOVED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type listing_interest_status as enum ('REQUESTED', 'ACCEPTED', 'DECLINED');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references app_users(id) on delete cascade,
  campus_id uuid references campuses(id),
  display_name text not null,
  avatar_url text,
  phone text,
  student_id text,
  verification_status verification_status not null default 'unverified',
  role user_role not null default 'user',
  status user_status not null default 'active',
  rating numeric(3,2) not null default 5.00,
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references profiles(id) on delete cascade,
  runner_id uuid references profiles(id) on delete set null,
  campus_id uuid not null references campuses(id),
  pickup_location text not null,
  delivery_location text not null,
  description text not null,
  reward numeric(10,2) not null check (reward > 0),
  deadline timestamptz not null,
  status order_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  check (publisher_id <> runner_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  reviewee_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  reported_user_id uuid references profiles(id) on delete set null,
  reason text not null check (reason in ('fake_order','malicious_cancel','fraud','rude_behavior','other')),
  details text not null,
  status report_status not null default 'OPEN',
  resolved_by uuid references profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (order_id is not null or reported_user_id is not null)
);

create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  campus_id uuid not null references campuses(id),
  title text not null,
  description text not null,
  price numeric(10,2) not null check (price >= 0),
  category text not null,
  item_condition text not null,
  image_url text,
  status listing_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  removed_at timestamptz,
  check (seller_id <> buyer_id)
);

create table if not exists marketplace_interests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  message text,
  status listing_interest_status not null default 'REQUESTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

create index if not exists orders_campus_status_idx on orders (campus_id, status, created_at desc);
create index if not exists orders_publisher_idx on orders (publisher_id, created_at desc);
create index if not exists orders_runner_idx on orders (runner_id, created_at desc);
create index if not exists reviews_reviewee_idx on reviews (reviewee_id, created_at desc);
create index if not exists reports_status_idx on reports (status, created_at desc);
create index if not exists marketplace_listings_campus_status_idx on marketplace_listings (campus_id, status, created_at desc);
create index if not exists marketplace_listings_seller_idx on marketplace_listings (seller_id, created_at desc);
create index if not exists marketplace_interests_listing_idx on marketplace_interests (listing_id, created_at desc);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists marketplace_listings_set_updated_at on marketplace_listings;
create trigger marketplace_listings_set_updated_at before update on marketplace_listings for each row execute function set_updated_at();
drop trigger if exists marketplace_interests_set_updated_at on marketplace_interests;
create trigger marketplace_interests_set_updated_at before update on marketplace_interests for each row execute function set_updated_at();

create or replace function recalculate_profile_rating()
returns trigger language plpgsql as $$
begin
  update profiles
  set rating = coalesce((select round(avg(rating)::numeric, 2) from reviews where reviewee_id = new.reviewee_id), 5.00),
      review_count = (select count(*) from reviews where reviewee_id = new.reviewee_id)
  where id = new.reviewee_id;
  return new;
end;
$$;

drop trigger if exists on_review_created on reviews;
create trigger on_review_created after insert on reviews for each row execute function recalculate_profile_rating();

insert into campuses (name, slug, city)
values ('莆田学院', 'ptu', '莆田')
on conflict (slug) do nothing;
