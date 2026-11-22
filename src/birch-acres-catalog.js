'use strict';
// Pure read-only product normalization. Source records must be loaded from
// trusted backend adapters; checkout prices MUST be re-validated server-side.
function money(n){const x=Number(n);if(!Number.isFinite(x)||x<0)throw Error('Invalid product price');return Math.round((x+Number.EPSILON)*100)/100}
function noshvilleProducts(rows){if(!Array.isArray(rows))throw Error('Expected products array');return rows.filter(p=>p.is_active===true&&p.sellable_active!==false).map(p=>({company:'noshville',product_id:String(p.id),sku:p.sku||'',name:p.name,brand:p.brand||'',unit_price:money(p.selling_price),stock_qty:Number(p.stock_qty||0),track_stock:p.track_stock===true}));}
function feastervilleProducts(rows){if(!Array.isArray(rows))throw Error('Expected products array');return rows.filter(p=>p&&p.active!==false).map(p=>({company:'feasterville',product_id:String(p.code),sku:String(p.code),name:String(p.name||''),unit_price:money(p.price),stock_qty:null,track_stock:null}));}
module.exports={noshvilleProducts,feastervilleProducts};
