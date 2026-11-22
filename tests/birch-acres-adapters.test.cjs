const assert=require('node:assert/strict');const a=require('../src/birch-acres-adapters.js');
const f=a.feasterville({id:123,sale_date:'2026-11-22',store_code:'BIRCH',total:'40.00',payment:'Card',card_amount:40});
const n=a.noshville({id:'uuid',sale_date:'2026-11-22T09:00:00Z',total_amount:'60.00',payment_method:'card',status:'completed'});
assert.deepEqual([f.company,n.company],['feasterville','noshville']);assert.equal(a.aggregate([f,n],{from:'2026-11-22',to:'2026-11-22'}).combined,100);
assert.equal(a.aggregate([f,n],{from:'2026-11-22',to:'2026-11-22',store_code:'OTHER'}).feasterville,0);
assert.throws(()=>a.aggregate([f,f],{from:'2026-11-22',to:'2026-11-22'}),/Duplicate/);
console.log('Schema adapter tests passed');