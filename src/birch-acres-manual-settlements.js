'use strict';
// Manager-only service logic for manual bank transfers. Does not move money.
// A trusted backend MUST authenticate manager, persist transfer IDs uniquely,
// and lock the payable while recording payments atomically.
const cents=value=>{
 if(typeof value!=='number'||!Number.isFinite(value)||value<=0||Math.abs(value*100-Math.round(value*100))>1e-7)throw Error('Invalid transfer amount');
 return Math.round(value*100);
};
function validateTransfer(input){
 if(!input||input.store_code!=='BIRCH_ACRES'||input.from_company!=='feasterville'||input.to_company!=='noshville')throw Error('Invalid intercompany direction');
 if(typeof input.reference!=='string'||!input.reference.trim()||input.reference.length>120)throw Error('Bank transfer reference required');
 if(typeof input.transfer_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.transfer_date)||Number.isNaN(Date.parse(input.transfer_date+'T00:00:00Z')))throw Error('Valid transfer date required');
 if(typeof input.recorded_by!=='string'||!input.recorded_by.trim())throw Error('Verified manager required');
 return Object.freeze({store_code:'BIRCH_ACRES',from_company:'feasterville',to_company:'noshville',amount:cents(input.amount)/100,reference:input.reference.trim(),transfer_date:input.transfer_date,recorded_by:input.recorded_by});
}
function settlementBalance(records,transfers){
 if(!Array.isArray(records)||!Array.isArray(transfers))throw Error('Missing settlement records');
 const seenCheckouts=new Set(),seenTransfers=new Set();
 let due=0,paid=0;
 for(const r of records){
  if(!r||typeof r.checkout_id!=='string'||seenCheckouts.has(r.checkout_id))throw Error('Duplicate or invalid checkout');
  seenCheckouts.add(r.checkout_id);
  if(typeof r.due_to_noshville!=='number'||r.due_to_noshville<0||!Number.isInteger(Math.round(r.due_to_noshville*100))||Math.abs(r.due_to_noshville*100-Math.round(r.due_to_noshville*100))>1e-7)throw Error('Invalid payable');
  due+=Math.round(r.due_to_noshville*100);
 }
 for(const t of transfers){
  const v=validateTransfer(t);
  const key=v.reference.toLowerCase();
  if(seenTransfers.has(key))throw Error('Duplicate bank transfer reference');
  seenTransfers.add(key);
  paid+=cents(v.amount);
 }
 if(paid>due)throw Error('Transfer exceeds outstanding intercompany payable');
 return Object.freeze({due:due/100,paid:paid/100,outstanding:(due-paid)/100,status:due===paid?'settled':paid===0?'unpaid':'partially_settled'});
}
module.exports={validateTransfer,settlementBalance};
