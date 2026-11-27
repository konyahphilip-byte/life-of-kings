import {build} from 'vite';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const started=performance.now();
const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:true,lib:{entry:'shared/taxonomy/registry.mjs',formats:['es'],fileName:'taxonomy'}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output);
assert(outputs.length>0,'The browser library must compile.');
const chunks=outputs.filter(x=>x.type==='chunk');
assert(chunks.length>0&&chunks.every(x=>x.imports.length===0&&x.dynamicImports.length===0),'No external runtime imports belong in the category bundle.');
// Evaluate the compiled ESM in Node as an additional interoperability check.
// This does not execute a browser or establish browser interaction acceptance.
const compiled=await import('data:text/javascript;base64,'+Buffer.from(chunks[0].code).toString('base64'));
const registry=compiled.createRegistry(compiled.MANIFEST);
assert.equal(registry.search('PS4')[0].category.key,'game-consoles');
console.log(JSON.stringify({artifacts:outputs.length,bytes:chunks.reduce((s,x)=>s+Buffer.byteLength(x.code),0),gzipBytes:chunks.reduce((s,x)=>s+gzipSync(x.code).length,0),externalImports:[],seconds:Number(((performance.now()-started)/1000).toFixed(3)),note:'Memory-only browser-target compilation and compiled-ESM Node check; no browser UI/device claim.'},null,2));
