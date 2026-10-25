import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const body='Synthetic security fixture only';

// Each probe owns a loopback server and an isolated child. An uncaught stream
// error must fail the child; never intercept uncaughtException to mask a crash.
export async function runFetchProbe({name,runtime=process.execPath,clientModule}={}) {
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push(req.url);
    if(req.url==='/encoding'){
      res.writeHead(200,{'Content-Encoding':'gzip, gzip, gzip, gzip, gzip, gzip','Content-Length':'42'});
      res.flushHeaders();const timer=setTimeout(()=>res.destroy(),20);timer.unref();
    }else if(['/integrity','/healthy'].includes(req.url))res.end(body);
    else {res.statusCode=404;res.end();}
  });
  let child,timer,output='',error='',timedOut=false;
  try {
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const address=server.address();assert.equal(address.address,'127.0.0.1');
    const origin=`http://127.0.0.1:${address.port}`;
    const source=`import assert from 'node:assert/strict';
      import {setTimeout as delay} from 'node:timers/promises';
      const fetcher=${clientModule?`(await import(${JSON.stringify(pathToFileURL(clientModule).href)})).fetch`:'globalThis.fetch'};
      const base=${JSON.stringify(origin)},body=${JSON.stringify(body)};
      await assert.rejects(async()=>{const r=await fetcher(base+'/encoding',{signal:AbortSignal.timeout(5000)});await r.text();},e=>e instanceof TypeError);
      await delay(100);
      assert.equal(await (await fetcher(base+'/healthy',{signal:AbortSignal.timeout(5000)})).text(),body);
      await assert.rejects(async()=>{const r=await fetcher(base+'/integrity',{integrity:'SHA256-'+${JSON.stringify(Buffer.alloc(32).toString('base64'))},signal:AbortSignal.timeout(5000)});await r.text();},e=>e instanceof TypeError);
      assert.equal(await (await fetcher(base+'/integrity',{integrity:'SHA256-'+${JSON.stringify(createHash('sha256').update(body).digest('base64'))},signal:AbortSignal.timeout(5000)})).text(),body);
      console.log(JSON.stringify({passed:true,checks:4,node:process.version,bundledUndici:process.versions.undici}));`;
    child=spawn(runtime,['--input-type=module','--eval',source],{cwd:root,env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});
    child.stdout.on('data',part=>{output=(output+part).slice(-16000);});
    child.stderr.on('data',part=>{error=(error+part).slice(-16000);});
    timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},15000);
    const result=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
    return {name,...result,timedOut,output,error,requests};
  } finally {
    clearTimeout(timer);
    if(child&&child.exitCode===null&&child.signalCode===null){
      const stopped=once(child,'close');child.kill('SIGKILL');await stopped;
    }
    const stopped=new Promise(done=>server.close(done));server.closeAllConnections();await stopped;
  }
}

async function main(){
  assert.equal(process.argv.length,2,'This local fixture accepts no targets or runtime arguments.');
  const pin=(await readFile(join(root,'.node-version'),'utf8')).trim();
  assert.equal(pin,'26.12.1');assert.equal(process.version,'v'+pin,'Use the pinned patched Node runtime.');
  assert.equal(process.versions.undici,'8.12.2','Check Node built-in fetch separately from the npm dependency.');
  const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
  assert.equal(pkg.engines.node,'>=26.12.1 <27');
  assert.equal(pkg.dependencies.vite,'8.3.5');assert.equal(lock.packages['node_modules/vite'].version,'8.3.5');
  const vite=JSON.parse(await readFile(join(root,'node_modules/vite/package.json'),'utf8'));
  const undici=JSON.parse(await readFile(join(root,'node_modules/undici/package.json'),'utf8'));
  assert.equal(vite.version,'8.3.5');assert.equal(undici.version,'8.12.3');
  assert.equal(lock.packages['node_modules/undici'].version,undici.version);
  assert.equal(lock.packages['node_modules/undici'].dev,true,'Undici npm copy remains a test dependency.');
  const results=[];
  for(const options of [{name:'Node built-in fetch'},{name:'npm Undici fetch',clientModule:join(root,'node_modules/undici/index.js')}]){
    const result=await runFetchProbe(options);results.push(result);
    assert.equal(result.timedOut,false,`${result.name}: child exceeded the local fixture bound`);
    assert.equal(result.code,0,`${result.name}: ${result.error}`);assert.equal(result.signal,null);
    assert.deepEqual(result.requests,['/encoding','/healthy','/integrity','/integrity']);
    assert.equal(JSON.parse(result.output).checks,4);
  }
  console.log(JSON.stringify({passed:true,node:process.version,bundledUndici:process.versions.undici,vite:vite.version,npmUndici:undici.version,
    scope:'version/lock/install checks and eight local HTTP assertions; no remote exploit, Windows PoC or hosted acceptance',results},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
