alter table carpool_trips add column if not exists trip_type text not null default 'MATCH_FIRST';
alter table carpool_trips add column if not exists vehicle_source text not null default '';
alter table carpool_trips add column if not exists cost_note text not null default '';

alter table carpool_trips drop constraint if exists carpool_trips_trip_type_check;
alter table carpool_trips add constraint carpool_trips_trip_type_check check (trip_type in ('MATCH_FIRST','RIDE_FOUND'));

alter table carpool_trips drop constraint if exists carpool_trips_ride_found_details_check;
alter table carpool_trips add constraint carpool_trips_ride_found_details_check check (
  trip_type = 'MATCH_FIRST'
  or (length(trim(vehicle_source)) between 2 and 120 and length(trim(cost_note)) between 2 and 120)
);

create index if not exists carpool_trips_campus_type_departure on carpool_trips(campus_id,trip_type,status,departure_start,id);
