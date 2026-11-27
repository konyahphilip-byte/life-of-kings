import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {MANIFEST,createRegistry,TaxonomyError} from '../shared/taxonomy/registry.mjs';
const began=performance.now(),registry=createRegistry(MANIFEST),ready=performance.now();
let checks=0;
for(const category of MANIFEST.categories){
 assert.equal(registry.byId(category.id).key,category.key);checks++;
 const path=registry.breadcrumbs(category.id);
 assert.equal(path.at(-1).id,category.id);assert.equal(path.length,category.depth+1);checks++;
 if(category.schemaRef){assert.equal(registry.schema(category.id).version,category.schemaVersion);checks++;}
}
for(const [query,key] of [['PS4','game-consoles'],['cement blocks','concrete-blocks'],['tomatoes','tomatoes']]){
 assert.equal(registry.search(query)[0].category.key,key);checks++;
}
for(const word of ['rent','used','wholesale','unrecognized xqz']){assert.deepEqual(registry.search(word),[]);checks++;}
const input={registryVersion:registry.version,categoryId:registry.byKey('smartphones').id,listingType:'physical',listingIntent:'sell',attributes:{condition:'used',storageGb:128}};
assert.equal(registry.normalize(input).attributes.storageGb,128);checks++;
for(const patch of [{registryVersion:1},{categoryId:'PS4'},{listingType:'property'},{listingIntent:'lease'},{attributes:{condition:'certified'}}]){
 assert.throws(()=>registry.normalize({...input,...patch}),TaxonomyError);checks++;
}
const queryStart=performance.now();
for(let i=0;i<1000;i++)registry.search(['PS4','tomatoes','cement blocks'][i%3]);
const queryEnd=performance.now(),bytes=readFileSync(new URL('../shared/taxonomy/manifest.json',import.meta.url));
console.log(JSON.stringify({checks,version:registry.version,categories:MANIFEST.categories.length,roots:registry.roots().length,leaves:MANIFEST.categories.filter(c=>c.schemaRef!==null).length,attributes:MANIFEST.attributeDefinitions.length,schemas:MANIFEST.schemas.length,manifestBytes:bytes.length,manifestGzipBytes:gzipSync(bytes).length,initializeMs:Number((ready-began).toFixed(3)),thousandSearchMs:Number((queryEnd-queryStart).toFixed(3)),processMaxRssKiB:process.resourceUsage().maxRSS,note:'Direct Node contract and local-host measurements only; not native Marketplace journeys or phone performance.'},null,2));
