-- DESIGN-ONLY migration: DO NOT apply until integration review and backups.
-- Checkout coordinator lives in Feasterville project; Noshville remains independent.
create table if not exists public.birch_checkout_jobs (
 checkout_id text primary key,
 store_code text not null default 'BIRCH_ACRES' check (store_code='BIRCH_ACRES'),
 request_hash text not null check (request_hash ~ '^[0-9a-f]{64}
 state text not null default 'draft' check (state in ('draft','reserved','payment_pending','payment_confirmed','posting','needs_reconciliation','refund_pending','refunded','completed','cancelled')),
 feasterville_amount numeric(14,2) not null check (feasterville_amount>=0),
 noshville_amount numeric(14,2) not null check (noshville_amount>=0),
 total_amount numeric(14,2) generated always as (feasterville_amount+noshville_amount) stored,
 cash_amount numeric(14,2) not null default 0 check (cash_amount>=0),
 card_amount numeric(14,2) not null default 0 check (card_amount>=0),
 payment_reference text,
 payment_confirmed_at timestamptz,
 feasterville_sale_reference text,
 noshville_sale_reference text,
 last_error text,
 attempt_count integer not null default 0 check(attempt_count>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint payment_evidence_required check (state in ('draft','reserved','payment_pending') or (payment_reference is not null and payment_confirmed_at is not null)),
 constraint tender_matches_total check (cash_amount+card_amount=feasterville_amount+noshville_amount)
);
create unique index if not exists birch_payment_ref_unique on public.birch_checkout_jobs(payment_reference) where payment_reference is not null;
create unique index if not exists birch_fv_sale_ref_unique on public.birch_checkout_jobs(feasterville_sale_reference) where feasterville_sale_reference is not null;
create unique index if not exists birch_nv_sale_ref_unique on public.birch_checkout_jobs(noshville_sale_reference) where noshville_sale_reference is not null;
create table if not exists public.birch_checkout_events (
 id bigint generated always as identity primary key,
 checkout_id text not null references public.birch_checkout_jobs(checkout_id),
 event_type text not null,
 event_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists birch_checkout_events_ref_idx on public.birch_checkout_events(checkout_id,created_at);
alter table public.birch_checkout_jobs enable row level security;
alter table public.birch_checkout_events enable row level security;
-- No anon/authenticated grants or policies. Trusted backend access only.
revoke all on public.birch_checkout_jobs,public.birch_checkout_events from anon,authenticated;
revoke all on sequence public.birch_checkout_events_id_seq from anon,authenticated;
-- Review-only: the backend create adapter must persist verified cashier_id and immutable items.
-- An UPDATE restriction or trusted transition function must prohibit changing basket, amounts,
-- cashier, request hash or payment evidence after confirmation. RLS alone is not sufficient.
-- Before any production rollout: create trusted server RPC to validate state transitions,
-- enforce request-hash idempotency and record events atomically, plus per-company posting RPCs.
),
 cashier_id uuid not null,
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items)>0),
 state text not null default 'draft' check (state in ('draft','reserved','payment_pending','payment_confirmed','posting','needs_reconciliation','refund_pending','refunded','completed','cancelled')),
 feasterville_amount numeric(14,2) not null check (feasterville_amount>=0),
 noshville_amount numeric(14,2) not null check (noshville_amount>=0),
 total_amount numeric(14,2) generated always as (feasterville_amount+noshville_amount) stored,
 cash_amount numeric(14,2) not null default 0 check (cash_amount>=0),
 card_amount numeric(14,2) not null default 0 check (card_amount>=0),
 payment_reference text,
 feasterville_sale_reference text,
 noshville_sale_reference text,
 last_error text,
 attempt_count integer not null default 0 check(attempt_count>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint tender_matches_total check (cash_amount+card_amount=feasterville_amount+noshville_amount)
);
create unique index if not exists birch_payment_ref_unique on public.birch_checkout_jobs(payment_reference) where payment_reference is not null;
create unique index if not exists birch_fv_sale_ref_unique on public.birch_checkout_jobs(feasterville_sale_reference) where feasterville_sale_reference is not null;
create unique index if not exists birch_nv_sale_ref_unique on public.birch_checkout_jobs(noshville_sale_reference) where noshville_sale_reference is not null;
create table if not exists public.birch_checkout_events (
 id bigint generated always as identity primary key,
 checkout_id text not null references public.birch_checkout_jobs(checkout_id),
 event_type text not null,
 event_payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists birch_checkout_events_ref_idx on public.birch_checkout_events(checkout_id,created_at);
alter table public.birch_checkout_jobs enable row level security;
alter table public.birch_checkout_events enable row level security;
-- No anon/authenticated grants or policies. Trusted backend access only.
revoke all on public.birch_checkout_jobs,public.birch_checkout_events from anon,authenticated;
revoke all on sequence public.birch_checkout_events_id_seq from anon,authenticated;
-- Before any production rollout: create trusted server RPC to validate state transitions,
-- enforce request-hash idempotency and record events atomically, plus per-company posting RPCs.
