'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const sql=fs.readFileSync('migrations/REVIEW_ONLY_noshville_atomic_posting.sql','utf8');
assert.equal((sql.match(/create or replace function birch_internal\.post_noshville_sale\s*\(/gi)||[]).length,1);
assert.equal((sql.match(/end \$\$;/gi)||[]).length,1);
assert.ok(!sql.includes('\\n'),'Malformed literal newline');
const required=[
 '-- REVIEW-ONLY','DO NOT DEPLOY','pg_advisory_xact_lock','trg_sale_item_stock',
 'p_payment_reference','p_expected_company_total','p_cashier_identity',
 'v_total<>p_expected_company_total','caller assertions, NOT proof',
 'payment_reference text not null','cashier_identity uuid not null',
 'expected_company_total numeric(14,2) not null',
 'v_prior.payment_reference <> p_payment_reference',
 'v_prior.cashier_identity <> p_cashier_identity',
 'v_prior.expected_company_total <> p_expected_company_total',
 'insert into public.sales(order_no,cashier_id,payment_method',
 'insert into birch_internal.posted_checkouts(checkout_id,sale_id,request_hash,payment_reference,cashier_identity,expected_company_total)'
];
for(const field of required)assert.ok(sql.includes(field),'Missing SQL safeguard: '+field);
const signature='birch_internal.post_noshville_sale(text,text,jsonb,numeric,text,uuid,public.payment_method)';
assert.ok(sql.includes('revoke all on function '+signature+' from public,anon,authenticated;'));
assert.ok(sql.includes('grant execute on function '+signature+' to service_role;'));
assert.ok(sql.includes("coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'"));
console.log('Noshville SQL static integrity passed; production release BLOCKED pending staging and payment verification');
