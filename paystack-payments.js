(()=>{
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const user=()=>window.currentUser?.role==='manager'?window.currentUser:(window.salesSessionUser||window.currentUser||{});
const token=()=>sessionStorage.getItem('feastervilleCloudAccessToken')||localStorage.getItem('feastervilleCloudAccessToken')||'';
const names={NDAYENI:'Ndayini',SIVANA:'Sivana',BIRCH_ACRES:'Birch Acres'};
let seq=0;
function mount(){
const role=String(user().role||'').toLowerCase(),allowed=['manager','salesperson'].includes(role)&&!!token();
if($('fvOnlineOpen'))$('fvOnlineOpen').hidden=!allowed;
if(!allowed){if($('fvOnlinePanel'))$('fvOnlinePanel').hidden=true;return;}
if(!$('fvOnlineOpen')){const b=document.createElement('button');b.id='fvOnlineOpen';b.textContent='ONLINE ORDERS / PAYSTACK PAYMENTS';b.onclick=open;($('liveTopBar')||document.querySelector('header')||document.body).appendChild(b);}
if($('fvOnlinePanel'))return;
const p=document.createElement('section');p.id='fvOnlinePanel';p.hidden=true;p.className='panel';p.style.cssText='margin:16px;overflow:auto';
p.innerHTML='<h2>Online Orders / Paystack Payments</h2><p>Confirmed payments received through Paystack. Recording a payment here does not complete a food sale.</p><label>Store <select id="fvOnlineStore"></select></label> <button id="fvOnlineRefresh">REFRESH</button> <button id="fvOnlineClose">CLOSE</button><p id="fvOnlineStatus" role="status"></p><div style="overflow:auto"><table class="inv-table"><thead><tr><th>Paid at</th><th>Order</th><th>Store</th><th>Amount</th><th>Payment</th><th>Order status</th><th>Reference</th><th>Type</th></tr></thead><tbody id="fvOnlineRows"></tbody></table></div>';
document.body.appendChild(p);$('fvOnlineRefresh').onclick=refresh;$('fvOnlineStore').onchange=refresh;$('fvOnlineClose').onclick=()=>{p.hidden=true;seq++};
}
function open(){mount();const p=$('fvOnlinePanel');if(!p)return;const manager=String(user().role).toLowerCase()==='manager';const st=manager?($('storeLocationSelect')?.value||'NDAYENI'):String(user().store_code||'');$('fvOnlineStore').innerHTML=(manager?'<option value="ALL">All Stores</option>':'')+Object.entries(names).filter(([k])=>manager||k===st).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');$('fvOnlineStore').value=st;$('fvOnlineStore').disabled=!manager;p.hidden=false;p.scrollIntoView({behavior:'smooth'});refresh();}
async function refresh(){
const n=++seq,st=$('fvOnlineStore').value;$('fvOnlineRows').innerHTML='';$('fvOnlineStatus').textContent='Loading payments…';
try{if(!token())throw Error('Please sign in again.');if(!st)throw Error('No assigned store. Ask your manager to check your profile.');
let url='https://sflyjcgbxbcwspfuzone.supabase.co/rest/v1/pos_online_orders?select=id,external_order_no,store_code,amount,payment_status,order_status,paystack_reference,paid_at&order=paid_at.desc&limit=200';
if(st!=='ALL')url+='&store_code=eq.'+encodeURIComponent(st);
const r=await fetch(url,{headers:{apikey:'sb_publishable_iASq-tni6KYrFK0R2S35zA_mpwt4MqM',Authorization:'Bearer '+token()}}),rows=await r.json();if(!r.ok)throw Error(rows.message||'Unable to load payments.');if(n!==seq)return;
$('fvOnlineRows').innerHTML=rows.map(x=>'<tr><td>'+esc(x.paid_at?new Date(x.paid_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}):'')+'</td><td>'+esc(x.external_order_no)+'</td><td>'+esc(names[x.store_code]||x.store_code)+'</td><td>R'+Number(x.amount).toFixed(2)+'</td><td>'+esc(x.payment_status)+'</td><td>'+esc(x.order_status)+'</td><td>'+esc(x.paystack_reference)+'</td><td>'+(/^TEST/i.test(x.external_order_no)?'TEST — do not fulfil':'Customer order')+'</td></tr>').join('')||'<tr><td colspan="8">No payments for this store.</td></tr>';
$('fvOnlineStatus').textContent=rows.length+' payment(s). Showing the latest 200 at most. Refresh to check new payments.';
}catch(e){if(n===seq)$('fvOnlineStatus').textContent=e.message;}}
setInterval(mount,2000);mount();
})();
