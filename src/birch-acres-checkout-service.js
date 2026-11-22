'use strict';
// Server-side orchestration kernel. Adapters MUST authenticate, price from DB,
// reserve stock, verify external payment, and idempotently post company sales.
// Never call this directly from an untrusted browser.
const rules=require('./birch-acres-checkout-rules.js');
function assertAdapter(a){for(const name of ['load','create','transition','verifyPayment','postFeasterville','postNoshville'])if(typeof a[name]!=='function')throw Error('Missing adapter: '+name)}
async function execute(input,a){
 assertAdapter(a);
 const totals=rules.validate(input);
 const existing=await a.load(totals.checkout_id);
 if(existing&&existing.request_hash!==input.request_hash)throw Error('Checkout ID already used with different request');
 if(!existing){
  if(typeof input.request_hash!=='string'||!input.request_hash)throw Error('Missing canonical request hash');
  await a.create({...totals,request_hash:input.request_hash,state:'draft'});
 }
 let job=await a.load(totals.checkout_id);
 if(!job)throw Error('Checkout not persisted');
 if(job.feasterville_amount!==totals.feasterville_amount||job.noshville_amount!==totals.noshville_amount||job.cash_amount!==totals.cash_amount||job.card_amount!==totals.card_amount)throw Error('Persisted checkout totals mismatch');
 if(job.state==='completed')return {status:'completed',checkout_id:job.checkout_id};
 if(['cancelled','refunded','refund_pending'].includes(job.state))throw Error('Checkout closed or refund pending');
 // Never post anything until verified settlement, including exact amount and payment reference.
 if(job.state==='draft'||job.state==='reserved'||job.state==='payment_pending'){
  const proof=await a.verifyPayment(job);
  if(!proof||proof.confirmed!==true||proof.amount!==totals.total_amount||!proof.reference) return {status:'payment_pending',checkout_id:job.checkout_id};
  // Follow legal state transitions; the adapter must persist each change with CAS.
  if(job.state==='draft'){await a.transition(job.checkout_id,'draft','reserved',{});job=await a.load(job.checkout_id);}
  if(job.state==='reserved'){await a.transition(job.checkout_id,'reserved','payment_pending',{});job=await a.load(job.checkout_id);}
  if(job.state!=='payment_pending')throw Error('Unexpected payment state');
  await a.transition(job.checkout_id,'payment_pending','payment_confirmed',{payment_reference:proof.reference});
  job=await a.load(job.checkout_id);
 }
 if(job.state==='payment_confirmed'||job.state==='needs_reconciliation'){
  await a.transition(job.checkout_id,job.state,'posting',{});
  job=await a.load(job.checkout_id);
 }
 if(job.state!=='posting')throw Error('Unexpected checkout state: '+job.state);
 try{
  // Adapter must use checkout_id as unique idempotency key in each company DB.
  // Retry a partial post only after inspecting existing company sale reference.
  if(totals.feasterville_amount>0&&!job.feasterville_sale_reference){
   const ref=await a.postFeasterville(job);
   if(!ref)throw Error('Feasterville post did not return reference');
   await a.transition(job.checkout_id,'posting','posting',{feasterville_sale_reference:ref});
  }
  job=await a.load(job.checkout_id);
  if(totals.noshville_amount>0&&!job.noshville_sale_reference){
   const ref=await a.postNoshville(job);
   if(!ref)throw Error('Noshville post did not return reference');
   await a.transition(job.checkout_id,'posting','posting',{noshville_sale_reference:ref});
  }
  job=await a.load(job.checkout_id);
  if((totals.feasterville_amount>0&&!job.feasterville_sale_reference)||(totals.noshville_amount>0&&!job.noshville_sale_reference))throw Error('Company sale reference missing');
  await a.transition(job.checkout_id,'posting','completed',{});
  return {status:'completed',checkout_id:job.checkout_id};
 }catch(error){
  await a.transition(job.checkout_id,'posting','needs_reconciliation',{last_error:String(error.message||error)});
  return {status:'needs_reconciliation',checkout_id:job.checkout_id};
 }
}
module.exports={execute};
