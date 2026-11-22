'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const sql=fs.readFileSync('migrations/REVIEW_ONLY_noshville_atomic_posting.sql','utf8');
assert.equal((sql.match(/create or replace function birch_internal\.post_noshville_sale\s*\(/gi)||[]).length,1);
assert.equal((sql.match(/end \$\$;/gi)||[]).length,1);
assert.ok(!sql.includes('\\n'),'Malformed literal newline');
for(const required of ['-- REVIEW-ONLY','DO NOT DEPLOY','pg_advisory_xact_lock','trg_sale_item_stock','p_payment_reference','p_expected_company_total','p_cashier_identity','v_total<>p_expected_company_total','caller assertions, NOT proof']){
 assert.ok(sql.includes(required),'Missing '+required);
}
const signature='birch_internal.post_noshville_sale(text,text,jsonb,numeric,text,uuid,public.payment_method)';
assert.ok(sql.includes('revoke all on function '+signature+' from public,anon,authenticated;'));
assert.ok(sql.includes('grant execute on function '+signature+' to service_role;'));
assert.ok(sql.includes("coalesce(p_request_hash,'') !~ '^[0-9a-f]{64}$'"));
console.log('Noshville SQL static integrity passed; production release BLOCKED pending staging and payment verification');
