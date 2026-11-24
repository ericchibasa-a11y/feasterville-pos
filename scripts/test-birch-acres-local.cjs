'use strict';
// Offline, read-only contract test runner. No Supabase credentials or network needed.
// This is NOT a staging integration or production readiness test.
const {spawnSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
const {join,resolve}=require('node:path');
const root=resolve(__dirname,'..');
const files=readdirSync(join(root,'tests')).filter(f=>/^birch-acres-.*\.test\.cjs$/.test(f)).sort();
if(!files.length){console.error('No Birch Acres tests found');process.exit(1);}
let failed=0;
for(const file of files){
 const result=spawnSync(process.execPath,[join(root,'tests',file)],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,NODE_ENV:'test'}});
 const ok=result.status===0&&!result.error;
 process.stdout.write((ok?'PASS ':'FAIL ')+file+'\n');
 if(!ok){failed++;process.stderr.write((result.stdout||'')+(result.stderr||'')+String(result.error||''));}
}
console.log(files.length+' contract tests: '+(files.length-failed)+' passed, '+failed+' failed');
if(failed)process.exitCode=1;
