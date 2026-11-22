const assert=require('node:assert/strict');const r=require('../src/birch-acres-reporting.js');
assert.deepEqual(r.allocate([{company:'feasterville',quantity:1,unit_price:40},{company:'noshville',quantity:2,unit_price:30}]),{feasterville:40,noshville:60,combined:100});
const d=r.summarize([{checkout_id:'A',status:'completed',items:[{company:'feasterville',quantity:1,unit_price:40},{company:'noshville',quantity:1,unit_price:60}],card_amount:100},{checkout_id:'B',status:'needs_reconciliation',items:[]}]);
assert.equal(d.feasterville,40);assert.equal(d.noshville,60);assert.equal(d.noshville_receivable,60);assert.equal(d.exceptions,1);
assert.deepEqual(r.cashup({opening_float:100,cash_collected:250,cash_change:20,approved_cash_out:30,actual_cash:295}),{expected_cash:300,actual_cash:295,variance:-5});
assert.throws(()=>r.summarize([{checkout_id:'X',status:'completed',items:[{company:'noshville',quantity:1,unit_price:60}],card_amount:50}]),/reconcile/);
assert.throws(()=>r.summarize([{checkout_id:'X',status:'completed',items:[]},{checkout_id:'X',status:'completed',items:[]}]),/duplicate/);
console.log('Birch Acres reporting tests passed');
