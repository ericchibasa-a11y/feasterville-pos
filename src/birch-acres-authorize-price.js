'use strict';
// Server-only authorization and pricing adapter. Supabase clients must be
// instantiated with server-held credentials, NEVER exposed to a browser.
// getIdentity must verify the presented token with Feasterville Auth.
// getProducts must read authoritative current prices from each company DB.
const crypto=require('node:crypto');
const {prepareFeastervilleSale}=require('./birch-acres-feasterville-preflight.js');
const {prepareNoshvilleSale}=require('./birch-acres-noshville-preflight.js');
function createAuthorizationAdapter({getIdentity,getFeastervilleCatalog,getNoshvilleProducts}){
 for(const fn of [getIdentity,getFeastervilleCatalog,getNoshvilleProducts])if(typeof fn!=='function')throw Error('Missing trusted dependency');
 return async function authorizeAndPrice(input){
  const identity=await getIdentity();
  if(!identity||identity.active!==true||identity.store_code!=='BIRCH_ACRES'||!['manager','salesperson'].includes(String(identity.role).toLowerCase()))throw Error('Cashier not authorized for Birch Acres');
  if(!input||input.store_code!=='BIRCH_ACRES'||!Array.isArray(input.items)||!input.items.length)throw Error('Invalid basket');
  const fvLines=input.items.filter(x=>x.company==='feasterville'),nvLines=input.items.filter(x=>x.company==='noshville');
  if(fvLines.length+nvLines.length!==input.items.length)throw Error('Unknown company');
  const fv=fvLines.length?prepareFeastervilleSale(fvLines,await getFeastervilleCatalog()):{total_amount:0,items:[]};
  const nv=nvLines.length?prepareNoshvilleSale(nvLines,await getNoshvilleProducts()):{total_amount:0};
  // Reject manipulated browser prices and tender amounts before creating a job.
  const trustedPrices=new Map();
  for(const line of fvLines){const item=fv.items.find(x=>x.code===String(line.product_id));if(!item)throw Error('Feasterville price unavailable');trustedPrices.set('feasterville:'+line.product_id,item.price);}
  for(const item of nv.items){trustedPrices.set('noshville:'+item.product_id,item.unit_price);}
  for(const line of input.items){
   const price=trustedPrices.get(line.company+':'+line.product_id);
   if(typeof line.unit_price!=='number'||Math.round(line.unit_price*100)!==Math.round(price*100))throw Error('Browser price differs from catalog');
  }
  const cash=input.tender?.cash,card=input.tender?.card;
  if(typeof cash!=='number'||typeof card!=='number'||!Number.isFinite(cash)||!Number.isFinite(card)||cash<0||card<0||Math.round((cash+card)*100)!==Math.round((fv.total_amount+nv.total_amount)*100))throw Error('Tender differs from catalog total');
  const canonical={store_code:'BIRCH_ACRES',checkout_id:input.checkout_id,cashier_id:String(identity.user_id),items:input.items.map(x=>({company:x.company,product_id:String(x.product_id),quantity:x.quantity})),feasterville_amount:fv.total_amount,noshville_amount:nv.total_amount,tender:input.tender};
  const request_hash=crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return {authorized:true,store_code:'BIRCH_ACRES',feasterville_amount:fv.total_amount,noshville_amount:nv.total_amount,total_amount:Math.round((fv.total_amount+nv.total_amount)*100)/100,request_hash,cashier_id:String(identity.user_id)};
 };
}
module.exports={createAuthorizationAdapter};
