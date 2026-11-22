'use strict';
// Trusted server-side read-only recovery lookups.
// The RPC is PROPOSED, not yet deployed; it must be service-role-only.
// A missing table, permission error or network error must throw, never return null.
const {makeRecoveryInspector}=require('./birch-acres-recovery-inspector.js');
function createRecoveryLookups({feasterville,noshville}){
 if(typeof feasterville?.rpc!=='function'||typeof noshville?.rpc!=='function')throw Error('Missing trusted Supabase clients');
 const lookup=client=>async checkoutId=>{
  if(typeof checkoutId!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(checkoutId))throw Error('Invalid checkout ID');
  const {data,error}=await client.rpc('birch_lookup_posted_checkout',{p_checkout_id:checkoutId});
  if(error)throw Error('Recovery lookup failed: '+String(error.message||error));
  if(data===undefined)throw Error('Recovery lookup returned no status');
  return data?{request_hash:data.request_hash,sale_reference:data.sale_reference}:null;
 };
 return makeRecoveryInspector({lookupFeasterville:lookup(feasterville),lookupNoshville:lookup(noshville)});
}
module.exports={createRecoveryLookups};
