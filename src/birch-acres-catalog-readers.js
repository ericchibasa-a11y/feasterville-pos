'use strict';
// Read-only trusted Supabase data access for Birch Acres checkout.
// Call only from a server after verifying the cashier's Feasterville JWT.
// Each client is configured server-side with its own project's credentials.
function checked(result,label){if(!result||result.error)throw Error(label+': '+(result?.error?.message||'query failed'));return result.data||[]}
function createCatalogReaders({feasterville,noshville}){
 if(!feasterville?.from||!noshville?.from)throw Error('Missing server Supabase clients');
 return {
  getFeastervilleCatalog:async()=>{
   const q=await feasterville.from('pos_store_products').select('store_code,code,name,category,price,active').eq('store_code','BIRCH_ACRES').eq('active',true);
   return checked(q,'Feasterville catalog');
  },
  getNoshvilleProducts:async()=>{
   // Includes stock parents needed to verify loose-unit stock consumption.
   const q=await noshville.from('products').select('id,name,is_active,sellable_active,track_stock,stock_qty,stock_parent_product_id,stock_multiplier,selling_price,cost_price');
   return checked(q,'Noshville products');
  }
 };
}
module.exports={createCatalogReaders};
