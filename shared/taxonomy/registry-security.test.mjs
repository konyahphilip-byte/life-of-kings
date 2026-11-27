import {describe,it,expect} from 'vitest';
import {MANIFEST,createRegistry,validateTransition,legacyAdvice,TaxonomyError} from './registry.mjs';
const r=()=>createRegistry(MANIFEST);
const clone=()=>structuredClone(MANIFEST);
const pick=(m,k)=>m.categories.find(c=>c.key===k);
const input=(registry,key='smartphones')=>({registryVersion:2,categoryId:registry.byKey(key).id,listingType:'physical',listingIntent:'sell',attributes:{condition:'used'}});
describe('category registry isolation and transition boundaries',()=>{
 it('requires explicit caller selection and returns no private legacy content',()=>{
  const advice=legacyAdvice({category:'fashion',merchant:'private-owner',attributes_json:'private-not-json'},r());
  expect(JSON.stringify(advice)).not.toContain('private');expect(advice.requiresReview).toBe(true);expect(advice.automaticAssignment).toBeNull();
 });
 it('rejects executable accessors without invoking them',()=>{
  let calls=0;const m=clone();Object.defineProperty(m,'unexpected',{get(){calls++;return 'x';},enumerable:true});
  expect(()=>createRegistry(m)).toThrow();expect(calls).toBe(0);
  const registry=r(),c=input(registry);Object.defineProperty(c.attributes,'condition',{get(){calls++;return 'used';},enumerable:true});
  expect(()=>registry.normalize(c)).toThrow();expect(calls).toBe(0);
 });
 it.each([NaN,Infinity,-Infinity])('rejects nonfinite numeric attributes %s',value=>{
  const registry=r(),c=input(registry);c.attributes.storageGb=value;expect(()=>registry.normalize(c)).toThrow();
 });
 it('does not interpret missing or prohibited categories as ordinary merchandise',()=>{
  const registry=r(),c=input(registry,'prohibited-weapons');
  expect(()=>registry.normalize(c)).toThrow(TaxonomyError);
  const draft=registry.normalize(c,{partial:true});expect(draft.issues[0].code).toBe('category_inactive');
  expect(registry.search('prohibited weapons')[0].category.publicationEligibility.state).toBe('prohibited');
  expect(()=>registry.normalize({...c,categoryId:'not-known'},{partial:true})).toThrow();
 });
 it('returns separate schemas, breadcrumbs and cross-category entry points as immutable data',()=>{
  const registry=r(),schema=registry.schema(registry.byKey('smartphones').id);
  expect(schema.attributes.find(a=>a.key==='condition').required).toBe(true);
  expect(Object.isFrozen(schema.attributes)).toBe(true);
  expect(registry.related(registry.byKey('groceries').id).map(c=>c.key)).toEqual(['crops-produce']);
  expect(registry.schema(registry.byKey('electronics').id)).toBeNull();
 });
 it('rejects unsafe or misleading declaration fields even in incomplete drafts',()=>{
  const registry=r(),c=input(registry);
  for(const attributes of [JSON.parse('{"__proto__":{"admin":true}}'),{verified:true},{condition:'used',approval:'approved'}]){
   expect(()=>registry.normalize({...c,attributes},{partial:true})).toThrow();
  }
  expect(()=>registry.normalize({...c,merchantId:'other'},{partial:true})).toThrow();
 });
 it('keeps aliases non-authoritative even when an ambiguity is explicitly reviewed',()=>{
  const m=clone(),ps4=m.aliases.find(a=>a.term==='PS4');ps4.ambiguous=true;
  m.aliases.push({...ps4,categoryId:pick(m,'gaming-accessories').id});
  const registry=createRegistry(m),hits=registry.search('PS4');
  expect(hits).toHaveLength(2);expect(hits.every(h=>h.ambiguous)).toBe(true);
  expect(()=>registry.normalize({...input(registry),categoryId:'PS4'})).toThrow();
 });
 it.each(['orphan-related','bad-coverage','invalid-definition','mismatched-depth','empty-group','replacement-cycle'])('rejects malformed snapshot %s',problem=>{
  const m=clone();
  if(problem==='orphan-related')m.related[0].toId='missing';
  if(problem==='bad-coverage')m.coverage[0].domain=40;
  if(problem==='invalid-definition')m.attributeDefinitions.find(a=>a.key==='storageGb').min=Infinity;
  if(problem==='mismatched-depth')pick(m,'smartphones').depth=0;
  if(problem==='empty-group')pick(m,'smartphones').schemaRef=null;
  if(problem==='replacement-cycle'){const a=pick(m,'smartphones'),b=pick(m,'game-consoles');a.activeStatus=b.activeStatus='deprecated';a.replacementId=b.id;b.replacementId=a.id;}
  expect(()=>createRegistry(m)).toThrow();
 });
 it('keeps deprecated IDs inspectable but excludes them from selectable search results',()=>{
  const m=clone(),c=pick(m,'smartphones');c.activeStatus='deprecated';c.replacementId=pick(m,'feature-phones').id;
  const registry=createRegistry(m);expect(registry.byId(c.id).replacementId).toBe(pick(m,'feature-phones').id);
  expect(registry.search('smartphones')).toEqual([]);expect(registry.breadcrumbs(c.id)).toHaveLength(3);
 });
 it('rejects unversioned schema edits and prohibited-category downgrades',()=>{
  let m=clone();m.version++;m.schemas.find(s=>s.ref==='electronics').attributes[0].required=false;
  expect(()=>validateTransition(MANIFEST,m)).toThrow();
  m=clone();m.version++;pick(m,'prohibited-weapons').publicationEligibility.state='candidate';
  expect(()=>validateTransition(MANIFEST,m)).toThrow();
 });
 it('does not mutate input records, infer conditions or weaken missing-field checks',()=>{
  const registry=r(),c=input(registry);c.attributes={brand:'Example'};
  const before=JSON.stringify(c),partial=registry.normalize(c,{partial:true});
  expect(partial.attributes).not.toHaveProperty('condition');expect(partial.issues.map(x=>x.field)).toEqual(['condition']);
  expect(()=>registry.normalize(c)).toThrow();expect(JSON.stringify(c)).toBe(before);
 });
});

