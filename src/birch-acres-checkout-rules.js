/* Birch Acres checkout command validation and state transition rules.
 * NO payment capture or database writes. Backend must persist and enforce atomically. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BirchAcresCheckoutRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const states=Object.freeze({draft:['reserved','cancelled'],reserved:['payment_pending','cancelled'],payment_pending:['payment_confirmed','cancelled'],payment_confirmed:['posting','needs_reconciliation'],posting:['completed','needs_reconciliation'],needs_reconciliation:['posting','refund_pending'],refund_pending:['refunded','needs_reconciliation'],completed:[],cancelled:[],refunded:[]});
const cents=n=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0)throw Error('Invalid amount');return Math.round((n+Number.EPSILON)*100)};
function validate(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.items)||!input.items.length)throw Error('Empty checkout');
 if(typeof input.checkout_id!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(input.checkout_id))throw Error('Invalid checkout ID');
 if(input.store_code!=='BIRCH_ACRES')throw Error('Birch Acres only');
 const totals={feasterville:0,noshville:0};
 for(const item of input.items){
  if(!Object.hasOwn(totals,item.company)||typeof item.product_id!=='string'||!item.product_id.trim())throw Error('Invalid product/company');
  if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10000)throw Error('Invalid quantity');
  totals[item.company]+=cents(item.unit_price)*item.quantity;
 }
 const total=totals.feasterville+totals.noshville;
 if(!total)throw Error('Zero-value basket');
 if(!input.tender||typeof input.tender!=='object')throw Error('Missing tender');
 const cash=cents(input.tender.cash||0),card=cents(input.tender.card||0);
 if(cash+card!==total)throw Error('Tender mismatch');
 return Object.freeze({checkout_id:input.checkout_id,store_code:'BIRCH_ACRES',feasterville_amount:totals.feasterville/100,noshville_amount:totals.noshville/100,total_amount:total/100,cash_amount:cash/100,card_amount:card/100});
}
function transition(current,next){
 if(!Object.hasOwn(states,current)||!states[current].includes(next))throw Error('Forbidden checkout transition');
 return next;
}
return Object.freeze({validate,transition,states});
});
