/* FEASTERVILLE V72 — COST OF SALES / GROSS PROFIT LAYER
   Additive only: does not change sales capture, stock receipts, count sheet,
   stock ledger, reconciliation, cash-up, or existing expense capture. */
(function(){
'use strict';
if(window.__fvCogsPlV72)return; window.__fvCogsPlV72=true;

const BASE='https://sflyjcgbxbcwspfuzone.supabase.co/rest/v1';
const KEY='sb_publishable_iASq-tni6KYrFK0R2S35zA_mpwt4MqM';
const U=()=>window.inventorySessionUser||window.currentUser||window.salesSessionUser||{};
const tok=()=>sessionStorage.getItem('feastervilleCloudAccessToken')||localStorage.getItem('feastervilleCloudAccessToken')||'';
const money=n=>'R'+Number(n||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v||0);
function day(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function monthStart(){return day().slice(0,8)+'01'}
async function api(path){
  const r=await fetch(BASE+'/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+tok()}});
  const t=await r.text(); if(!r.ok)throw Error(t||('HTTP '+r.status)); return t?JSON.parse(t):[];
}
function sum(a,k){return (a||[]).reduce((x,r)=>x+num(r[k]),0)}
function chunks(a,n){const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out}
async function saleItemsFor(sales){
  const ids=[...new Set((sales||[]).map(x=>Number(x.id)).filter(Number.isFinite))];
  const out=[];
  for(const part of chunks(ids,250)){
    if(!part.length)continue;
    const rows=await api('pos_sale_items?select=sale_id,code,name,qty,price&sale_id=in.('+part.join(',')+')');
    out.push(...(rows||[]));
  }
  return out;
}
async function storeCostData(store,to){
  const st=encodeURIComponent(store);
  const [recipes,receipts,direct]=await Promise.all([
    api('pos_store_product_recipes?store_code=eq.'+st+'&select=product_code,recipe'),
    api('pos_stock_receipts?store_code=eq.'+st+'&receipt_date=lte.'+encodeURIComponent(to)+'&unit_cost=gt.0&qty=gt.0&select=input_code,qty,unit_cost,receipt_date'),
    api('pos_direct_product_costs?store_code=eq.'+st+'&effective_date=lte.'+encodeURIComponent(to)+'&select=product_code,cost_per_unit,effective_date&order=effective_date.desc')
  ]);
  const recipeMap={}; (recipes||[]).forEach(r=>recipeMap[r.product_code]=Array.isArray(r.recipe)?r.recipe:[]);
  const acc={}; (receipts||[]).forEach(r=>{const c=r.input_code;if(!c)return;const q=num(r.qty),uc=num(r.unit_cost);if(q>0&&uc>0){if(!acc[c])acc[c]={qty:0,cost:0};acc[c].qty+=q;acc[c].cost+=q*uc;}});
  const inputCost={}; Object.keys(acc).forEach(c=>inputCost[c]=acc[c].qty>0?acc[c].cost/acc[c].qty:0);
  const directMap={}; (direct||[]).forEach(r=>{if(directMap[r.product_code]==null&&num(r.cost_per_unit)>0)directMap[r.product_code]=num(r.cost_per_unit)});
  return {recipeMap,inputCost,directMap};
}
async function calculateCogs(sales,to){
  const items=await saleItemsFor(sales);
  const saleStore={}; (sales||[]).forEach(s=>saleStore[s.id]=String(s.store_code||'').toUpperCase());
  const stores=[...new Set(Object.values(saleStore).filter(Boolean))];
  const data={}; for(const s of stores)data[s]=await storeCostData(s,to);
  const totals={}; stores.forEach(s=>totals[s]={cogs:0,missingLines:0,costedLines:0});
  const missing=[];
  for(const it of items){
    const store=saleStore[it.sale_id]; if(!store||!data[store])continue;
    const qty=num(it.qty); if(!(qty>0))continue;
    const code=it.code, d=data[store], recipe=d.recipeMap[code]||[];
    let perUnit=0, lineMissing=false;
    if(recipe.length){
      for(const part of recipe){
        const ic=part.inputCode||part.input_code, rq=num(part.qty);
        const uc=num(d.inputCost[ic]);
        if(!(rq>0))continue;
        if(!(uc>0)){lineMissing=true;missing.push(store+' '+code+': missing cost for '+ic);continue;}
        perUnit+=rq*uc;
      }
    }else if(num(d.directMap[code])>0){
      perUnit=num(d.directMap[code]);
    }else{
      lineMissing=true; missing.push(store+' '+code+': no recipe/direct cost');
    }
    totals[store].cogs+=qty*perUnit;
    if(lineMissing)totals[store].missingLines++; else totals[store].costedLines++;
  }
  return {totals,missing:[...new Set(missing)],itemLines:items.length};
}
function ensurePlCards(){
  if(document.getElementById('plCOGS'))return;
  const grid=document.querySelector('#plPrintArea .inv-grid'); if(!grid)return;
  const exp=document.getElementById('plExpenses')?.closest('.inv-card');
  const c=document.createElement('div');c.className='inv-card';c.innerHTML='Cost of Sales (COGS)<br><b id="plCOGS">R0.00</b>';
  const g=document.createElement('div');g.className='inv-card';g.innerHTML='Gross Profit<br><b id="plGross">R0.00</b>';
  if(exp){grid.insertBefore(c,exp);grid.insertBefore(g,exp);}else{grid.append(c,g)}
}
function setText(id,v){const e=document.getElementById(id);if(e)e.textContent=money(v)}
function warnText(c){return c.missing.length?' Cost warning: '+c.missing.length+' product/input costing gap(s); COGS may be understated.':''}

async function loadPLV72(){
  if(U().role!=='manager'||!tok())return;
  ensurePlCards();
  const st=document.getElementById('plStore')?.value||'ALL',from=document.getElementById('plFrom')?.value,to=document.getElementById('plTo')?.value,status=document.getElementById('plStatus');
  if(!from||!to)return alert('Select From Date and To Date.'); if(from>to)return alert('From Date cannot be after To Date.');
  if(status)status.textContent='Loading Profit & Loss with Cost of Sales...';
  try{
    const sf=st==='ALL'?'':'&store_code=eq.'+encodeURIComponent(st);
    const [sales,other,exp]=await Promise.all([
      api('pos_sales?select=id,store_code,total,sale_date&sale_date=gte.'+from+'&sale_date=lte.'+to+sf),
      api('pos_other_income?select=store_code,amount,category,transaction_date&transaction_date=gte.'+from+'&transaction_date=lte.'+to+sf),
      api('pos_store_expenses?select=store_code,amount,category,expense_date&expense_date=gte.'+from+'&expense_date=lte.'+to+sf)
    ]);
    const c=await calculateCogs(sales,to);
    const cogs=Object.values(c.totals).reduce((a,x)=>a+num(x.cogs),0);
    const salesTotal=sum(sales,'total'),otherTotal=sum(other,'amount'),income=salesTotal+otherTotal,gross=salesTotal-cogs,expenses=sum(exp,'amount'),net=gross+otherTotal-expenses;
    setText('plSales',salesTotal);setText('plOtherIncome',otherTotal);setText('plIncome',income);setText('plCOGS',cogs);setText('plGross',gross);setText('plExpenses',expenses);
    const ne=document.getElementById('plNet');if(ne){ne.textContent=money(net);ne.style.color=net<0?'#b00020':'#176b2c'};
    const ge=document.getElementById('plGross');if(ge)ge.style.color=gross<0?'#b00020':'#176b2c';
    const by={};(exp||[]).forEach(x=>{const k=x.category||'Other Expenses';by[k]=(by[k]||0)+num(x.amount)});
    const expenseLines=Object.keys(by).sort().map(k=>'<tr><td>&nbsp;&nbsp;'+esc(k)+'</td><td style="text-align:right">'+money(by[k])+'</td></tr>').join('')||'<tr><td>&nbsp;&nbsp;No operating expenses captured</td><td style="text-align:right">R0.00</td></tr>';
    document.getElementById('plStatementRows').innerHTML=
      '<tr><td>POS Sales</td><td style="text-align:right">'+money(salesTotal)+'</td></tr>'+ 
      '<tr><td><b>Less: Cost of Sales</b></td><td style="text-align:right"><b>'+money(cogs)+'</b></td></tr>'+ 
      '<tr><td><b>GROSS PROFIT</b></td><td style="text-align:right"><b>'+money(gross)+'</b></td></tr>'+ 
      '<tr><td>Other Income</td><td style="text-align:right">'+money(otherTotal)+'</td></tr>'+ 
      '<tr><td colspan="2"><b>Less: Operating Expenses</b></td></tr>'+expenseLines+
      '<tr><td><b>Total Operating Expenses</b></td><td style="text-align:right"><b>'+money(expenses)+'</b></td></tr>'+ 
      '<tr><td><b>NET '+(net<0?'LOSS':'PROFIT')+'</b></td><td style="text-align:right"><b>'+money(net)+'</b></td></tr>';
    document.getElementById('plExpenseRows').innerHTML=Object.keys(by).sort((a,b)=>by[b]-by[a]).map(k=>'<tr><td>'+esc(k)+'</td><td style="text-align:right">'+money(by[k])+'</td><td style="text-align:right">'+(expenses?((by[k]/expenses)*100).toFixed(1):'0.0')+'%</td></tr>').join('')||'<tr><td colspan="3">No operating expenses captured for this period.</td></tr>';
    if(status)status.textContent=(st==='ALL'?'All Stores':st)+' — '+from+' to '+to+' — '+sales.length+' completed sale(s).'+warnText(c);
  }catch(e){console.error(e);if(status)status.textContent='Could not load COGS Profit & Loss: '+e.message}
}

async function loadComparisonV72(){
  if(U().role!=='manager'||!tok())return;
  const from=document.getElementById('scFrom')?.value,to=document.getElementById('scTo')?.value,status=document.getElementById('scStatus');
  if(!from||!to)return alert('Select From Date and To Date.'); if(from>to)return alert('From Date cannot be after To Date.');
  if(status)status.textContent='Loading store comparison with Cost of Sales...';
  try{
    const [sales,other,exp]=await Promise.all([
      api('pos_sales?select=id,store_code,total,sale_date&sale_date=gte.'+from+'&sale_date=lte.'+to+'&store_code=in.(NDAYENI,SIVANA)'),
      api('pos_other_income?select=store_code,amount,category,transaction_date&transaction_date=gte.'+from+'&transaction_date=lte.'+to+'&store_code=in.(NDAYENI,SIVANA)'),
      api('pos_store_expenses?select=store_code,amount,category,expense_date&expense_date=gte.'+from+'&expense_date=lte.'+to+'&store_code=in.(NDAYENI,SIVANA)')
    ]);
    const c=await calculateCogs(sales,to);
    const blank=()=>({sales:0,other:0,cogs:0,gross:0,expenses:0,net:0,count:0,expBy:{}}),d={NDAYENI:blank(),SIVANA:blank()};
    sales.forEach(x=>{const s=String(x.store_code||'').toUpperCase();if(d[s]){d[s].sales+=num(x.total);d[s].count++}});
    other.forEach(x=>{const s=String(x.store_code||'').toUpperCase();if(d[s])d[s].other+=num(x.amount)});
    exp.forEach(x=>{const s=String(x.store_code||'').toUpperCase();if(d[s]){d[s].expenses+=num(x.amount);const k=x.category||'Other Expenses';d[s].expBy[k]=(d[s].expBy[k]||0)+num(x.amount)}});
    Object.keys(d).forEach(s=>{d[s].cogs=num(c.totals[s]?.cogs);d[s].gross=d[s].sales-d[s].cogs;d[s].net=d[s].gross+d[s].other-d[s].expenses});
    const n=d.NDAYENI,v=d.SIVANA,t={};['sales','other','cogs','gross','expenses','net','count'].forEach(k=>t[k]=num(n[k])+num(v[k]));
    const rows=[['POS Sales',n.sales,v.sales,t.sales],['Cost of Sales',n.cogs,v.cogs,t.cogs],['GROSS PROFIT',n.gross,v.gross,t.gross],['Other Income',n.other,v.other,t.other],['Operating Expenses',n.expenses,v.expenses,t.expenses],['NET PROFIT / (LOSS)',n.net,v.net,t.net]];
    document.getElementById('scComparisonRows').innerHTML=rows.map((r,i)=>'<tr'+([2,5].includes(i)?' style="font-weight:bold"':'')+'><td>'+r[0]+'</td><td style="text-align:right">'+money(r[1])+'</td><td style="text-align:right">'+money(r[2])+'</td><td style="text-align:right">'+money(r[3])+'</td></tr>').join('');
    [['scNdayeniNet',n.net],['scSivanaNet',v.net],['scFinalNet',t.net]].forEach(([id,val])=>{const e=document.getElementById(id);if(e){e.textContent=money(val);e.style.color=val<0?'#b00020':'#176b2c'}});
    const me=document.getElementById('scFinalMargin');if(me){const margin=t.sales>0?t.net/t.sales*100:0;me.textContent=margin.toFixed(1)+'%';me.style.color=margin<0?'#b00020':'#176b2c'}
    const cats=[...new Set([...Object.keys(n.expBy),...Object.keys(v.expBy)])].sort((a,b)=>((n.expBy[b]||0)+(v.expBy[b]||0))-((n.expBy[a]||0)+(v.expBy[a]||0)));
    document.getElementById('scExpenseRows').innerHTML=cats.map(k=>'<tr><td>'+esc(k)+'</td><td style="text-align:right">'+money(n.expBy[k]||0)+'</td><td style="text-align:right">'+money(v.expBy[k]||0)+'</td><td style="text-align:right">'+money((n.expBy[k]||0)+(v.expBy[k]||0))+'</td></tr>').join('')||'<tr><td colspan="4">No operating expenses captured.</td></tr>';
    const expLines=cats.map(k=>'<tr><td>&nbsp;&nbsp;'+esc(k)+'</td><td style="text-align:right">'+money((n.expBy[k]||0)+(v.expBy[k]||0))+'</td></tr>').join('')||'<tr><td>&nbsp;&nbsp;No operating expenses captured</td><td style="text-align:right">R0.00</td></tr>';
    const fr=document.getElementById('scFinalRows');if(fr)fr.innerHTML=
      '<tr><td>Total POS Sales — Both Stores</td><td style="text-align:right">'+money(t.sales)+'</td></tr>'+ 
      '<tr><td><b>Less: Cost of Sales</b></td><td style="text-align:right"><b>'+money(t.cogs)+'</b></td></tr>'+ 
      '<tr><td><b>FEASTERVILLE GROSS PROFIT</b></td><td style="text-align:right"><b>'+money(t.gross)+'</b></td></tr>'+ 
      '<tr><td>Other Income — Both Stores</td><td style="text-align:right">'+money(t.other)+'</td></tr>'+ 
      '<tr><td colspan="2"><b>LESS: OPERATING EXPENSES</b></td></tr>'+expLines+
      '<tr><td><b>TOTAL OPERATING EXPENSES</b></td><td style="text-align:right"><b>'+money(t.expenses)+'</b></td></tr>'+ 
      '<tr><td><b>FINAL FEASTERVILLE '+(t.net<0?'LOSS':'PROFIT')+'</b></td><td style="text-align:right"><b>'+money(t.net)+'</b></td></tr>';
    if(status)status.textContent='Ndayeni vs Sivana — '+from+' to '+to+' — '+t.count+' completed sale(s) combined.'+warnText(c);
  }catch(e){console.error(e);if(status)status.textContent='Could not load COGS store comparison: '+e.message}
}

function install(){
  ensurePlCards();
  const pr=document.getElementById('plRefreshBtn'),pm=document.getElementById('plThisMonthBtn');
  if(pr)pr.onclick=loadPLV72;
  if(pm)pm.onclick=()=>{const f=document.getElementById('plFrom'),t=document.getElementById('plTo');if(f)f.value=monthStart();if(t)t.value=day();loadPLV72()};
  const sr=document.getElementById('scRefreshBtn'),sm=document.getElementById('scThisMonthBtn');
  if(sr)sr.onclick=loadComparisonV72;
  if(sm)sm.onclick=()=>{const f=document.getElementById('scFrom'),t=document.getElementById('scTo');if(f)f.value=monthStart();if(t)t.value=day();loadComparisonV72()};
  window.loadProfitLossV72=loadPLV72; window.loadProfitLossV48=loadPLV72;
  window.loadStoresComparisonV72=loadComparisonV72; window.loadStoresComparisonV49=loadComparisonV72;
}
setTimeout(install,1200);
document.addEventListener('click',e=>{
  const target=e.target?.dataset?.managerTarget||'';
  if(target==='profitLossPanel')setTimeout(()=>{install();loadPLV72()},250);
  if(target==='storesComparisonPanel')setTimeout(()=>{install();loadComparisonV72()},250);
},true);
})();
