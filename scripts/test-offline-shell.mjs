import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
const listeners={},stores=new Map(),puts=[],deleted=[];
function store(name){if(!stores.has(name))stores.set(name,new Map());return stores.get(name);}
store('ecovibes-shell-v2').set('/',new Response('unsafe legacy shell'));
store('unrelated-cache').set('/',new Response('unrelated shell'));
let network=new Response('<html>new safe shell</html>',{headers:{'content-type':'text/html'}});
function namedCache(name){const entries=store(name);return {match:async key=>entries.get(typeof key==='string'?key:key.url)?.clone(),put:async(key,response)=>{puts.push(typeof key==='string'?key:key.url);entries.set(typeof key==='string'?key:key.url,response.clone());},addAll:async()=>{}};}
const cache=namedCache('ecovibes-shell-v3');
const caches={open:async name=>namedCache(name),keys:async()=>[...stores.keys()],delete:async key=>{deleted.push(key);return stores.delete(key);},match:async key=>{for(const name of stores.keys()){const found=await namedCache(name).match(key);if(found)return found;}}};
const context={self:{location:{origin:'https://app.example'},addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},caches,fetch:async()=>{if(network instanceof Error)throw network;return network.clone();},URL,Response,Set};
vm.runInNewContext(source,context);
async function request(path,{mode='navigate',destination='document',headers={}}={}){
 let response,settled;
 listeners.fetch({request:{url:'https://app.example'+path,method:'GET',mode,destination,headers:new Headers(headers)},respondWith:value=>{response=value;},waitUntil:value=>{settled=value;}});
 const result=await response;await settled;return result;
}
const checks=[];
network=new Error('offline');assert.equal((await request('/')).type,'error','Never borrow an old or unrelated offline document');checks.push('offline fallback reads only its own cache');
network=new Response('<html>new safe shell</html>',{headers:{'content-type':'text/html'}});
// The online document must replace the canonical public fallback, not leave the install-time document.
await request('/');
assert(puts.includes('/'),'Online canonical navigation did not refresh the offline shell');
network=new Error('offline');
assert.match(await (await request('/')).text(),/new safe shell/);checks.push('online navigation updates the offline shell');
network=new Response('<html>private callback</html>',{headers:{'content-type':'text/html'}});
await request('/?access_token=private#recovery');
assert(!puts.some(key=>key.includes('private')));assert.match(await cache.match('/').then(r=>r.text()),/new safe shell/);checks.push('callback documents never replace the public root');
assert.equal(await request('/api/v1/auth/me'),undefined);assert.equal(await request('/',{headers:{authorization:'synthetic'}}),undefined);assert.equal(await request('/uploads/private.jpg',{mode:'cors',destination:'image'}),undefined);checks.push('API, authorized requests and private uploads are never intercepted');
let activation;listeners.activate({waitUntil:value=>{activation=value;}});await activation;
assert.deepEqual(deleted,['ecovibes-shell-v2']);assert(stores.has('unrelated-cache'));assert(stores.has('ecovibes-shell-v3'));checks.push('activation retires only the known legacy cache');
console.log(JSON.stringify({passed:true,checks},null,2));
