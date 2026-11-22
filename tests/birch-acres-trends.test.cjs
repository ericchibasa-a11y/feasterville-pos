const assert=require('node:assert/strict');const t=require('../src/birch-acres-trends.js');
const rows=[{checkout_id:'1',business_date:'2026-11-22',status:'completed',feasterville_amount:40,noshville_amount:60,total_amount:100},{checkout_id:'2',business_date:'2026-11-21',status:'completed',feasterville_amount:30,noshville_amount:20,total_amount:50},{checkout_id:'3',business_date:'2026-11-15',status:'completed',feasterville_amount:10,noshville_amount:5,total_amount:15},{checkout_id:'4',business_date:'2026-10-22',status:'completed',feasterville_amount:20,noshville_amount:10,total_amount:30}];
const r=t.compare(rows,'2026-11-22');assert.equal(r.daily.current.combined,100);assert.equal(r.daily.previous.combined,50);assert.equal(r.weekly.current.combined,150);assert.equal(r.weekly.previous.combined,15);assert.equal(r.monthly.previous.combined,30);
assert.throws(()=>t.sum([{...rows[0],total_amount:99}],'2026-11-22','2026-11-22'),/mismatch/);
assert.throws(()=>t.sum([rows[0],rows[0]],'2026-11-22','2026-11-22'),/Duplicate/);
console.log('Birch Acres trend tests passed');
