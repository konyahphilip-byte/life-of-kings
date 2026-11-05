import {createHash} from 'node:crypto';
import {normalizeClassification} from '../../shared/marketplace-taxonomy.mjs';
export const PUBLICATION_VERSION='20261105170000_product_publications';
export const PUBLICATION_SQLITE_SCHEMA=`CREATE TABLE IF NOT EXISTS commerce_product_publications(user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,request_hash TEXT NOT NULL,product_id TEXT NOT NULL REFERENCES products(id),published_at TEXT NOT NULL,PRIMARY KEY(user_id,client_id));`;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function productReviewHash(p){return hash([p.id,p.seller_id,p.status,p.name,p.description,p.category,p.category_id,p.category_version,p.attributes_json,p.price_minor,p.stock,p.variants_json,p.image_url,p.fulfillment_type,p.shipping_info,p.location,p.source_type,p.source_external_id,new Date(p.updated_at).toISOString()]);}
export function publicationInput(body,assert){
 const fields=['ownerId','clientId','reviewHash','categoryId','categoryVersion','attributes','variantStock','fulfillmentType','shippingInfo','location','confirmedSupply','copyPhoto','mediaConsent'];
 assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===fields.length&&Object.keys(body).every(k=>fields.includes(k)),400,'invalid_publication','Review every publication field.');
 assert(typeof body.clientId==='string'&&uuid.test(body.clientId)&&typeof body.reviewHash==='string'&&/^[a-f0-9]{64}$/.test(body.reviewHash),400,'invalid_publication','Reopen this product review.');
 assert(body.confirmedSupply===true&&typeof body.copyPhoto==='boolean'&&typeof body.mediaConsent==='boolean'&&body.mediaConsent===body.copyPhoto,400,'publication_consent','Confirm availability and your separate product photo choice.');
 assert(['own_inventory','supplier_fulfilled','dropship'].includes(body.fulfillmentType),400,'invalid_fulfillment','Choose how this product will be fulfilled.');
 for(const[key,max]of[['shippingInfo',200],['location',120]])assert(typeof body[key]==='string'&&body[key].trim().length>0&&body[key].length<=max&&!/[\u0000-\u001f]/.test(body[key]),400,'invalid_fulfillment','Add your area and pickup/delivery terms, including costs.');
 assert(Array.isArray(body.variantStock)&&body.variantStock.length>0&&body.variantStock.length<=50,400,'invalid_stock','Review the quantity of each variant.');
 const stocks=body.variantStock.map(v=>{assert(v&&Object.keys(v).sort().join(',')==='id,stock'&&typeof v.id==='string'&&Number.isSafeInteger(v.stock)&&v.stock>=0&&v.stock<=1000000,400,'invalid_stock','Use valid whole-number quantities.');return {id:v.id,stock:v.stock};}).sort((a,b)=>a.id.localeCompare(b.id));
 assert(new Set(stocks.map(v=>v.id)).size===stocks.length,400,'invalid_stock','Choose each variant once.');
 const classification=normalizeClassification(body,assert,'physical');
 return {...body,...classification,clientId:body.clientId.toLowerCase(),shippingInfo:body.shippingInfo.trim(),location:body.location.trim(),variantStock:stocks};
}
export function createPublicationService({q,run,transaction,authorize,assert,now,event,postgresMode,rowProduct,preparePhoto,discardPhoto,available=true,enabled=()=>true}){
 const lock=postgresMode?' FOR UPDATE':'';
 const authorized=async ctx=>{if(postgresMode)await q('SELECT id FROM users WHERE id=? FOR UPDATE',ctx.user.id);await authorize(ctx,'seller');};
 const owned=async(ctx,id)=>{const row=await q('SELECT * FROM products WHERE id=? AND seller_id=?'+lock,id,ctx.user.id);assert(row,404,'product_not_found','Product not found.');return row;};
 return async function publish(ctx,productId,body){
  assert(ctx.user,401,'sign_in_required','Sign in to review your own product.');
  assert(available&&enabled(),503,'publication_unavailable','Reviewed publishing is temporarily unavailable. Your draft is retained.');
  const input=publicationInput(body,assert);assert(input.ownerId===ctx.user?.id,409,'account_changed','Your account changed. Reopen your seller review.');
  const requestHash=hash({...input,productId}),clientId=input.clientId;
  async function receipt(){const previous=await q('SELECT * FROM commerce_product_publications WHERE user_id=? AND client_id=?',ctx.user.id,clientId);if(!previous)return null;assert(previous.request_hash===requestHash&&previous.product_id===productId,409,'publication_changed','This saved publication request cannot be changed.');const current=await owned(ctx,productId);return {ownerId:ctx.user.id,publicationId:clientId,productId,publishedAt:previous.published_at,replayed:true,currentStatus:current.status,product:rowProduct(current,ctx.user.eco_id)};}
  const initial=await transaction(async()=>{await authorized(ctx);const replay=await receipt();if(replay)return {replay};const product=await owned(ctx,productId);assert(product.status==='paused'&&product.source_type==='shopify'&&productReviewHash(product)===input.reviewHash,409,'review_changed','The product changed. Refresh it before publishing.');return {product};});
  if(initial.replay)return initial.replay;
  let photo=null;
  try{
   if(input.copyPhoto)photo=await preparePhoto(ctx,initial.product,hash([ctx.user.id,clientId,requestHash]));
   return await transaction(async()=>{
    await authorized(ctx);const replay=await receipt();if(replay)return replay;
    const product=await owned(ctx,productId);assert(product.status==='paused'&&product.source_type==='shopify'&&productReviewHash(product)===input.reviewHash,409,'review_changed','The product changed. Refresh it before publishing.');
    let variants;try{variants=JSON.parse(product.variants_json);}catch{assert(false,409,'review_changed','Variant data needs another import.');}
    assert(Array.isArray(variants)&&variants.length===input.variantStock.length,400,'invalid_stock','Review every imported variant.');
    let total=0;const allocated=variants.map(v=>{const choice=input.variantStock.find(i=>i.id===v.id);assert(choice&&Number.isSafeInteger(v.stock)&&v.stock>=choice.stock&&Number.isSafeInteger(v.priceMinor)&&v.priceMinor>0,409,'stock_unconfirmed','Stock or price is unknown or changed. Confirm it at source and re-import.');total+=choice.stock;return {...v,stock:choice.stock};});
    assert(total>0&&total<=2147483647,400,'invalid_stock','Allocate at least one available item to EcoVibes.');
    if(photo)assert(await q('SELECT id FROM media_assets WHERE id=? AND owner_id=?',photo.id,ctx.user.id),409,'media_changed','The selected photo changed. Retry the review.');
    const stamp=now();
    await run("UPDATE products SET category=?,category_id=?,category_version=?,attributes_json=?,stock=?,variants_json=?,fulfillment_type=?,shipping_info=?,location=?,image_url=?,status='active',updated_at=? WHERE id=? AND seller_id=?",input.category,input.categoryId,input.categoryVersion,JSON.stringify(input.attributes),total,JSON.stringify(allocated),input.fulfillmentType,input.shippingInfo,input.location,photo?.url||null,stamp,productId,ctx.user.id);
    await event(ctx.user.id,'product',productId,'SHOPIFY_PRODUCT_PUBLISHED',{variantCount:allocated.length,hasPhoto:Boolean(photo)});
    await run('INSERT INTO commerce_product_publications(user_id,client_id,request_hash,product_id,published_at) VALUES(?,?,?,?,?)',ctx.user.id,clientId,requestHash,productId,stamp);
    const current=await owned(ctx,productId);return {ownerId:ctx.user.id,publicationId:clientId,productId,publishedAt:stamp,replayed:false,currentStatus:current.status,product:rowProduct(current,ctx.user.eco_id)};
   });
  }catch(error){if(photo?.created)await discardPhoto(ctx,photo).catch(()=>undefined);throw error;}
 };
}
