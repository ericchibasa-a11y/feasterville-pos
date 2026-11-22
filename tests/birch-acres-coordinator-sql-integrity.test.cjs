'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('migrations/PROPOSED_birch_checkout_coordinator.sql','utf8');
assert.equal((sql.match(/create table if not exists public\.birch_checkout_jobs\s*\(/gi)||[]).length,1);
assert.equal((sql.match(/create table if not exists public\.birch_checkout_events\s*\(/gi)||[]).length,1);
for(const required of ['DO NOT DEPLOY','request_hash text not null','cashier_id uuid not null','items jsonb not null','payment_confirmed_at timestamptz','constraint payment_evidence_required','constraint tender_matches_total','enable row level security','revoke all on public.birch_checkout_jobs']){
 assert.ok(sql.includes(required),'Missing coordinator safeguard: '+required);
}
assert.ok(!sql.includes('\\n'),'Malformed literal newline');
console.log('Coordinator SQL static checks passed; deployment blocked pending staging');