describe('reviewed taxonomy edge cases',()=>{
 it.each([null,32,{},['fashion']])('keeps malformed legacy keys non-authoritative %#',category=>{
  const advice=legacyAdvice({category},r());
  expect(advice.requiresReview).toBe(true);expect(advice.suggestedGroupIds).toEqual([]);
 });
 it.each(['constructor','toString','__proto__'])('rejects inherited legacy group lookup %s without crashing',category=>{
  expect(legacyAdvice({category},r()).suggestedGroupIds).toEqual([]);
 });
 it('does not invoke array accessors in a supplied snapshot',()=>{
  let calls=0;const m=clone();
  Object.defineProperty(m.categories,0,{get(){calls++;return MANIFEST.categories[0];},enumerable:true});
  expect(()=>createRegistry(m)).toThrow(TaxonomyError);expect(calls).toBe(0);
 });
 it.each(['search','normalize'])('rejects executable %s options without invoking them',method=>{
  let calls=0;const registry=r(),options={};
  Object.defineProperty(options,method==='search'?'locale':'partial',{get(){calls++;return method==='search'?'en-GH':true;},enumerable:true});
  expect(()=>method==='search'?registry.search('PS4',options):registry.normalize(input(registry),options)).toThrow(TaxonomyError);
  expect(calls).toBe(0);
 });
 it('rejects an alias that impersonates a different canonical category',()=>{
  const m=clone();m.aliases.push({categoryId:pick(m,'unclassified-merchandise').id,locale:'en-GH',term:'Prohibited weapons'});
  expect(()=>createRegistry(m)).toThrow(TaxonomyError);
 });
 it('requires schema version updates when an attribute constraint changes',()=>{
  const m=clone();m.version++;m.attributeDefinitions.find(a=>a.key==='brand').max=2;
  expect(()=>validateTransition(MANIFEST,m)).toThrow(TaxonomyError);
 });
 it('accepts an explicitly versioned attribute-schema update without replacing category identity',()=>{
  const m=clone();m.version++;m.attributeDefinitions.find(a=>a.key==='brand').max=2;
  for(const schema of m.schemas.filter(s=>s.attributes.some(a=>a.key==='brand'))){schema.version++;for(const c of m.categories.filter(c=>c.schemaRef===schema.ref))c.schemaVersion=schema.version;}
  expect(validateTransition(MANIFEST,m).changes.length).toBeGreaterThan(0);
  expect(createRegistry(m).byKey('smartphones').id).toBe(pick(MANIFEST,'smartphones').id);
 });
});
