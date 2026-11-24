/* Birch Acres reporting: daily/weekly/monthly comparisons from verified coordinator records.
 * Pure functions only. Data must be fetched by an authenticated manager-only backend. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BirchAcresTrends=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function cents(value){const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Invalid money');return Math.round((n+Number.EPSILON)*100);}
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Invalid business date');const d=new Date(value+'T12:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Invalid business date');return value;}
function datePlus(value,delta){const d=new Date(day(value)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
function startOfWeek(value){const d=new Date(day(value)+'T12:00:00Z');return datePlus(value,-((d.getUTCDay()+6)%7));}
function monthStart(value){return day(value).slice(0,7)+'-01';}
function previousMonthStart(value){return datePlus(monthStart(value),-1).slice(0,7)+'-01';}
function sum(rows,from,to){
 const result={feasterville:0,noshville:0,combined:0,transactions:0,exceptions:0};const seen=new Set();
 for(const r of rows){
  if(!r.checkout_id||seen.has(r.checkout_id))throw Error('Duplicate or missing checkout reference');seen.add(r.checkout_id);
  const d=day(r.business_date);if(d<from||d>to)continue;
  if(r.status!=='completed'){result.exceptions++;continue;}
  const f=cents(r.feasterville_amount),n=cents(r.noshville_amount);
  if(cents(r.total_amount)!==f+n)throw Error('Company allocation mismatch');
  result.feasterville+=f;result.noshville+=n;result.transactions++;
 }
 result.combined=(result.feasterville+result.noshville)/100;result.feasterville/=100;result.noshville/=100;return result;
}
function compare(rows,businessDate){
 const d=day(businessDate),week=startOfWeek(d),month=monthStart(d);
 const priorWeek=datePlus(week,-7),priorMonth=previousMonthStart(d);
 const dayOfMonth=Number(d.slice(8)),priorEnd=datePlus(priorMonth,dayOfMonth-1);
 const priorMonthLast=datePlus(month,-1);const cappedPriorEnd=priorEnd>priorMonthLast?priorMonthLast:priorEnd;
 return {daily:{current:sum(rows,d,d),previous:sum(rows,datePlus(d,-1),datePlus(d,-1))},
 weekly:{current:sum(rows,week,d),previous:sum(rows,priorWeek,datePlus(priorWeek,6))},
 monthly:{current:sum(rows,month,d),previous:sum(rows,priorMonth,cappedPriorEnd)}};
}
return Object.freeze({sum,compare});
});
