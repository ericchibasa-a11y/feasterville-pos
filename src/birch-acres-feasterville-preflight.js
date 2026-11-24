'use strict';
// Server-only Feasterville Birch Acres sale preflight.
// Feasterville recipes consume production inputs; this module does not alter stock.
const money=n=>{if(typeof n!=='number'&&!/^\\d+(?:\\.\\d{1,2})?$/.test(String(n)))throw Error('Invalid catalog price');const v=Number(n);if(!Number.isFinite(v)||v<0||Math.round(v*100)!==v*100)throw Error('Invalid catalog price');return Math.round(v*100)};
function prepareFeastervilleSale(lines,catalog){
 if(!Array.isArray(lines)||!lines.length)throw Error('Missing Feasterville items');
 if(!Array.isArray(catalog))throw Error('Missing catalog');
 const products=new Map(catalog.filter(p=>p.store_code==='BIRCH_ACRES'&&p.active===true).map(p=>[String(p.code),p]));
 let total=0;
 const items=lines.map(line=>{
  if(line.company!=='feasterville'||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>10000)throw Error('Invalid Feasterville quantity/company');
  const p=products.get(String(line.product_id));
  if(!p)throw Error('Product unavailable at Birch Acres');
  const price=money(p.price);total+=price*line.quantity;
  if(!Number.isSafeInteger(total))throw Error('Sale exceeds safe amount');
  return {code:String(p.code),name:String(p.name),category:p.category||null,qty:line.quantity,price:price/100};
 });
 if(total<=0)throw Error('Zero-value Feasterville sale');
 return {store_code:'BIRCH_ACRES',items,total_amount:total/100};
}
module.exports={prepareFeastervilleSale};
