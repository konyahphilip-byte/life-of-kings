import {describe,it,expect} from 'vitest';
import {MANIFEST,createRegistry,validateTransition,legacyAdvice} from './registry.mjs';
const registry=()=>createRegistry(MANIFEST);
const clone=()=>structuredClone(MANIFEST);
const node=(m,key)=>m.categories.find(x=>x.key===key);
const classification=(r,key,patch={})=>({registryVersion:MANIFEST.version,categoryId:r.byKey(key).id,listingType:'physical',listingIntent:'sell',attributes:{condition:'used'},...patch});
describe('canonical taxonomy registry',()=>{
 it('uses unique immutable IDs and slugs with all forty requested domains accounted for',()=>{
  const r=registry();expect(new Set(MANIFEST.categories.map(x=>x.id)).size).toBe(MANIFEST.categories.length);
  expect(new Set(MANIFEST.categories.map(x=>x.canonicalSlug)).size).toBe(MANIFEST.categories.length);
  expect(MANIFEST.coverage.map(x=>x.domain).sort((a,b)=>a-b)).toEqual(Array.from({length:40},(_,i)=>i+1));
  expect(r.roots().length).toBeGreaterThan(10);
 });
 it('returns deep breadcrumbs and exact child navigation',()=>{
  const r=registry(),leaf=r.byKey('gaming-laptops');
  expect(r.breadcrumbs(leaf.id).map(x=>x.key)).toEqual(['electronics','computers','laptops','gaming-laptops']);
  expect(r.children(r.byKey('laptops').id).some(x=>x.id===leaf.id)).toBe(true);
 });
 it.each([['PS4','game-consoles'],['cement blocks','concrete-blocks'],['tomatoes','tomatoes']])('finds %s through curated category search', (query,key)=>{
  const r=registry();expect(r.search(query)[0].category.id).toBe(r.byKey(key).id);
 });
 it('does not invent a category for a selling intent, condition or unknown phrase',()=>{
  const r=registry();for(const q of ['rent','wholesale','used','completely unknown xqz'])expect(r.search(q)).toEqual([]);
 });
 it('keeps snapshots and results immutable without mutating the supplied manifest',()=>{
  const m=clone(),r=createRegistry(m),before=JSON.stringify(m);
  expect(Object.isFrozen(r.byKey('tomatoes'))).toBe(true);
  expect(()=>{r.byKey('tomatoes').displayName='Changed';}).toThrow();
  expect(JSON.stringify(m)).toBe(before);
 });
 it('keeps machinery hire separate from its category and from condition',()=>{
  const r=registry(),c=r.normalize(classification(r,'excavators',{listingType:'equipment',listingIntent:'hire',attributes:{condition:'used'}}),{partial:true});
  expect(c.listingIntent).toBe('hire');expect(c.categoryId).toBe(r.byKey('excavators').id);
  expect(c.attributes.condition).toBe('used');expect(r.byKey('rentals')).toBeUndefined();
 });
 it('allows incomplete draft classification but returns actionable missing fields',()=>{
  const r=registry(),c=r.normalize(classification(r,'tomatoes',{attributes:{}}),{partial:true});
  expect(c.issues.some(x=>x.field==='unit')).toBe(true);
  expect(()=>r.normalize(classification(r,'tomatoes',{attributes:{}}))).toThrow();
 });
 it('normalizes only seller-supplied declarations and never adds certification',()=>{
  const r=registry(),input=classification(r,'smartphones',{attributes:{condition:'used',brand:'  Example  ',storageGb:128}});
  const result=r.normalize(input);expect(result.attributes.brand).toBe('Example');expect(input.attributes.brand).toBe('  Example  ');
  expect(result.attributes).not.toHaveProperty('verified');expect(result).not.toHaveProperty('publication');
 });
 it.each([
  {registryVersion:999},{categoryId:'unknown'},{listingType:'property'},{listingIntent:'lease'},
  {attributes:{condition:'certified'}},{attributes:{condition:'used',sellerId:'other'}},
  {attributes:{condition:'used',storageGb:'128'}},{attributes:{condition:'used',storageGb:-1}},
  {attributes:{condition:'used',brand:'bad\u0000text'}},{attributes:[]},{attributes:null},
 ])('rejects invalid smartphone classification %#',patch=>{
  const r=registry();expect(()=>r.normalize(classification(r,'smartphones',patch))).toThrow();
 });
 it('rejects group selections and deprecated records as final classifications',()=>{
  const r=registry();expect(()=>r.normalize(classification(r,'electronics'))).toThrow();
  const m=clone();node(m,'smartphones').activeStatus='deprecated';
  const old=createRegistry(m);expect(()=>old.normalize(classification(old,'smartphones'))).toThrow();
 });
 it('never turns an alias or display label into assignment authority',()=>{
  const r=registry();expect(()=>r.normalize({...classification(r,'smartphones'),categoryId:'PS4'})).toThrow();
  expect(r.eligibility(r.byKey('live-animals').id).state).toBe('disabled');
  expect(r.eligibility(r.byKey('prohibited-weapons').id).state).toBe('prohibited');
  expect(r.eligibility(r.byKey('tomatoes').id)).not.toHaveProperty('publicationAllowed');
 });
 it.each(['duplicate-id','duplicate-slug','missing-parent','cycle','missing-schema','orphan-alias','ambiguous-alias','unsafe-key'])('rejects malformed registry %s',kind=>{
  const m=clone(),a=node(m,'smartphones'),b=node(m,'game-consoles');
  if(kind==='duplicate-id')b.id=a.id;
  if(kind==='duplicate-slug')b.canonicalSlug=a.canonicalSlug;
  if(kind==='missing-parent')a.parentId='missing';
  if(kind==='cycle')node(m,'electronics').parentId=a.id;
  if(kind==='missing-schema')a.schemaRef='missing';
  if(kind==='orphan-alias')m.aliases.push({categoryId:'missing',locale:'en-GH',term:'orphan'});
  if(kind==='ambiguous-alias')m.aliases.push({categoryId:b.id,locale:'en-GH',term:'PS4'});
  if(kind==='unsafe-key')m.attributeDefinitions.push({key:'__proto__',label:'Unsafe',type:'text',max:80});
  expect(()=>createRegistry(m)).toThrow();
 });
 it('supports a valid reparent while keeping immutable category IDs',()=>{
  const next=clone();next.version++;
  const moved=node(next,'gaming-laptops');moved.parentId=node(next,'computers').id;moved.depth=2;
  expect(validateTransition(MANIFEST,next).changes.some(x=>x.id===moved.id&&x.fields.includes('parentId'))).toBe(true);
  expect(createRegistry(next).byKey('gaming-laptops').id).toBe(node(MANIFEST,'gaming-laptops').id);
 });
 it.each(['deletion','identity-replacement','version-reuse'])('rejects destructive or unversioned transition %s',kind=>{
  const next=clone();next.version++;
  if(kind==='deletion')next.categories=next.categories.filter(x=>x.key!=='gaming-laptops');
  if(kind==='identity-replacement')node(next,'gaming-laptops').id='00000000-0000-4000-8000-000000000099';
  if(kind==='version-reuse')next.version=MANIFEST.version;
  expect(()=>validateTransition(MANIFEST,next)).toThrow();
 });
 it('offers explicit legacy migration advice without assigning a guessed leaf or changing records',()=>{
  const row={category:'fashion',category_id:'fashion.clothing',category_version:1,attributes_json:'{}',merchant:'private'};
  const before=JSON.stringify(row),advice=legacyAdvice(row,registry());
  expect(advice.requiresReview).toBe(true);expect(advice.automaticAssignment).toBeNull();expect(JSON.stringify(row)).toBe(before);
 });
 it('bounds queries and refuses unsupported locales',()=>{
  const r=registry();expect(()=>r.search('x'.repeat(101))).toThrow();
  expect(()=>r.search('phone',{limit:1000})).toThrow();expect(()=>r.search('phone',{locale:'unverified'})).toThrow();
 });
});
