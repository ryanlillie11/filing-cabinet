-- Adds a "from previous owner" flag (for a Historical drawer section) and a
-- short equipment label used for a simpler manual-naming convention.

alter table documents add column if not exists from_previous_owner boolean not null default false;
alter table documents add column if not exists equipment_label text;

create index if not exists documents_previous_owner_idx on documents (from_previous_owner)
  where from_previous_owner = true;
