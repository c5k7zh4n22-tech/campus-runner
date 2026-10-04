create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  order_id uuid references orders(id) on delete set null,
  category text not null check (category in ('order','refund','account','feedback')),
  subject text not null check (length(trim(subject)) between 2 and 80),
  status text not null default 'OPEN' check (status in ('OPEN','PROCESSING','WAITING_USER','RESOLVED','CLOSED')),
  assigned_to uuid references profiles(id) on delete set null,
  client_id uuid not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_id)
);
create index if not exists support_owner_updated on support_tickets(owner_id, updated_at desc, id);
create index if not exists support_status_updated on support_tickets(status, updated_at desc, id);
create index if not exists support_order on support_tickets(order_id);

create table if not exists support_entries (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  actor_role text not null check (actor_role in ('user','admin')),
  body text not null check (length(trim(body)) between 1 and 4000),
  kind text not null check (kind in ('message','status')),
  status text check (status in ('OPEN','PROCESSING','WAITING_USER','RESOLVED','CLOSED')),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  unique (actor_id, client_id)
);
create index if not exists support_entries_ticket on support_entries(ticket_id, id desc);
