create table if not exists support_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id bigint not null references support_entries(id) on delete cascade,
  position smallint not null check (position between 0 and 2),
  content_type text not null check (content_type = 'image/webp'),
  data bytea not null check (octet_length(data) between 1 and 819200),
  created_at timestamptz not null default now(),
  unique (entry_id, position)
);
