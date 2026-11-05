import {createHash} from 'node:crypto';

const fields=new Set(['q','category','seller','source','minPrice','maxPrice','inStock','sort','limit','cursor','productId']);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp=value=>new Date(value).toISOString();

export function catalogInput(query,assert){
 for(const key of query.keys())assert(fields.has(key)&&query.getAll(key).length===1,400,'invalid_catalog_query','Use one value per supported catalog filter.');
 const text=(key,max)=>{
  const value=(query.get(key)||'').trim();
  assert(value.length<=max&&!/[\u0000-\u001f]/.test(value),400,'invalid_catalog_query','A catalog filter is too long or invalid.');
  return value;
 };
 const integer=(key,fallback,max)=>{
  const raw=query.get(key);if(raw===null)return fallback;
  assert(/^\d{1,10}$/.test(raw)&&Number.isSafeInteger(Number(raw))&&Number(raw)<=max,400,'invalid_catalog_query','Use valid whole-number catalog limits and prices.');
  return Number(raw);
 };
 const input={q:text('q',100),category:text('category',80),seller:text('seller',41).replace(/^@/,'').toLowerCase(),source:text('source',20),productId:text('productId',36),minPrice:integer('minPrice',null,2147483647),maxPrice:integer('maxPrice',null,2147483647),inStock:query.get('inStock')==='1',sort:text('sort',12)||'newest',limit:integer('limit',12,24)};
 assert(input.limit>0&&['newest','price_low','price_high'].includes(input.sort)&&['','direct','csv','shopify'].includes(input.source),400,'invalid_catalog_query','Choose a supported catalog filter.');
 assert(!query.has('inStock')||['0','1'].includes(query.get('inStock')),400,'invalid_catalog_query','Choose available stock or all stock.');
 assert(!input.seller||/^[a-z0-9._-]{3,40}$/.test(input.seller),400,'invalid_catalog_query','Use the seller’s public EcoVibes ID.');
 assert(!input.productId||uuid.test(input.productId),400,'invalid_catalog_query','Choose a valid catalog item.');
 assert(input.minPrice===null||input.maxPrice===null||input.minPrice<=input.maxPrice,400,'invalid_catalog_query','The minimum price cannot exceed the maximum.');
 const {limit,...filter}=input;
 input.fingerprint=digest(filter);
 if(query.has('cursor')){
  try{
   const raw=query.get('cursor');if(raw.length>600||!/^[a-zA-Z0-9_-]+$/.test(raw))throw Error();
   const after=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
   if(!after||Object.keys(after).sort().join(',')!=='filter,id,price,stamp,v'||after.v!==1||after.filter!==input.fingerprint||!uuid.test(after.id)||typeof after.stamp!=='string'||stamp(after.stamp)!==after.stamp||!Number.isInteger(after.price)||after.price<1||after.price>2147483647)throw Error();
   input.after=after;
  }catch{assert(false,400,'invalid_catalog_cursor','Refresh this search before loading more listings.');}
 }
 return input;
}
export function catalogCursor(row,input){
 return Buffer.from(JSON.stringify({v:1,filter:input.fingerprint,id:row.id,stamp:stamp(row.created_at),price:Number(row.price_minor)})).toString('base64url');
}
export function createCatalog({all,assert,publicProduct,now,enabled=()=>true}){
 return async function catalog(ctx,query){
  assert(enabled(),503,'catalog_unavailable','Current Marketplace listings are temporarily unavailable. Please try again later.');
  const input=catalogInput(query,assert),where=["p.status='active'","u.status='active'","p.fulfillment_type<>'external_checkout'","p.currency='GHS'","EXISTS(SELECT 1 FROM roles r WHERE r.user_id=p.seller_id AND r.role='seller')"],params=[];
  if(input.q){
   const like='%'+input.q.toLowerCase().replace(/[!%_]/g,'!$&')+'%';
   where.push("(LOWER(p.name) LIKE ? ESCAPE '!' OR LOWER(p.description) LIKE ? ESCAPE '!' OR LOWER(p.category) LIKE ? ESCAPE '!')");
   params.push(like,like,like);
  }
  for(const [key,column]of[['category','p.category'],['seller','u.eco_id']])if(input[key]){where.push('LOWER('+column+')=?');params.push(input[key].toLowerCase());}
  if(input.source){where.push('p.source_type=?');params.push(input.source);}
  if(input.productId){where.push('p.id=?');params.push(input.productId);}
  if(input.minPrice!==null){where.push('p.price_minor>=?');params.push(input.minPrice);}
  if(input.maxPrice!==null){where.push('p.price_minor<=?');params.push(input.maxPrice);}
  if(input.inStock)where.push('p.stock>0');
  const tie='(p.created_at<? OR (p.created_at=? AND p.id<?))';
  if(input.after){
   const a=input.after;
   if(input.sort==='newest'){where.push(tie);params.push(a.stamp,a.stamp,a.id);}
   else{where.push('(p.price_minor'+(input.sort==='price_low'?'>':'<')+'? OR (p.price_minor=? AND '+tie+'))');params.push(a.price,a.price,a.stamp,a.stamp,a.id);}
  }
  const order=(input.sort==='newest'?'':('p.price_minor '+(input.sort==='price_low'?'ASC':'DESC')+','))+'p.created_at DESC,p.id DESC';
  params.push(input.limit+1);
  const rows=await all('SELECT p.*,u.eco_id seller_eco_id,u.display_name seller_name FROM products p JOIN users u ON u.id=p.seller_id WHERE '+where.join(' AND ')+' ORDER BY '+order+' LIMIT ?',...params);
  const page=rows.slice(0,input.limit);
  return {items:page.map(row=>publicProduct(row,ctx)),nextCursor:rows.length>input.limit?catalogCursor(page.at(-1),input):null,checkedAt:now(),currency:'GHS',scope:'Published seller listings. Stock and item prices are checked again in your account bag.'};
 };
}
