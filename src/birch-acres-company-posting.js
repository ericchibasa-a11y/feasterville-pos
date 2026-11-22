'use strict';
// Trusted server-side adapter contracts. Database-specific RPCs must implement
// atomic sale+items+stock posting with UNIQUE checkout_id before enabling writes.
function requireRpc(client){if(!client||typeof client.rpc!=='function')throw Error('Missing trusted RPC client');return client}
function reference(value){if(typeof value!=='string'||!value.trim())throw Error('Missing checkout reference');return value}
function companyAdapter({feasterville,noshville}){
 requireRpc(feasterville);requireRpc(noshville);
 async function invoke(client,fn,payload){
  const {data,error}=await client.rpc(fn,payload);
  if(error)throw Error(fn+' failed: '+String(error.message||error));
  if(!data||typeof data!=='object'||!data.sale_reference)throw Error(fn+' returned no sale reference');
  return reference(data.sale_reference);
 }
 return {
  async postFeasterville(job){return invoke(feasterville,'birch_post_feasterville_sale',{p_checkout_id:reference(job.checkout_id)});},
  async postNoshville(job){return invoke(noshville,'birch_post_noshville_sale',{p_checkout_id:reference(job.checkout_id)});}
 };
}
module.exports={companyAdapter};
