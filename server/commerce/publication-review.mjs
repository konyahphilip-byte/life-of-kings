import { createHash } from 'node:crypto';
export const REVIEW_POLICY_VERSION='m01-pilot-review-1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code,message){throw Object.assign(Error(message),{status:400,code});}
export function parseFounderScope(value){
 if(!value)return null;
 let scope;try{scope=JSON.parse(value);}catch{fail('invalid_founder_scope','Founder review scope must contain exact account and shop IDs.');}
 if(!scope||Object.keys(scope).sort().join(',')!=='accountId,shopId'||!uuid.test(scope.accountId)||!uuid.test(scope.shopId))fail('invalid_founder_scope','Founder review scope must contain exact account and shop IDs.');
 return Object.freeze(scope);
}
export function contentHash(value){
 const stable=v=>{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  if(v&&Object.getPrototypeOf(v)===Object.prototype)return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
  fail('invalid_snapshot','The review snapshot is incomplete.');
 };
 return createHash('sha256').update(stable(value)).digest('hex');
}
export function publicationEligibility(record){
 // Conservative temporary native-pilot policy, not a universal classifier or legal certification.
 const knownRisk=/\b(pesticides?|agrochemicals?|prescription|medicines?|firearms?|ammunition|narcotics?|ivory|live animals?|explosives?|bleaching cream|skin lightening)\b/i;
 if(!['fashion','home'].includes(record.category))return {allowed:false,code:'category_review_required',message:'This category needs additional eligibility controls before publication. Saving a private draft remains available.'};
 if(knownRisk.test((String(record.name)+' '+String(record.description)).normalize('NFKC')))return {allowed:false,code:'category_review_required',message:'This listing needs specialist safety review. Changing its category cannot authorize publication.'};
 return {allowed:true,code:'manual_review',message:'An explicit review of this exact version is required.'};
}
export function reviewCapacity({actorId,admin,shop,creatorId,scope,selfReviewConfirmed,eligible}){
 const self=actorId===shop.owner_id||actorId===creatorId;
 if(!self){if(selfReviewConfirmed)fail('invalid_self_review_confirmation','Use moderator review for a listing you did not create or own.');return 'moderator_review';}
 if(!admin||!scope||scope.accountId!==actorId||scope.shopId!==shop.id||shop.owner_id!==actorId)throw Object.assign(Error('Self-review is not authorized for this account and shop.'),{status:403,code:'self_review_not_authorized'});
 if(!eligible)fail('category_review_required','Founder review cannot bypass category or safety requirements.');
 if(selfReviewConfirmed!==true)fail('self_review_confirmation','Explicitly acknowledge founder self-review. This is not independent third-party verification.');
 return 'founder_self_review';
}
export function validateReviewDecision(value){
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='contentHash,decision,reason,requestId,revision,selfReviewConfirmed'||!uuid.test(value.requestId)||!Number.isSafeInteger(value.revision)||value.revision<1||!/^[a-f0-9]{64}$/.test(value.contentHash)||!['approved','rejected'].includes(value.decision)||typeof value.selfReviewConfirmed!=='boolean')fail('invalid_review','Review the exact saved version and submit an explicit decision.');
 if(typeof value.reason!=='string'||value.reason.trim().length<5||value.reason.length>500||/[<>\u0000-\u001f\u007f]/.test(value.reason))fail('review_reason_required','Explain your review decision in 5–500 readable characters.');
 return {...value,reason:value.reason.trim()};
}
export function reviewSnapshot(kind,row,shop,gallery=[]){
 if(kind==='shop')return {kind,shopId:shop.id,creatorId:shop.owner_id,revision:1,content:{name:shop.name,slug:shop.slug,ownerId:shop.owner_id}};
 return {kind,shopId:shop.id,targetId:row.id,creatorId:row.created_by,revision:Number(row.revision),content:{
  title:row.name,description:row.description,categoryId:row.category,currency:row.currency,priceMinor:Number(row.price_minor),stock:Number(row.stock),variants:JSON.parse(row.variants_json),
  availability:row.availability,collection:row.collection_name,gallery:gallery.map(p=>({assetId:p.assetId,alt:p.alt}))
 }};
}
