'use strict';
// Creates trusted, read-only Birch Acres authorization dependencies.
// Identity must be verified against Feasterville Auth, never decoded from an
// unsigned token or accepted from the browser request body.
const {createCatalogReaders}=require('./birch-acres-catalog-readers.js');
const {createAuthorizationAdapter}=require('./birch-acres-authorize-price.js');
function createBirchAuthorization({feasterville,noshville,verifyToken}){
 if(typeof verifyToken!=='function')throw Error('Missing JWT verification');
 const readers=createCatalogReaders({feasterville,noshville});
 const getIdentity=async(token)=>{
  if(typeof token!=='string'||!token.trim())throw Error('Missing cashier token');
  const user=await verifyToken(token);
  if(!user||!user.id)throw Error('Invalid cashier token');
  const result=await feasterville.from('pos_profiles').select('user_id,role,active,store_code').eq('user_id',user.id).maybeSingle();
  if(result?.error)throw Error('Cashier profile lookup failed');
  const p=result?.data;
  if(!p||p.user_id!==user.id)throw Error('Cashier profile unavailable');
  return {user_id:p.user_id,role:p.role,active:p.active,store_code:p.store_code};
 };
 return {async authorize(input,token){
  const adapter=createAuthorizationAdapter({...readers,getIdentity:()=>getIdentity(token)});
  return adapter(input);
 }};
}
module.exports={createBirchAuthorization};
