create table if not exists carpool_places (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references campuses(id),
  name text not null check(length(trim(name)) between 2 and 80),
  active boolean not null default true,
  unique(campus_id,name)
);
create table if not exists carpool_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  campus_id uuid not null references campuses(id),
  origin_id uuid not null references carpool_places(id),
  destination_id uuid not null references carpool_places(id),
  departure_start timestamptz not null,
  departure_end timestamptz not null,
  capacity smallint not null check(capacity between 2 and 6),
  luggage text not null default '',
  meeting text not null,
  status text not null default 'OPEN' check(status in ('OPEN','DEPARTED','COMPLETED','CANCELLED')),
  version integer not null default 1,
  client_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(origin_id<>destination_id),
  check(departure_end>departure_start and departure_end<=departure_start+interval '6 hours'),
  unique(owner_id,client_id)
);
create table if not exists carpool_members (
  trip_id uuid not null references carpool_trips(id) on delete cascade,
  user_id uuid not null references profiles(id),
  party_size smallint not null check(party_size between 1 and 6),
  status text not null check(status in ('PENDING','APPROVED','REJECTED','LEFT')),
  joined_after bigint not null default 0,
  read_through bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key(trip_id,user_id)
);
create table if not exists carpool_messages (
  id bigint generated always as identity primary key,
  trip_id uuid not null references carpool_trips(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null check(length(trim(body)) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique(sender_id,client_id)
);
create index if not exists carpool_trips_campus_departure on carpool_trips(campus_id,status,departure_start,id);
create index if not exists carpool_members_user on carpool_members(user_id,status,trip_id);
create index if not exists carpool_messages_trip on carpool_messages(trip_id,id desc);
alter table support_tickets add column if not exists trip_id uuid references carpool_trips(id) on delete set null;
alter table support_tickets drop constraint if exists support_tickets_category_check;
alter table support_tickets add constraint support_tickets_category_check check(category in ('order','refund','account','feedback','carpool'));
alter table support_tickets drop constraint if exists support_single_context;
alter table support_tickets add constraint support_single_context check(num_nonnulls(order_id,trip_id)<=1);
create index if not exists support_trip on support_tickets(trip_id);
