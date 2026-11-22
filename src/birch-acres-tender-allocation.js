'use strict';
// Allocates a single verified tender between legally separate companies.
// All calculations use integer cents; card proceeds held by Feasterville
// attributable to Noshville create an intercompany payable, NOT revenue.
const toCents=n=>{if(typeof n!=='number'||!Number.isFinite(n)||n<0||Math.abs(Math.round(n*100)-n*100)>1e-7)throw Error('Invalid currency amount');return Math.round(n*100)};
const rand=n=>n/100;
function allocate(t){
 const fv=toCents(t.feasterville_amount),nv=toCents(t.noshville_amount),cash=toCents(t.cash_amount),card=toCents(t.card_amount);
 const total=fv+nv;
 if(!Number.isSafeInteger(total)||total===0||cash+card!==total)throw Error('Tender does not match company sales');
 // Allocate cash first to Feasterville, then Noshville; residual is card.
 // This deterministic rule MUST be displayed and approved at checkout.
 const fvCash=Math.min(fv,cash),nvCash=cash-fvCash;
 if(nvCash>nv)throw Error('Invalid cash allocation');
 const fvCard=fv-fvCash,nvCard=nv-nvCash;
 if(fvCard+nvCard!==card)throw Error('Invalid card allocation');
 return Object.freeze({
  feasterville:{revenue:rand(fv),cash:rand(fvCash),card:rand(fvCard)},
  noshville:{revenue:rand(nv),cash:rand(nvCash),card:rand(nvCard)},
  feasterville_payable_to_noshville:rand(nvCard),
  noshville_receivable_from_feasterville:rand(nvCard),
  total:rand(total)
 });
}
module.exports={allocate};
