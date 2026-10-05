alter table marketplace_listings add column if not exists trade_mode text not null default 'OFFLINE';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_listings_trade_mode_check'
  ) then
    alter table marketplace_listings
      add constraint marketplace_listings_trade_mode_check check (trade_mode in ('PLATFORM','OFFLINE'));
  end if;
end $$;