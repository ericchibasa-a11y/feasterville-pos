'use strict';
// Read-only, server-side Noshville sale preparation. Never accept browser prices.
// Caller must execute atomic SQL posting and re-check stock under row locks.
const cents=n=>{const v=Number(n);if(!Number.isFinite(v)||v<0)throw Error('Invalid amount');return Math.round((v+Number.EPSILON)*100)};
function prepareNoshvilleSale(lines,products){
 if(!Array.isArray(lines)||!lines.length)throw Error('Missing sale lines');
 const byId=new Map(products.map(p=>[String(p.id),p]));
 const requirements=new Map(),items=[];
 for(const line of lines){
  if(line.company!=='noshville'||!Number.isInteger(line.quantity)||line.quantity<=0)throw Error('Invalid Noshville line');
  const p=byId.get(String(line.product_id));
  if(!p||p.is_active!==true||p.sellable_active===false)throw Error('Product unavailable');
  const price=cents(p.selling_price),cost=cents(p.cost_price||0);
  const parent=p.stock_parent_product_id?byId.get(String(p.stock_parent_product_id)):null;
  if(p.stock_parent_product_id&&!parent)throw Error('Missing linked stock parent');
  const tracked=parent||p.track_stock===true?p:null;
  const stockProduct=parent||tracked;
  const multiplier=parent?Number(p.stock_multiplier):1;
  if(stockProduct){
   if(!Number.isFinite(multiplier)||multiplier<=0)throw Error('Invalid stock multiplier');
   const id=String(stockProduct.id);
   requirements.set(id,(requirements.get(id)||0)+line.quantity*multiplier);
  }
  items.push({product_id:String(p.id),description:p.name,quantity:line.quantity,unit_price:price/100,unit_cost:cost/100,line_total:price*line.quantity/100,line_cost:cost*line.quantity/100});
 }
 for(const [id,qty] of requirements){const p=byId.get(id);if(!p||Number(p.stock_qty)<qty)throw Error('Insufficient stock: '+id)}
 return {items,total_amount:items.reduce((s,i)=>s+Math.round(i.line_total*100),0)/100,stock_requirements:[...requirements].map(([product_id,quantity])=>({product_id,quantity})).sort((a,b)=>a.product_id.localeCompare(b.product_id))};
}
module.exports={prepareNoshvilleSale};
