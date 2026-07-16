-- The Filing Cabinet — initial schema
-- Run with: supabase db push, or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- documents: one row per logical document (a multi-doc scan becomes N rows)
-- ---------------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),

  status text not null default 'processing'
    check (status in ('processing','pending_review','filed','needs_attention','split','discarded')),
  source text not null check (source in ('upload','email')),

  -- extraction (Claude's proposal, editable in review)
  category text,                 -- key from taxonomy.ts CATEGORIES
  house_system text,             -- key from taxonomy.ts HOUSE_SYSTEMS
  vendor text,                   -- display vendor ("PoolCorp")
  vendor_normalized text,        -- filename-safe vendor ("PoolCorp")
  doc_date date,
  date_source text check (date_source in ('document','upload')),
  amount numeric,
  invoice_open boolean not null default false,
  warranty_expiration date,
  description text,
  ai_confidence numeric,
  low_confidence boolean not null default false,
  proposed_subfolder text,       -- model-suggested new subfolder (rare)
  raw_extracted_text text,

  -- filing
  original_filename text,        -- as uploaded / attachment name
  filename text,                 -- standardized name once filed
  mime_type text,
  drive_file_id text,
  drive_link text,
  drive_folder_path text,
  storage_path text,             -- staging bucket path while pending

  -- dedupe / multi-doc split
  content_hash text,
  possible_duplicate_of uuid references documents(id) on delete set null,
  parent_upload_id uuid references documents(id) on delete set null,
  page_range int4range,

  upload_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- full-text search across everything searchable
  fts tsvector generated always as (
    to_tsvector('english',
      coalesce(filename,'') || ' ' ||
      coalesce(original_filename,'') || ' ' ||
      coalesce(vendor,'') || ' ' ||
      coalesce(description,'') || ' ' ||
      coalesce(raw_extracted_text,'')
    )
  ) stored
);

create index if not exists documents_fts_idx on documents using gin (fts);
create index if not exists documents_status_idx on documents (status);
create index if not exists documents_house_system_idx on documents (house_system);
create index if not exists documents_content_hash_idx on documents (content_hash);
create index if not exists documents_warranty_idx on documents (warranty_expiration) where warranty_expiration is not null;

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id bigint generated always as identity primary key,
  document_id uuid references documents(id) on delete cascade,
  action text not null,   -- ingested | classified | edited | filed | duplicate_flagged | discarded | split | error | email_dropped
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_document_idx on activity_log (document_id);

-- ---------------------------------------------------------------------------
-- google_auth: single-row store for the Drive refresh token
-- ---------------------------------------------------------------------------
create table if not exists google_auth (
  id int primary key default 1 check (id = 1),
  email text,
  refresh_token text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- drive_folders: cache of resolved Drive folder IDs by path
-- ---------------------------------------------------------------------------
create table if not exists drive_folders (
  path text primary key,        -- e.g. "House Docs/Invoices & Receipts"
  folder_id text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- staging storage bucket (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('staging', 'staging', false)
on conflict (id) do nothing;

-- RLS: enabled with no policies — only the service-role key (server-side) can
-- touch these tables. The app never queries Supabase from the browser.
alter table documents enable row level security;
alter table activity_log enable row level security;
alter table google_auth enable row level security;
alter table drive_folders enable row level security;

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists documents_updated_at on documents;
create trigger documents_updated_at before update on documents
for each row execute function set_updated_at();
