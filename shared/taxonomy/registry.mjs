import snapshot from './manifest.json' with {type:'json'};
import {readClassification} from '../marketplace-taxonomy.mjs';

export class TaxonomyError extends Error {
 constructor(code,message,field){super(message);this.name='TaxonomyError';this.code=code;if(field)this.field=field;}
}
const fail=(ok,code,message,field)=>{if(!ok)throw new TaxonomyError(code,message,field);};
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const unsafe=new Set(['__proto__','prototype','constructor']);
const controls=/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const keyPattern=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const fieldKey=/^[a-z][a-zA-Z0-9]{0,79}$/;
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const keys=(x,allowed)=>record(x)&&Object.keys(x).every(k=>allowed.includes(k));
const text=(x,max=300)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!controls.test(x);
const list=(x,max)=>Array.isArray(x)&&x.length<=max;
const distinct=x=>new Set(x).size===x.length;
const token=x=>text(x,80)&&keyPattern.test(x);
const norm=x=>x.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function copyData(source) {
 let count=0;
 function visit(x,depth=0){
  fail(++count<=50000&&depth<=16,'invalid_snapshot','This category snapshot exceeds supported limits.');
  if(x===null||typeof x==='boolean')return x;
  if(typeof x==='number'){fail(Number.isFinite(x),'invalid_snapshot','Use finite numeric data.');return x;}
  if(typeof x==='string'){fail(x.length<=1000,'invalid_snapshot','A category value is too long.');return x;}
  fail(Array.isArray(x)||record(x),'invalid_snapshot','Use plain category data only.');
  fail(Object.getOwnPropertySymbols(x).length===0,'invalid_snapshot','Use named plain data fields.');
  if(Array.isArray(x)){
   fail(x.length<=2500,'invalid_snapshot','The category list is too large.');
   const descriptors=Object.getOwnPropertyDescriptors(x),out=[];
   fail(Object.keys(descriptors).every(k=>k==='length'||/^(0|[1-9][0-9]*)$/.test(k)),'invalid_snapshot','Arrays must contain only indexed data.');
   for(let i=0;i<x.length;i++){const d=descriptors[i];fail(d&&Object.hasOwn(d,'value'),'invalid_snapshot','Arrays cannot contain holes or executable accessors.');out.push(visit(d.value,depth+1));}
   return out;
  }
  const out={};
  for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(x))){
   fail(!unsafe.has(k)&&Object.hasOwn(d,'value'),'invalid_snapshot','Use plain data fields without executable accessors.');
   out[k]=visit(d.value,depth+1);
  }
  return out;
 }
 return visit(source);
}
export const MANIFEST=freeze(copyData(snapshot));

