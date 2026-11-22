/* Read-only adapters for the verified Feasterville and Noshville sale schemas.
 * Inputs must come from a trusted, manager-authorized backend. No credentials or DB calls. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BirchAcresAdapters=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function money(x){const n=Number(x);if(!Number.isFinite(n)||n<0)throw Error('Invalid sale amount');return Math.round((n+Number.EPSILON)*100)/100;}
function feasterville(row){if(row.id==null||!/^\d{4}-\d{2}-\d{2}$/.test(String(row.sale_date)))throw Error('Invalid Feasterville sale');return {company:'feasterville',source_id:String(row.id),store_code:row.store_code||null,business_date:row.sale_date,amount:money(row.total),payment:row.payment||null,cash_amount:row.cash_amount==null?null:money(row.cash_amount),card_amount:row.card_amount==null?null:money(row.card_amount)};}
function noshville(row){if(!row.id||!row.sale_date||!Number.isFinite(Date.parse(row.sale_date)))throw Error('Invalid Noshville sale');return {company:'noshville',source_id:String(row.id),business_date:row.sale_date.slice(0,10),amount:money(row.total_amount),payment:row.payment_method||null,status:row.status||null};}
function aggregate(sales,{from,to,store_code}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Invalid date range');
 const result={feasterville:0,noshville:0,combined:0,transactions:0,excluded:0};const seen=new Set();
 for(const row of sales){const key=row.company+':'+row.source_id;if(seen.has(key))throw Error('Duplicate source sale');seen.add(key);
 if(row.business_date<from||row.business_date>to)continue;
 if(row.company==='feasterville'){if(store_code&&row.store_code!==store_code)continue;}
 else if(row.company==='noshville'){if(row.status&&String(row.status).toLowerCase()!=='completed'){result.excluded++;continue;}}
 else throw Error('Unknown company');
 result[row.company]=money(result[row.company]+money(row.amount));result.transactions++;
 }
 result.combined=money(result.feasterville+result.noshville);return result;
}
return Object.freeze({feasterville,noshville,aggregate});
});
