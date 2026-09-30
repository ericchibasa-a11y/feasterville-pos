/* Shared read-only report calculations, V108. */
(function(root){
'use strict';
const n=v=>Number(v)||0;
function intendedCount(r){return !!r&&(r.counted_by||n(r.physical_count)!==0||(r.notes&&/count|physical|stocktake/i.test(r.notes)))}
function closeOf(r){if(!r)return 0;return intendedCount(r)?n(r.physical_count):(n(r.opening_qty)+n(r.received_qty)-n(r.used_qty))}
function isInventoryPurchaseExpense(e){const c=String(e?.category||'').toLowerCase(),d=String(e?.description||'').toLowerCase();return /stock|ingredient|inventory|production input|raw material/.test(c)||/stock purchase|ingredient purchase|production input|raw material/.test(d)}
function isInternalTransfer(r){return String(r.supplier||'').toUpperCase().startsWith('INTERNAL TRANSFER')||String(r.reference||'').toUpperCase().startsWith('TRF-')}
function weightedCost(receipts,store,code,end,preferred){let q=0,v=0;for(const r of receipts){if(r.store_code!==store||r.input_code!==code||String(r.receipt_date)>end)continue;const rq=n(r.qty),uc=n(r.unit_cost);if(rq>0&&uc>0){q+=rq;v+=rq*uc}}return q>0?v/q:n(preferred)}
async function fetchAll(request,path,size=1000){
 const out=[];
 for(let offset=0;;){
  const rows=await request(path+(path.includes('?')?'&':'?')+'limit='+size+'&offset='+offset);
  if(!Array.isArray(rows))throw Error('Unexpected report response.');
  out.push(...rows);
  if(!rows.length)return out;
  offset+=rows.length;
  if(offset>200000)throw Error('Report is too large. Please use a shorter date range.');
 }
}
function buildInputs(inputs,counts,receipts,from,to){
  const inputRows=[];let missingReceiptCosts=0;const missingIssues=[];
  for(const m of inputs){const cs=counts.filter(c=>c.store_code===m.store_code&&c.input_code===m.code).sort((a,b)=>String(a.count_date).localeCompare(String(b.count_date)));const pc=cs.filter(c=>c.count_date>=from&&c.count_date<=to);const used=pc.reduce((a,c)=>a+n(c.used_qty),0);const days=new Set(pc.filter(c=>n(c.used_qty)>0).map(c=>c.count_date)).size;const latest=[...cs].filter(c=>c.count_date<=to).pop();const expected=closeOf(latest);const cost=weightedCost(receipts,m.store_code,m.code,to,m.preferred_unit_cost);const endCount=[...pc].filter(c=>c.count_date===to&&intendedCount(c)).pop();const endExpected=endCount?n(endCount.opening_qty)+n(endCount.received_qty)-n(endCount.used_qty):null;const endVarQty=endCount?(endCount.variance_qty!=null?n(endCount.variance_qty):n(endCount.physical_count)-endExpected):null;const endVarCost=endCount?(-endVarQty*cost):0;const periodReceipts=receipts.filter(r=>r.store_code===m.store_code&&r.input_code===m.code&&r.receipt_date>=from&&r.receipt_date<=to);const zeroCostReceipts=periodReceipts.filter(r=>!isInternalTransfer(r)&&n(r.qty)>0&&!(n(r.unit_cost)>0)).length;missingReceiptCosts+=zeroCostReceipts;const movement=Math.abs(used)+Math.abs(expected)+periodReceipts.reduce((a,r)=>a+Math.abs(n(r.qty)),0);const missingBasis=cost<=0&&movement>0;if(zeroCostReceipts)missingIssues.push({store:m.store_code,code:m.code,name:m.name,issue:zeroCostReceipts+' receipt(s) have quantity but no cost'});if(missingBasis)missingIssues.push({store:m.store_code,code:m.code,name:m.name,issue:'No usable cost basis for stock/usage'});inputRows.push({...m,used,days,expected,cost,consumptionCost:used*cost,endCount:!!endCount,endVarQty,endVarCost,zeroCostReceipts,missingBasis})}

 return {inputRows,missingReceiptCosts,missingIssues};
}
function costOfSales(rows){return Math.max(0,rows.reduce((a,x)=>a+n(x.consumptionCost)+n(x.endVarCost),0))}
function summarize(stores,sales,other,expenses,inputRows){
 const operatingExpenses=expenses.filter(e=>!isInventoryPurchaseExpense(e));
 const metrics=stores.map(store=>{
  const ss=sales.filter(x=>x.store_code===store),ii=inputRows.filter(x=>x.store_code===store);
  const sv=ss.reduce((a,x)=>a+n(x.total),0),cogs=costOfSales(ii),oi=other.filter(x=>x.store_code===store).reduce((a,x)=>a+n(x.amount),0),oe=operatingExpenses.filter(x=>x.store_code===store).reduce((a,x)=>a+n(x.amount),0);
  return {store,sales:sv,count:ss.length,other:oi,income:sv+oi,cogs,gross:sv-cogs,expenses:oe,net:sv-cogs+oi-oe};
 });
 const total={};for(const k of ['sales','count','other','income','cogs','gross','expenses','net'])total[k]=metrics.reduce((a,x)=>a+x[k],0);
 return {metrics,total,operatingExpenses};
}
const api={fetchAll,buildInputs,costOfSales,summarize,isInventoryPurchaseExpense};
root.FeastervilleFinance=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
