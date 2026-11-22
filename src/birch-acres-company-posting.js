'use strict';
// Server-only RPC contract; company functions must atomically enforce
// checkout ID uniqueness, request hash, current prices and stock under locks.
// These RPCs are NOT deployed. Never call from browser or enable until tested.
function requireRpc(client){if(!client||typeof client.rpc!=='function')throw Error('Missing trusted RPC client');return client}
function reference(value){if(typeof value!=='string'||!value.trim())throw Error('Missing checkout reference');return value}
function payload(job,company){
 const id=reference(job?.checkout_id);
 if(!/^[-a-zA-Z0-9_]{8,100}$/.test(id)||job.store_code!=='BIRCH_ACRES')throw Error('Invalid Birch Acres checkout');
 if(typeof job.request_hash!=='string'||!/^[a-f0-9]{64}$/i.test(job.request_hash))throw Error('Missing canonical request hash');
 if(!job.payment_reference||typeof job.payment_reference!=='string')throw Error('Missing verified payment reference');
 if(typeof job.cashier_id!=='string'||!job.cashier_id.trim())throw Error('Missing verified cashier ID');
 const amount=company==='noshville'?job.noshville_amount:job.feasterville_amount;
 if(typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==amount*100)throw Error('Invalid company amount');
 if(job.state!=='posting')throw Error('Checkout not in posting state');
 const lines=job.items?.filter(x=>x.company===company);
 if(!Array.isArray(lines)||!lines.length)throw Error('Missing company lines');
 for(const line of lines)if(typeof line.product_id!=='string'||!line.product_id||!Number.isInteger(line.quantity)||line.quantity<1)throw Error('Invalid company line');
 return {p_checkout_id:id,p_request_hash:job.request_hash,p_payment_reference:job.payment_reference,p_lines:lines.map(x=>({product_id:x.product_id,quantity:x.quantity})),p_expected_company_total:amount,p_cashier_identity:job.cashier_id};
}
function companyAdapter({feasterville,noshville}){
 requireRpc(feasterville);requireRpc(noshville);
 async function invoke(client,fn,job,company){
  const args=payload(job,company);
  const {data,error}=await client.rpc(fn,args);
  if(error)throw Error(fn+' failed: '+String(error.message||error));
  if(!data||typeof data!=='object'||!data.sale_reference)throw Error(fn+' returned no sale reference');
  return reference(data.sale_reference);
 }
 return {
  async postFeasterville(job){return invoke(feasterville,'birch_post_feasterville_sale',job,'feasterville')},
  async postNoshville(job){return invoke(noshville,'birch_post_noshville_sale',job,'noshville')}
 };
}
module.exports={companyAdapter};
