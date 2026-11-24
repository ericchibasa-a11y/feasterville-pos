/* Birch Acres manager reporting core. Pure functions; no live DB writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BirchAcresReporting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const cents=x=>{const n=Number(x);if(!Number.isFinite(n))throw Error('Invalid amount');return Math.round((n+Number.EPSILON)*100)};
const rand=x=>x/100;
function allocate(items){
 const totals={feasterville:0,noshville:0};
 for(const item of items){
  if(!Object.prototype.hasOwnProperty.call(totals,item.company))throw Error('Unknown company');
  const qty=Number(item.quantity),unit=Number(item.unit_price);
  if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(unit)||unit<0)throw Error('Invalid line');
  totals[item.company]+=cents(qty*unit);
 }
 return {feasterville:rand(totals.feasterville),noshville:rand(totals.noshville),combined:rand(totals.feasterville+totals.noshville)};
}
function summarize(checkouts){
 const result={feasterville:0,noshville:0,combined:0,cash:0,card:0,other:0,transactions:0,exceptions:0};
 const seen=new Set();
 for(const sale of checkouts){
  if(!sale.checkout_id||seen.has(sale.checkout_id))throw Error('Missing or duplicate checkout reference');
  seen.add(sale.checkout_id);
  if(sale.status!=='completed'){result.exceptions++;continue;}
  const allocated=allocate(sale.items||[]);
  const cash=cents(sale.cash_amount||0),card=cents(sale.card_amount||0),other=cents(sale.other_amount||0);
  if(cash<0||card<0||other<0||cash+card+other!==cents(allocated.combined))throw Error('Tender does not reconcile to sale');
  result.feasterville+=cents(allocated.feasterville);
  result.noshville+=cents(allocated.noshville);
  result.cash+=cash;result.card+=card;result.other+=other;result.transactions++;
 }
 for(const key of ['feasterville','noshville','cash','card','other'])result[key]=rand(result[key]);
 result.combined=rand(cents(result.feasterville)+cents(result.noshville));
 result.noshville_receivable=result.noshville;
 return result;
}
function cashup({opening_float=0,cash_collected=0,cash_change=0,approved_cash_in=0,approved_cash_out=0,actual_cash}){
 const expected=cents(opening_float)+cents(cash_collected)-cents(cash_change)+cents(approved_cash_in)-cents(approved_cash_out);
 return {expected_cash:rand(expected),actual_cash:actual_cash==null?null:rand(cents(actual_cash)),variance:actual_cash==null?null:rand(cents(actual_cash)-expected)};
}
return Object.freeze({allocate,summarize,cashup});
});
