const assert=require('node:assert/strict');const {companyAdapter}=require('../src/birch-acres-company-posting.js');
const calls=[];const client=label=>({rpc:async(fn,args)=>{calls.push({label,fn,args});return {data:{sale_reference:label+'-1'},error:null}}});
const job={checkout_id:'BA-20261122-104',store_code:'BIRCH_ACRES',state:'posting',request_hash:'a'.repeat(64),payment_reference:'verified-1',items:[{company:'feasterville',product_id:'K1',quantity:1},{company:'noshville',product_id:'NV1',quantity:2}]};
(async()=>{
 const a=companyAdapter({feasterville:client('FV'),noshville:client('NV')});
 assert.equal(await a.postFeasterville(job),'FV-1');assert.equal(await a.postNoshville(job),'NV-1');
 assert.deepEqual(calls.map(x=>x.fn),['birch_post_feasterville_sale','birch_post_noshville_sale']);
 assert.equal(calls[0].args.p_request_hash,job.request_hash);
 assert.deepEqual(calls[1].args.p_lines,[{product_id:'NV1',quantity:2}]);
 await assert.rejects(a.postNoshville({...job,payment_reference:null}),/payment reference/);
 await assert.rejects(a.postFeasterville({...job,items:[]}),/company lines/);
 await assert.rejects(companyAdapter({feasterville:{rpc:async()=>({error:{message:'offline'}})},noshville:client('NV')}).postFeasterville(job),/offline/);
 console.log('Company posting contract tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
