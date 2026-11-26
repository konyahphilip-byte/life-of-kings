import { spawn } from 'node:child_process';
import { mkdir, writeFile, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'work/m01-native/gates-'+Date.now());await mkdir(out,{recursive:true});
const rows=[];
const commands=[
 ['full-tests',['node_modules/vitest/vitest.mjs','run','--reporter=json','--outputFile='+out+'/full.json']],
 ['typescript',['node_modules/typescript/bin/tsc','-b']],
 ['production-build',['node_modules/vite/bin/vite.js','build']],
 ['dependency-security',['scripts/test-dependency-security.mjs']],
 ['native-http',['scripts/test-m01-native.mjs']],
 ['existing-direct-messages',['scripts/test-direct-messages.mjs']],
 ['existing-payments',['scripts/test-paystack-workflow.mjs']],
 ['existing-identity',['scripts/test-identity-roles.mjs']]
];
for(const [name,args] of commands){
 const start=Date.now(),file=await open(resolve(out,name+'.log'),'w');
 const exit=await new Promise((done,reject)=>{
  const child=spawn(process.execPath,args,{cwd:root,env:{PATH:process.execPath.slice(0,process.execPath.lastIndexOf('/'))+':/usr/bin:/bin',TMPDIR:process.env.TMPDIR||'/tmp',NODE_ENV:'test',OPENAI_ENV_FILE:'',SUPABASE_URL:'',DATABASE_URL:''},stdio:['ignore',file.fd,file.fd]});
  child.once('error',reject);child.once('exit',(code,signal)=>done({code,signal}));
 });await file.close();rows.push({name,command:[process.execPath,...args],...exit,durationMs:Date.now()-start,log:resolve(out,name+'.log')});
 await writeFile(resolve(out,'gates.json'),JSON.stringify({rows,out},null,2));console.log(JSON.stringify(rows.at(-1)));
}
if(rows.some(r=>r.code!==0))process.exitCode=1;