export function createRegistry(input) {
 const m=copyData(input);
 fail(keys(m,['version','locales','listingTypes','listingIntents','categories','aliases','attributeDefinitions','schemas','coverage','related']),'invalid_snapshot','Check the category snapshot fields.');
 fail(Number.isSafeInteger(m.version)&&m.version>=2,'invalid_version','Choose a supported category snapshot version.');
 fail(list(m.locales,10)&&m.locales.length>0&&distinct(m.locales)&&m.locales.every(x=>['en-GH'].includes(x)),'invalid_locale','Only reviewed category languages are supported.');
 for(const [field,values] of [['listingTypes',['physical','vehicle','equipment','property','digital','material','service']],['listingIntents',['sell','rent','lease','hire','quote']]]){
  fail(list(m[field],10)&&m[field].length>0&&distinct(m[field])&&m[field].every(x=>values.includes(x)),'invalid_snapshot','Check supported listing dimensions.');
 }
 fail(list(m.attributeDefinitions,200)&&list(m.schemas,200)&&list(m.categories,2500)&&m.categories.length>0&&list(m.aliases,2500)&&list(m.related,1000)&&list(m.coverage,40),'invalid_snapshot','Check the bounded category lists.');
 const attrs=new Map(),attrIds=new Set(),schemas=new Map(),byId=new Map(),byKey=new Map(),slugs=new Set(),children=new Map();
 for(const a of m.attributeDefinitions){
  fail(keys(a,['id','key','label','type','filterable','searchable','options','min','max','unit'])&&uuid.test(a.id)&&typeof a.key==='string'&&fieldKey.test(a.key)&&!unsafe.has(a.key)&&text(a.label,100)&&typeof a.filterable==='boolean'&&typeof a.searchable==='boolean','invalid_attribute','Check an attribute definition.');
  fail(!attrs.has(a.key)&&!attrIds.has(a.id),'duplicate_attribute','Attribute identities must be unique.');
  fail(['text','enum','integer','number'].includes(a.type),'invalid_attribute','Choose a supported attribute type.');
  if(a.type==='text')fail(Number.isSafeInteger(a.max)&&a.max>=1&&a.max<=1000&&!Object.hasOwn(a,'options')&&!Object.hasOwn(a,'min'),'invalid_attribute','Check text field bounds.');
  else if(a.type==='enum')fail(list(a.options,100)&&a.options.length>0&&distinct(a.options)&&a.options.every(x=>text(x,80))&&!Object.hasOwn(a,'min')&&!Object.hasOwn(a,'max'),'invalid_attribute','Check attribute choices.');
  else fail(Number.isFinite(a.min)&&Number.isFinite(a.max)&&a.max>=a.min&&(a.type!=='integer'||(Number.isSafeInteger(a.min)&&Number.isSafeInteger(a.max)))&&!Object.hasOwn(a,'options'),'invalid_attribute','Check numeric field bounds.');
  if(Object.hasOwn(a,'unit'))fail(a.unit===null||token(a.unit),'invalid_attribute','Check the measurement unit.');
  attrs.set(a.key,a);attrIds.add(a.id);
 }
 for(const s of m.schemas){
  fail(keys(s,['ref','version','attributes'])&&token(s.ref)&&!schemas.has(s.ref)&&Number.isSafeInteger(s.version)&&s.version>0&&list(s.attributes,24)&&s.attributes.length>0,'invalid_schema','Check category field schema.');
  const fields=new Set(),orders=new Set();
  for(const f of s.attributes){
   fail(keys(f,['key','required','displayOrder'])&&attrs.has(f.key)&&!fields.has(f.key)&&typeof f.required==='boolean'&&Number.isSafeInteger(f.displayOrder)&&f.displayOrder>=0&&!orders.has(f.displayOrder),'invalid_schema','Check category field references and order.');
   fields.add(f.key);orders.add(f.displayOrder);
  }
  s.attributes.sort((a,b)=>a.displayOrder-b.displayOrder);schemas.set(s.ref,s);
 }
 for(const c of m.categories){
  fail(keys(c,['id','key','parentId','canonicalSlug','displayName','description','depth','sortOrder','iconReference','publicationEligibility','listingTypes','listingIntents','schemaRef','schemaVersion','activeStatus','replacementId'])&&uuid.test(c.id)&&token(c.key)&&token(c.canonicalSlug)&&text(c.displayName,100)&&text(c.description)&&token(c.iconReference),'invalid_category','Check category identity and display details.');
  fail(!byId.has(c.id)&&!byKey.has(c.key)&&!slugs.has(c.canonicalSlug),'duplicate_category','Category IDs, keys and slugs must be unique.');
  fail((c.parentId===null||uuid.test(c.parentId))&&Number.isSafeInteger(c.depth)&&c.depth>=0&&c.depth<=8&&Number.isSafeInteger(c.sortOrder)&&c.sortOrder>=0&&c.sortOrder<=2500,'invalid_category','Check hierarchy and category order.');
  fail(['active','deprecated'].includes(c.activeStatus)&&keys(c.publicationEligibility,['state','reason'])&&['group','candidate','review-required','restricted','disabled','prohibited'].includes(c.publicationEligibility.state)&&text(c.publicationEligibility.reason),'invalid_eligibility','Check the category eligibility description.');
  fail(list(c.listingTypes,10)&&distinct(c.listingTypes)&&c.listingTypes.every(x=>m.listingTypes.includes(x))&&list(c.listingIntents,10)&&distinct(c.listingIntents)&&c.listingIntents.every(x=>m.listingIntents.includes(x)),'invalid_category','Check compatible listing dimensions.');
  if(c.schemaRef===null)fail(c.listingTypes.length===0&&c.listingIntents.length===0&&c.publicationEligibility.state==='group'&&c.schemaVersion===1,'invalid_schema','Groups cannot be assigned as item classifications.');
  else fail(schemas.has(c.schemaRef)&&c.schemaVersion===schemas.get(c.schemaRef).version&&c.listingTypes.length>0&&c.listingIntents.length>0&&c.publicationEligibility.state!=='group','invalid_schema','Select a valid schema for the item category.');
  byId.set(c.id,c);byKey.set(c.key,c);slugs.add(c.canonicalSlug);
  const siblings=children.get(c.parentId)||[];siblings.push(c);children.set(c.parentId,siblings);
 }
 for(const c of m.categories){
  let cursor=c,depth=0;const seen=new Set();
  while(cursor.parentId!==null){
   fail(!seen.has(cursor.id),'category_cycle','Category hierarchy cannot contain a cycle.');seen.add(cursor.id);
   cursor=byId.get(cursor.parentId);fail(cursor,'missing_parent','Every category needs a valid parent.');depth++;
   fail(depth<=8,'category_cycle','Check category ancestry and supported depth.');
  }
  fail(depth===c.depth,'invalid_depth','Category depth must match its ancestry.');
  fail(c.schemaRef===null?(children.get(c.id)||[]).length>0:!children.has(c.id),'invalid_category','Groups need children and item categories cannot have child categories.');
  if(c.replacementId!==undefined){
   fail(c.activeStatus==='deprecated'&&byId.has(c.replacementId)&&c.replacementId!==c.id,'invalid_replacement','A deprecated category needs a different, existing replacement.');
   let current=c;const chain=new Set();
   while(current.replacementId!==undefined){fail(!chain.has(current.id),'invalid_replacement','Category replacements cannot form a cycle.');chain.add(current.id);current=byId.get(current.replacementId);fail(current,'invalid_replacement','Check the replacement category.');}
  }
 }
 const aliases=new Map();
 for(const a of m.aliases){
  fail(keys(a,['categoryId','locale','term','ambiguous'])&&byId.has(a.categoryId)&&m.locales.includes(a.locale)&&text(a.term,100)&&norm(a.term).length>0&&(a.ambiguous===undefined||typeof a.ambiguous==='boolean'),'invalid_alias','Check category search aliases.');
  fail(!m.categories.some(c=>c.id!==a.categoryId&&[norm(c.displayName),norm(c.canonicalSlug)].includes(norm(a.term))),'conflicting_alias','An alias cannot impersonate a different canonical category.');
  const key=a.locale+':'+norm(a.term),previous=aliases.get(key)||[];
  fail(!previous.some(x=>x.categoryId===a.categoryId),'duplicate_alias','Do not repeat a category search alias.');
  fail(previous.length===0||(a.ambiguous===true&&previous.every(x=>x.ambiguous===true)),'ambiguous_alias','Overlapping search aliases must be explicitly marked ambiguous.');
  previous.push(a);aliases.set(key,previous);
 }
 const related=new Set();
 for(const r of m.related){
  const pair=r.fromId+':'+r.toId;
  fail(keys(r,['fromId','toId','reason'])&&byId.has(r.fromId)&&byId.has(r.toId)&&r.fromId!==r.toId&&text(r.reason)&&!related.has(pair),'invalid_related_category','Check related category entry points.');related.add(pair);
 }
 fail(m.coverage.length===40&&distinct(m.coverage.map(x=>x.domain)),'invalid_coverage','Account for each of the forty requested domains once.');
 for(const c of m.coverage)fail(keys(c,['domain','categoryIds','dimension','decision'])&&Number.isSafeInteger(c.domain)&&c.domain>=1&&c.domain<=40&&list(c.categoryIds,20)&&c.categoryIds.length>0&&distinct(c.categoryIds)&&c.categoryIds.every(id=>byId.has(id))&&['category','listingIntent','minimumQuantity'].includes(c.dimension)&&text(c.decision),'invalid_coverage','Check domain coverage references.');
 const sort=(a,b)=>a.sortOrder-b.sortOrder||a.key.localeCompare(b.key,'en');
 for(const siblings of children.values())siblings.sort(sort);
 freeze(m);
 const lookup=id=>{const c=byId.get(id);fail(c,'unknown_category','Choose a category from this registry.','categoryId');return c;};
 const searchIndex=m.categories.filter(c=>c.activeStatus==='active').map(category=>({category,label:norm(category.displayName),slug:norm(category.canonicalSlug),terms:m.aliases.filter(a=>a.categoryId===category.id)}));
 return Object.freeze({
  version:m.version,
  byKey:key=>byKey.get(key),
  byId:id=>byId.get(id),
  roots:()=>Object.freeze([...(children.get(null)||[])]),
  children:id=>{lookup(id);return Object.freeze([...(children.get(id)||[])]);},
  breadcrumbs:id=>{let c=lookup(id);const path=[c];while(c.parentId!==null){c=lookup(c.parentId);path.unshift(c);}return Object.freeze(path);},
  related:id=>{lookup(id);return Object.freeze(m.related.filter(r=>r.fromId===id).map(r=>lookup(r.toId)));},
  schema:id=>{const c=lookup(id),s=schemas.get(c.schemaRef);return s?freeze({ref:s.ref,version:s.version,attributes:s.attributes.map(f=>({...attrs.get(f.key),required:f.required,displayOrder:f.displayOrder}))}):null;},
  eligibility:id=>lookup(id).publicationEligibility,
  search(query,options={}){
   options=copyData(options);
   fail(keys(options,['limit','locale']),'invalid_search','Check category search options.');
   const {limit=12,locale='en-GH'}=options;
   fail(typeof query==='string'&&query.length<=100&&!controls.test(query),'invalid_query','Use a category search of at most 100 characters.');
   fail(m.locales.includes(locale)&&Number.isSafeInteger(limit)&&limit>=1&&limit<=20,'invalid_search','Use a reviewed language and at most twenty suggestions.');
   const q=norm(query);if(!q||['sell','rent','rental','lease','hire','quote','wholesale','used','new','refurbished'].includes(q))return Object.freeze([]);
   const words=q.split(' '),hits=[];
   for(const entry of searchIndex){
    const terms=entry.terms.filter(a=>a.locale===locale),labels=[entry.label,entry.slug,...terms.map(a=>norm(a.term))];
    const score=labels.includes(q)?100:labels.some(x=>x.startsWith(q))?60:words.every(w=>labels.some(x=>x.includes(w)))?30:0;
    if(score)hits.push({category:entry.category,score,ambiguous:terms.some(a=>norm(a.term)===q&&a.ambiguous===true)});
   }
   return freeze(hits.sort((a,b)=>b.score-a.score||sort(a.category,b.category)).slice(0,limit));
  },
  normalize(input,options={}){
   input=copyData(input);options=copyData(options);
   fail(keys(options,['partial'])&&(options.partial===undefined||typeof options.partial==='boolean'),'invalid_options','Check draft validation options.');
   fail(keys(input,['registryVersion','categoryId','listingType','listingIntent','attributes']),'invalid_classification','Use only category and seller-declared item fields.');
   fail(input.registryVersion===m.version,'stale_classification','Review the category against the current registry.','registryVersion');
   const c=lookup(input.categoryId);
   fail(c.activeStatus==='active'&&c.schemaRef!==null,'inactive_category','Choose a current item category, rather than a group.','categoryId');
   fail(c.listingTypes.includes(input.listingType),'incompatible_type','Choose a listing type compatible with this item.','listingType');
   fail(c.listingIntents.includes(input.listingIntent),'incompatible_intent','Choose a compatible sale, rental or hire intent.','listingIntent');
   const s=schemas.get(c.schemaRef),source=input.attributes;
   fail(record(source)&&Object.keys(source).length<=24&&Object.keys(source).every(k=>s.attributes.some(f=>f.key===k)),'invalid_attributes','Use only the fields listed for this category.','attributes');
   // Reject getters, prototype pollution and non-data values before reading declarations.
   const declarations=copyData(source),attributes={},issues=[];
   if(['disabled','prohibited'].includes(c.publicationEligibility.state))issues.push({field:'categoryId',code:'category_inactive',message:'This category is not enabled. Save privately and request classification guidance.'});
   for(const field of s.attributes){
    const a=attrs.get(field.key),raw=declarations[a.key];
    if(raw===undefined||raw===''){if(field.required)issues.push({field:a.key,code:'required',message:'Add '+a.label.toLowerCase()+'.'});continue;}
    if(a.type==='enum'){fail(typeof raw==='string'&&a.options.includes(raw),'invalid_attribute','Choose a listed '+a.label.toLowerCase()+'.',a.key);attributes[a.key]=raw;}
    else if(a.type==='integer'||a.type==='number'){fail(typeof raw==='number'&&Number.isFinite(raw)&&(a.type!=='integer'||Number.isSafeInteger(raw))&&raw>=a.min&&raw<=a.max,'invalid_attribute','Check the numeric '+a.label.toLowerCase()+'.',a.key);attributes[a.key]=raw;}
    else {
     fail(typeof raw==='string'&&!controls.test(raw),'invalid_attribute','Use plain text for '+a.label.toLowerCase()+'.',a.key);
     const value=raw.normalize('NFKC').trim();
     fail(value.length<=a.max&&!controls.test(value),'invalid_attribute','Check '+a.label.toLowerCase()+' length.',a.key);
     if(value)attributes[a.key]=value;else if(field.required)issues.push({field:a.key,code:'required',message:'Add '+a.label.toLowerCase()+'.'});
    }
   }
   fail(options.partial===true||issues.length===0,'incomplete_classification',issues[0]?.message||'Complete the item details.',issues[0]?.field);
   return freeze({registryVersion:m.version,categoryId:c.id,schemaVersion:c.schemaVersion,listingType:input.listingType,listingIntent:input.listingIntent,attributes,issues});
  },
 });
}
export function validateTransition(previous,next){
 const before=createRegistry(previous),after=createRegistry(next);
 fail(after.version>before.version,'unversioned_transition','Advance the registry version before changing classifications.');
 const changes=[];
 for(const c of previous.categories){
  const n=after.byId(c.id);
  fail(n&&n.key===c.key&&after.byKey(c.key)?.id===c.id,'destructive_transition','Retain existing category IDs and keys; deprecate instead of deleting.');
  fail(c.publicationEligibility.state!=='prohibited'||n.publicationEligibility.state==='prohibited','unsafe_transition','Prohibited classifications cannot become ordinary goods.');
  const fields=Object.keys({...c,...n}).filter(k=>JSON.stringify(c[k])!==JSON.stringify(n[k]));
  if(fields.length)changes.push({id:c.id,fields});
 }
 for(const a of previous.attributeDefinitions){
  const n=next.attributeDefinitions.find(x=>x.id===a.id);
  fail(n&&n.key===a.key&&n.type===a.type,'destructive_transition','Retain attribute identity and data type; introduce a new attribute for incompatible changes.');
 }
 const schemaShape=(schema,manifest)=>JSON.stringify({fields:schema.attributes,definitions:schema.attributes.map(f=>manifest.attributeDefinitions.find(a=>a.key===f.key))});
 for(const s of previous.schemas){
  const n=next.schemas.find(x=>x.ref===s.ref);
  fail(n&&n.version>=s.version&&(schemaShape(s,previous)===schemaShape(n,next)||n.version>s.version),'unversioned_schema','Retain historical schema references and advance changed schema versions.');
 }
 return freeze({fromVersion:before.version,toVersion:after.version,changes,added:next.categories.filter(c=>!before.byId(c.id)).map(c=>c.id)});
}
export function legacyAdvice(row,registry){
 fail(record(row)&&registry&&typeof registry.byKey==='function','invalid_legacy','Inspect an existing listing before choosing its new classification.');
 const parsed=readClassification({category_id:row.category_id,category_version:row.category_version,attributes_json:row.attributes_json,product_type:row.product_type});
 const legacyKey=typeof row.category_id==='string'?row.category_id:typeof row.category==='string'?row.category:'';
 const root=legacyKey.split('.')[0];
 const targets={fashion:['fashion'],electronics:['electronics'],home:['home'],food:['agriculture','groceries'],creative:['creative','learning'],other:['classification-review']};
 return freeze({registryVersion:registry.version,requiresReview:true,automaticAssignment:null,legacyValid:parsed!==null,reasonCode:'seller-selection-required',suggestedGroupIds:(Object.hasOwn(targets,root)?targets[root]:[]).map(k=>registry.byKey(k)?.id).filter(Boolean)});
}
