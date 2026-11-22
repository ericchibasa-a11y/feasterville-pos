-- REVIEW ONLY — DO NOT DEPLOY. Feasterville project only.
-- Manager-approved manual bank transfers settle Feasterville's liability to Noshville.
-- No payment execution, no revenue posting, no modifications to existing POS tables.
-- Apply only in isolated staging after accounting and RLS review.
create table if not exists public.birch_intercompany_transfers (
 id uuid primary key default gen_random_uuid(),
 store_code text not null default 'BIRCH_ACRES' check (store_code='BIRCH_ACRES'),
 from_company text not null default 'feasterville' check (from_company='feasterville'),
 to_company text not null default 'noshville' check (to_company='noshville'),
 amount numeric(14,2) not null check (amount>0),
 bank_reference text not null check (length(trim(bank_reference)) between 1 and 120),
 transfer_date date not null,
 recorded_by uuid not null,
 created_at timestamptz not null default now(),
 constraint birch_transfer_reference_unique unique (from_company,to_company,bank_reference)
);
create index if not exists birch_transfers_date_idx on public.birch_intercompany_transfers(transfer_date);
alter table public.birch_intercompany_transfers enable row level security;
revoke all on public.birch_intercompany_transfers from anon,authenticated;
-- SECURITY: no browser writes. Implement a trusted server RPC that verifies the
-- Feasterville JWT and an active BIRCH_ACRES manager profile on every write.
-- Under a transaction lock, calculate the outstanding payable from immutable,
-- completed company-posted checkouts and existing transfers. Reject overpayment.
-- Never trust a browser-supplied manager ID, payable balance or payment proof.
-- A bank reference alone is NOT proof of a completed bank transfer.
-- Only the manager can access settlement reports; retain audit trail and do not
-- allow updates/deletes of posted transfers without a reviewed reversal process.
