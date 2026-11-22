'use strict';
// Static release gate for draft SQL; this is NOT a database integration test.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const sql=fs.readFileSync('migrations/REVIEW_ONLY_noshville_atomic_posting.sql','utf8');
assert.equal((sql.match(/create or replace function birch_internal\.post_noshville_sale\s*\(/gi)||[]).length,1,'Exactly one posting function required');
assert.equal((sql.match(/end \$\$;/gi)||[]).length,1,'Unexpected duplicate function body');
assert.ok(!sql.includes('\\n'),'Literal escaped newlines in SQL');
assert.match(sql,/-- REVIEW-ONLY/);
assert.match(sql,/DO NOT DEPLOY/);
assert.match(sql,/revoke all on function birch_internal\.post_noshville_sale/);
assert.match(sql,/trg_sale_item_stock/);
assert.match(sql,/pg_advisory_xact_lock/);
// Explicitly fail deployment readiness until all required server-verified
// payment and amount parameters are included and tested in staging.
const blockers=['p_payment_reference','p_expected_company_total','p_cashier_identity'];
const missing=blockers.filter(x=>!sql.includes(x));
assert.deepEqual(missing,[],'Draft must contain expected company amount, payment reference and cashier parameters');
assert.match(sql,/v_total<>p_expected_company_total/);
assert.match(sql,/caller assertions, NOT proof/);
console.log('Noshville SQL static integrity checks passed; deployment remains BLOCKED pending verified payment and staging tests');
