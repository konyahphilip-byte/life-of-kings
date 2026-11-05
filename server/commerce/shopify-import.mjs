const gid=/^gid:\/\/shopify\/Product\/[1-9]\d{0,24}$/;
const variantGid=/^gid:\/\/shopify\/ProductVariant\/[1-9]\d{0,24}$/;
export const SHOPIFY_FIELDS='id title descriptionHtml productType status featuredImage{url} variants(first:50){edges{node{id title price inventoryQuantity selectedOptions{name value}}} pageInfo{hasNextPage}}';
export const SHOPIFY_PRODUCTS_QUERY='query Products($after:String){shop{currencyCode} products(first:50,after:$after,query:"status:active"){edges{node{'+SHOPIFY_FIELDS+'}} pageInfo{hasNextPage endCursor}}}';
export const SHOPIFY_SELECTED_QUERY='query SelectedProducts($ids:[ID!]!){shop{currencyCode} nodes(ids:$ids){... on Product{'+SHOPIFY_FIELDS+'}}}';
export function selectedShopifyIds(value){if(value===undefined)return null;if(!Array.isArray(value)||!value.length||value.length>25||!value.every(id=>typeof id==='string'&&gid.test(id))||new Set(value).size!==value.length)throw Error('Choose one to 25 distinct Shopify products.');return value;}
export function shopifyMinor(value){
 if(typeof value!=='string'||!/^\d{1,8}(?:\.\d{1,2})?$/.test(value))throw Error('Invalid Shopify price.');
 const [whole,decimal='']=value.split('.'),minor=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor<1||minor>2147483647)throw Error('Shopify price is out of range.');return minor;
}
export function shopifyImageUrl(value){
 if(!value)return null;const u=new URL(value);
 if(u.protocol!=='https:'||u.hostname!=='cdn.shopify.com'||u.port||u.username||u.password||!u.pathname.startsWith('/s/files/')||u.hash)throw Error('Unsupported Shopify image source.');return u.toString();
}
export function normalizeShopifyProduct(item){
 if(!item||!gid.test(item.id)||item.status!=='ACTIVE'||typeof item.title!=='string'||!item.title.trim())throw Error('Shopify product is not active or valid.');
 const edges=item.variants?.edges;
 if(!Array.isArray(edges)||!edges.length||edges.length>50||item.variants.pageInfo?.hasNextPage!==false)throw Error('Complete Shopify variant data is required.');
 const variants=edges.map(({node:v})=>{
  if(!v||!variantGid.test(v.id)||typeof v.title!=='string'||!v.title.trim()||v.title.length>120)throw Error('Invalid Shopify variant.');
  if(v.inventoryQuantity!==null&&(!Number.isSafeInteger(v.inventoryQuantity)||Math.abs(v.inventoryQuantity)>1000000))throw Error('Invalid Shopify inventory.');
  return {id:v.id,title:v.title,priceMinor:shopifyMinor(v.price),stock:v.inventoryQuantity===null?null:Math.max(0,v.inventoryQuantity),options:Array.isArray(v.selectedOptions)?v.selectedOptions.slice(0,3).map(o=>({name:String(o.name).slice(0,50),value:String(o.value).slice(0,80)})):[]};
 });
 if(new Set(variants.map(v=>v.id)).size!==variants.length)throw Error('Repeated Shopify variant.');
 const stock=variants.every(v=>v.stock!==null)?variants.reduce((n,v)=>n+v.stock,0):0;if(stock>2147483647)throw Error('Inventory is out of range.');
 return {sourceId:item.id,name:item.title.trim().slice(0,100),description:String(item.descriptionHtml||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,3000),category:String(item.productType||'Imported').slice(0,80),priceMinor:Math.min(...variants.map(v=>v.priceMinor)),stock,variants,imageUrl:shopifyImageUrl(item.featuredImage?.url)};
}
// Source reads finish before the transaction. Published inventory is never overwritten.
export async function saveShopifyDrafts({items,connection,ctx,q,run,transaction,authorize,assert,now,id,event,postgresMode}){
 assert(new Set(items.filter(Boolean).map(i=>i.id)).size===items.filter(Boolean).length,502,'shopify_sync_failed','Repeated source records could not be confirmed. No drafts were changed.');
 const valid=[],skipped=[];for(const item of items){try{valid.push(normalizeShopifyProduct(item));}catch{skipped.push({sourceId:gid.test(item?.id)?item.id:null,reason:'Product, price, inventory, image or complete variant data needs review.'});}}
 return transaction(async()=>{
  await authorize(ctx,'seller');
  const current=await q("SELECT id FROM store_connections WHERE id=? AND seller_id=? AND status='active'"+(postgresMode?' FOR UPDATE':''),connection.id,ctx.user.id);assert(current,404,'store_not_found','Connected store not found.');
  let imported=0,publishedKept=0;
  for(const p of valid.sort((a,b)=>a.sourceId.localeCompare(b.sourceId))){
   const existing=await q("SELECT id,status FROM products WHERE seller_id=? AND source_type='shopify' AND source_external_id=?"+(postgresMode?' FOR UPDATE':''),ctx.user.id,p.sourceId);
   if(existing&&existing.status!=='paused'){publishedKept++;continue;}
   const key=existing?.id||id(),stamp=now();
   if(existing)await run('UPDATE products SET name=?,description=?,category=?,price_minor=?,stock=?,variants_json=?,image_url=?,category_id=NULL,category_version=NULL,attributes_json=\'{}\',updated_at=? WHERE id=?',p.name,p.description,p.category,p.priceMinor,p.stock,JSON.stringify(p.variants),p.imageUrl,stamp,key);
   else await run("INSERT INTO products(id,seller_id,name,description,category,price_minor,stock,variants_json,fulfillment_type,image_url,source_type,source_url,source_external_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'own_inventory',?,'shopify',?,?,'paused',?,?)",key,ctx.user.id,p.name,p.description,p.category,p.priceMinor,p.stock,JSON.stringify(p.variants),p.imageUrl,'https://'+connection.shop_domain+'/admin/products/'+p.sourceId.split('/').at(-1),p.sourceId,stamp,stamp);
   imported++;
  }
  await run('UPDATE store_connections SET last_synced_at=?,updated_at=? WHERE id=?',now(),now(),connection.id);
  await event(ctx.user.id,'store_connection',connection.id,'SHOPIFY_DRAFTS_IMPORTED',{imported,publishedKept,skipped:skipped.length});
  return {imported,publishedKept,skipped,status:'review_required'};
 });
}
