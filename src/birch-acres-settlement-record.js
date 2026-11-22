'use strict';
// Server-side settlement ledger calculation. One record per checkout ID;
// persistence layer MUST enforce unique(checkout_id) and immutable allocations.
const {allocate}=require('./birch-acres-tender-allocation.js');
function settlementRecord(checkout){
 if(!checkout||checkout.store_code!=='BIRCH_ACRES')throw Error('Birch Acres only');
 if(!/^[-a-zA-Z0-9_]{8,100}$/.test(String(checkout.checkout_id||'')))throw Error('Invalid checkout ID');
 if(checkout.state!=='completed'||!checkout.payment_reference)throw Error('Unsettled checkout');
 if(checkout.feasterville_amount>0&&!checkout.feasterville_sale_reference)throw Error('Missing Feasterville sale');
 if(checkout.noshville_amount>0&&!checkout.noshville_sale_reference)throw Error('Missing Noshville sale');
 const allocation=allocate(checkout);
 return Object.freeze({checkout_id:checkout.checkout_id,payment_reference:checkout.payment_reference,
  feasterville_sale_reference:checkout.feasterville_sale_reference||null,
  noshville_sale_reference:checkout.noshville_sale_reference||null,
  feasterville_revenue:allocation.feasterville.revenue,
  noshville_revenue:allocation.noshville.revenue,
  cash_received:allocation.feasterville.cash+allocation.noshville.cash,
  card_received:allocation.feasterville.card+allocation.noshville.card,
  due_to_noshville:allocation.feasterville_payable_to_noshville,
  due_from_feasterville:allocation.noshville_receivable_from_feasterville});
}
module.exports={settlementRecord};
