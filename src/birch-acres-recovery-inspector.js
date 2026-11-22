'use strict';
// Recovery inspection only. Never assume a failed RPC means a sale was not
// committed: the response may be lost after the database transaction commits.
// Both company databases must enforce UNIQUE checkout_id and matching hash.
function makeRecoveryInspector({lookupFeasterville,lookupNoshville}){
 if(typeof lookupFeasterville!=='function'||typeof lookupNoshville!=='function')throw Error('Missing trusted lookup');
 return async function inspect(job){
  if(!job||job.store_code!=='BIRCH_ACRES'||!job.checkout_id||!job.request_hash)throw Error('Invalid recovery job');
  const [fv,nv]=await Promise.all([lookupFeasterville(job.checkout_id),lookupNoshville(job.checkout_id)]);
  for(const [name,sale] of [['Feasterville',fv],['Noshville',nv]]){
   if(sale&&sale.request_hash!==job.request_hash)throw Error(name+' checkout hash conflict');
   if(sale&&!sale.sale_reference)throw Error(name+' missing sale reference');
  }
  const hasFv=job.feasterville_amount>0,hasNv=job.noshville_amount>0;
  if(!hasFv&&fv||!hasNv&&nv)throw Error('Unexpected company sale for checkout');
  return {checkout_id:job.checkout_id,feasterville_sale_reference:fv?.sale_reference||null,noshville_sale_reference:nv?.sale_reference||null,
   status:(!hasFv||!!fv)&&(!hasNv||!!nv)?'both_posted':fv||nv?'partially_posted':'not_posted'};
 };
}
module.exports={makeRecoveryInspector};
