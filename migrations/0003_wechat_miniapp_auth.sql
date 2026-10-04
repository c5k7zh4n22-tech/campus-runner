create table if not exists app_user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  provider text not null check (provider in ('wechat_miniapp', 'wechat_official')),
  provider_user_id text not null,
  union_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index if not exists app_user_identities_user_idx on app_user_identities (user_id, provider);
create index if not exists app_user_identities_union_idx on app_user_identities (union_id) where union_id is not null;

drop trigger if exists app_user_identities_set_updated_at on app_user_identities;
create trigger app_user_identities_set_updated_at before update on app_user_identities for each row execute function set_updated_at();

create table if not exists app_api_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  token_hash text not null unique,
  client text not null default 'miniapp' check (client in ('miniapp', 'app', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text
);

create index if not exists app_api_sessions_user_active_idx on app_api_sessions (user_id, expires_at desc) where revoked_at is null;
create index if not exists app_api_sessions_expires_idx on app_api_sessions (expires_at);
