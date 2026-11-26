import { defaultTheme, validateTheme } from '../../shared/storefront/design.mjs';
import { NATIVE_STUDIO_VERSION } from './native-schema.mjs';
export { NATIVE_STUDIO_VERSION };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = ['fashion','beauty','home'];
const rights = {
 owner: ['read','product','theme','apply','reply','slug'],
 administrator: ['read','product','theme','reply'],
 product_manager: ['read','product'],designer:['read','theme'],enquiry_operator:['read','reply'],analyst:['read']
};
export const PUBLIC_NATIVE_FROM = `FROM products p
 JOIN m01_product_publication v ON v.product_id=p.id
 JOIN m01_shops s ON s.id=v.shop_id AND s.owner_id=p.seller_id
 JOIN users u ON u.id=s.owner_id
 WHERE p.status='active' AND p.fulfillment_type='own_inventory'
 AND v.publication='published' AND v.moderation='approved' AND v.approved_revision=v.revision
 AND s.status='active' AND s.visibility='public' AND u.status='active'
 AND EXISTS(SELECT 1 FROM roles r WHERE r.user_id=u.id AND r.role='seller')
 AND p.category IN ('fashion','beauty','home')`;
export function createNativeStudio({ q, all, run, transaction, assert, now, id, event, notify, rateLimit,
 postgresMode, available, enabled, requireStaff, storeMediaAsset, loadMediaAsset, removeMediaAsset, normalizePhoto }) {
 const stop = (code='shop_unavailable', message='This shop is unavailable.', status=404) => assert(false,status,code,message);
 const exact = (body, keys) => assert(body && Object.getPrototypeOf(body)===Object.prototype &&
   Object.keys(body).length===keys.length && Object.keys(body).every(k=>keys.includes(k)),400,'invalid_fields','Refresh this form and use only its supported fields.');
 const text = (value, min, max, label) => {
   assert(typeof value==='string' && value.trim().length>=min && value.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/.test(value),400,'invalid_field','Check '+label+'.');
   return value.trim();
 };
 const uuid = value => { assert(typeof value==='string' && UUID.test(value),400,'invalid_id','Refresh this view and try again.'); return value; };
 const integer = (value,min=0,max=1_000_000) => assert(Number.isSafeInteger(value)&&value>=min&&value<=max,400,'invalid_number','Use valid whole quantities and prices.');
 const slug = value => {
   assert(typeof value==='string' && /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/.test(value) &&
    !['api','admin','studio','discover','shops','products','login','auth','support','profile','public','settings'].includes(value),400,'invalid_slug','Choose a shop link with 3–60 lowercase letters, numbers or hyphens.');
   return value;
 };
 async function auth(ctx) {
   assert(ctx.user?.status==='active' && typeof ctx.sessionHash==='string',401,'sign_in_required','Sign in to open Seller Studio.');
   assert(await q("SELECT 1 ok FROM sessions t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.user_id=? AND t.csrf_token=? AND t.expires_at>? AND u.status='active'",ctx.sessionHash,ctx.user.id,ctx.csrfToken,now()),401,'sign_in_required','Your session changed. Sign in again.');
   return ctx.user.id;
 }
 async function lockAccounts(ids){
   for(const accountId of [...new Set(ids)].sort())assert((await run("UPDATE users SET id=id WHERE id=? AND status='active'",accountId)).changes===1,404,'account_unavailable','This account is unavailable.');
 }
 async function shopAccess(ctx,shopId,capability='read') {
   const actor=await auth(ctx);
   const initial=await q('SELECT owner_id FROM m01_shops WHERE id=?',shopId);if(!initial)stop();
   await lockAccounts([actor,initial.owner_id]);
   const shop=await q(`SELECT s.*,u.eco_id owner_eco_id,u.status owner_status FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE s.id=?${postgresMode?' FOR UPDATE OF s':''}`,shopId);
   const member=await q('SELECT * FROM m01_shop_members WHERE shop_id=? AND user_id=?'+(postgresMode?' FOR UPDATE':''),shopId,actor);
   if(!shop || shop.status==='suspended' || shop.owner_status!=='active' || member?.status!=='active' ||
    !Object.hasOwn(rights,member.role) || !rights[member.role].includes(capability))stop();
   assert(await q("SELECT 1 ok FROM roles WHERE user_id=? AND role='seller'",shop.owner_id),404,'shop_unavailable','This shop is unavailable.');
   return shop;
 }
 const dtoShop = s => ({ id:s.id,name:s.name,slug:s.slug,ownerEcoId:s.owner_eco_id,status:s.status,visibility:s.visibility,path:'/shops/'+s.slug });
 async function gallery(productId,privateView=false) {
   return (await all('SELECT m.asset_id,m.alt FROM m01_product_media m WHERE m.product_id=? ORDER BY m.position',productId))
    .map(m=>({assetId:m.asset_id,alt:m.alt,url:privateView?'/api/v1/studio/shops/'+privateView+'/photos/'+m.asset_id:'/api/v1/public/photos/'+m.asset_id}));
 }
 async function productView(row,privateView=false) {
   const base={id:row.id,shopId:row.shop_id,title:row.name,description:row.description,categoryId:row.category,
    currency:row.currency,priceMinor:Number(row.price_minor),availability:row.availability,stock:Number(row.stock),
    variants:JSON.parse(row.variants_json),collection:row.collection_name,gallery:await gallery(row.id,privateView),
    revision:Number(row.revision),shopSlug:row.slug,shopName:row.shop_name,ownerEcoId:row.owner_eco_id,
    path:'/products/'+row.id,shopPath:'/shops/'+row.slug};
   return privateView?{...base,publication:row.publication,moderation:row.moderation,approvedRevision:row.approved_revision}:base;
 }
 const SELECT = 'SELECT p.*,v.shop_id,v.revision,v.publication,v.moderation,v.approved_revision,v.availability,v.collection_name,s.slug,s.name shop_name,u.eco_id owner_eco_id ';
 async function publicCatalog({ shopId, listingId, query='', category, before }={}) {
   if(!enabled||!available)return [];
   assert(typeof query==='string' && query.length<=100 && (!category||categories.includes(category)),400,'invalid_query','Use a supported category and a search under 100 characters.');
   const conditions=[],params=[];
   if(shopId){conditions.push('s.id=?');params.push(uuid(shopId));}
   if(listingId){conditions.push('p.id=?');params.push(uuid(listingId));}
   if(category){conditions.push('p.category=?');params.push(category);}
   if(query){conditions.push('(lower(p.name) LIKE ? OR lower(p.description) LIKE ?)');const term='%'+query.toLowerCase().replace(/[\\%_]/g,'')+'%';params.push(term,term);}
   if(before){conditions.push('p.id>?');params.push(uuid(before));}
   const rows=await all(SELECT+PUBLIC_NATIVE_FROM+(conditions.length?' AND '+conditions.join(' AND '):'')+' ORDER BY p.id LIMIT 26',...params);
   return Promise.all(rows.map(row=>productView(row)));
 }
 async function loadProduct(ctx,productId,capability='product') {
   const row=await q('SELECT p.*,v.* FROM products p JOIN m01_product_publication v ON v.product_id=p.id WHERE p.id=?',uuid(productId));
   if(!row)stop('product_unavailable','This product is unavailable.');
   const shop=await shopAccess(ctx,row.shop_id,capability);
   const current=await q('SELECT p.*,v.* FROM products p JOIN m01_product_publication v ON v.product_id=p.id WHERE p.id=?',productId);
   return {row:current,shop};
 }
 async function privateProduct(productId) {
   const row=await q(SELECT+'FROM products p JOIN m01_product_publication v ON v.product_id=p.id JOIN m01_shops s ON s.id=v.shop_id JOIN users u ON u.id=s.owner_id WHERE p.id=?',productId);
   return productView(row,row.shop_id);
 }
 function input(body) {
   const result={title:text(body.title,2,100,'the product title'),description:text(body.description,0,3000,'the description'),
    categoryId:body.categoryId,priceMinor:body.priceMinor,availability:body.availability,stock:body.stock,
    collection:text(body.collection,0,60,'the collection name'),variants:body.variants,gallery:body.gallery};
   assert(categories.includes(result.categoryId),400,'invalid_category','Choose Fashion, Beauty or Home for this pilot.');
   integer(result.priceMinor,1,100_000_000); integer(result.stock,0);
   assert(['in_stock','made_to_order','out_of_stock'].includes(result.availability),400,'invalid_availability','Choose the current availability.');
   assert(Array.isArray(result.variants)&&result.variants.length<=30,400,'invalid_variants','Use at most 30 variants.');
   const names=new Set();
   for(const v of result.variants){exact(v,['id','label','priceMinor','stock']);text(v.id,1,40,'variant ID');text(v.label,1,80,'variant label');integer(v.priceMinor,1,100_000_000);integer(v.stock);assert(!names.has(v.id),400,'duplicate_variant','Each variant needs a unique ID.');names.add(v.id);}
   if(result.variants.length)assert(result.stock===result.variants.reduce((n,v)=>n+v.stock,0)&&result.priceMinor===Math.min(...result.variants.map(v=>v.priceMinor)),400,'variant_totals','Set the total stock and starting price to match your variants.');
   assert(Array.isArray(result.gallery)&&result.gallery.length<=6&&new Set(result.gallery.map(x=>x.assetId)).size===result.gallery.length,400,'invalid_gallery','Use up to six distinct photos.');
   for(const m of result.gallery){exact(m,['assetId','alt']);uuid(m.assetId);text(m.alt,1,180,'the photo description');}
   if(result.availability==='out_of_stock')assert(result.stock===0,400,'stock_conflict','Out-of-stock products must have zero stock.');
   if(result.availability==='in_stock')assert(result.stock>0,400,'stock_conflict','Add a real quantity or choose made to order / out of stock.');
   return result;
 }
 const fields=['title','description','categoryId','priceMinor','availability','stock','variants','gallery','collection'];
 async function saveMedia(productId,shopId,media) {
   for(const m of media)assert(await q('SELECT 1 ok FROM m01_photos WHERE asset_id=? AND shop_id=?',m.assetId,shopId),400,'photo_scope','Use a photo uploaded to this shop.');
   await run('DELETE FROM m01_product_media WHERE product_id=?',productId);
   for(let position=0;position<media.length;position++){const m=media[position];await run('INSERT INTO m01_product_media(product_id,asset_id,position,alt) VALUES(?,?,?,?)',productId,m.assetId,position,m.alt);}
 }
 async function validation(row) {
   const issues=[];
   if(!row.description.trim())issues.push({field:'description',message:'Add a useful product description.'});
   if(!(await gallery(row.id)).length)issues.push({field:'gallery',message:'Upload at least one photo you are authorized to use.'});
   if(row.status==='removed')issues.push({field:'status',message:'Archived products cannot be published.'});
   return {valid:issues.length===0,issues,revision:Number(row.revision)};
 }
 async function staff(ctx) {
   const actor=await auth(ctx);requireStaff(ctx,'trust_staff');
   assert(await q("SELECT 1 ok FROM staff_access WHERE user_id=? AND staff_role IN ('admin','trust_staff')",actor),403,'staff_required','Authorized marketplace review is required.');
   return actor;
 }
 async function themeState(shop) {
   const current=await q('SELECT * FROM m01_theme_current WHERE shop_id=?',shop.id);
   const history=await all('SELECT version,config_json,created_at FROM m01_theme_versions WHERE shop_id=? ORDER BY version DESC LIMIT 30',shop.id);
   const products=await all('SELECT product_id id FROM m01_product_publication WHERE shop_id=?',shop.id);
   return {version:Number(current?.draft_version||0),appliedVersion:current?.applied_version||null,
    config:history.length?JSON.parse(history[0].config_json):defaultTheme({id:shop.id,products}),
    history:history.map(h=>({version:Number(h.version),config:JSON.parse(h.config_json),createdAt:h.created_at}))};
 }
 async function saveTheme(ctx,shop,body) {
   const state=await themeState(shop);
   assert(body.expectedVersion===state.version,409,'theme_changed','A newer theme was saved. Reload before making another change.');
   const products=await all('SELECT product_id id FROM m01_product_publication WHERE shop_id=?',shop.id);
   let config;try{config=validateTheme(body.config,{id:shop.id,products});}catch{stop('invalid_theme','Choose supported theme settings and products from this shop.',400);}
   const version=state.version+1;
   await run('INSERT INTO m01_theme_versions(shop_id,version,config_json,actor_id,created_at) VALUES(?,?,?,?,?)',shop.id,version,JSON.stringify(config),ctx.user.id,now());
   await run('INSERT INTO m01_theme_current(shop_id,draft_version) VALUES(?,?) ON CONFLICT(shop_id) DO UPDATE SET draft_version=excluded.draft_version',shop.id,version);
   await event(ctx.user.id,'shop',shop.id,'SHOP_THEME_SAVED',{version});
   return themeState(shop);
 }
 async function enquiryScope(ctx,enquiryId,reply=false) {
   const actor=await auth(ctx);
   const e=await q('SELECT * FROM connect_product_enquiries WHERE id=?',uuid(enquiryId));
   if(!e)stop('conversation_unavailable','This enquiry is unavailable.');
   const initial=await q('SELECT owner_id FROM m01_shops WHERE id=?',e.shop_id);if(!initial)stop('conversation_unavailable','This enquiry is unavailable.');
   await lockAccounts([actor,e.buyer_id,initial.owner_id]);
   const shop=await q(`SELECT s.*,u.status owner_status FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE s.id=?${postgresMode?' FOR UPDATE OF s':''}`,e.shop_id);
   if(!shop || shop.status!=='active'||shop.owner_status!=='active'||!(await q("SELECT 1 ok FROM users WHERE id=? AND status='active'",e.buyer_id)))stop('conversation_unavailable','This enquiry is unavailable.');
   if(actor!==e.buyer_id)await shopAccess(ctx,shop.id,'reply');
   const [low,high]=[e.buyer_id,shop.owner_id].sort();
   const block=await q('SELECT low_blocked,high_blocked FROM people_friendships WHERE low_user_id=? AND high_user_id=?'+(postgresMode?' FOR UPDATE':''),low,high);
   if(Number(block?.low_blocked)||Number(block?.high_blocked))stop('conversation_unavailable','This enquiry is unavailable.');
   return {e,shop};
 }
 async function sendMessage(ctx,enquiryId,body) {
   exact(body,['clientId','body']);uuid(body.clientId);const content=text(body.body,1,2000,'your message');
   const {e,shop}=await enquiryScope(ctx,enquiryId,true);
   assert(e.state==='open',409,'enquiry_closed','This enquiry is closed.');
   const old=await q('SELECT * FROM connect_enquiry_messages WHERE sender_id=? AND client_id=?',ctx.user.id,body.clientId);
   if(old){assert(old.enquiry_id===e.id&&old.body===content,409,'message_retry_changed','This retry belongs to another message.');return {id:old.id};}
   const messageId=id();
   await run('INSERT INTO connect_enquiry_messages(id,enquiry_id,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?)',messageId,e.id,ctx.user.id,body.clientId,content,now());
   await event(ctx.user.id,'product_enquiry',e.id,'PRODUCT_ENQUIRY_MESSAGE_SENT',{shopId:shop.id});
   await notify(ctx.user.id===e.buyer_id?shop.owner_id:e.buyer_id,'direct_message','New product enquiry message','Open Connect to read your private enquiry.','product_enquiry',e.id);
   return {id:messageId};
 }
 async function coreRoute(ctx,method,path,body,query) {
   assert(enabled&&available,503,'studio_unavailable','Seller Studio is not enabled here.');
   if(path.startsWith('/public/')){
    assert(method==='GET',405,'method_not_allowed','Use a read-only public view.');
    if(path==='/public/catalogue'){
     assert([...query.keys()].every(k=>['q','category','shopId','before'].includes(k))&&query.size<=4,400,'invalid_query','Use the public search controls.');
     const products=await publicCatalog({query:query.get('q')||'',category:query.get('category'),shopId:query.get('shopId'),before:query.get('before')});
     return {products:products.slice(0,25),nextCursor:products.length>25?products[24].id:null,verifiedAt:now(),indexMode:'authoritative-read'};
    }
    const product=path.match(/^\/public\/products\/([a-f0-9-]{36})$/i);
    if(product){const products=await publicCatalog({listingId:product[1]});if(!products.length)stop('product_unavailable','This product is unavailable.');return {product:products[0],verifiedAt:now()};}
    const shopMatch=path.match(/^\/public\/shops\/([a-z0-9-]{3,60})$/);
    if(shopMatch){
     const shop=await q("SELECT s.*,u.eco_id owner_eco_id FROM m01_shop_aliases a JOIN m01_shops s ON s.id=a.shop_id JOIN users u ON u.id=s.owner_id WHERE a.slug=? AND s.status='active' AND s.visibility='public' AND u.status='active' AND EXISTS(SELECT 1 FROM roles WHERE user_id=u.id AND role='seller')",shopMatch[1]);
     if(!shop)stop();const state=await themeState(shop);
     const applied=state.appliedVersion?await q('SELECT config_json FROM m01_theme_versions WHERE shop_id=? AND version=?',shop.id,state.appliedVersion):null;
     const products=(await publicCatalog({shopId:shop.id})).slice(0,25),config=applied?JSON.parse(applied.config_json):defaultTheme({id:shop.id,products});
     config.productIds=config.productIds.filter(id=>products.some(p=>p.id===id));
     return {shop:dtoShop(shop),products,theme:config,canonicalPath:'/shops/'+shop.slug};
    }
    const profile=path.match(/^\/public\/profiles\/([a-z0-9._]{3,24})\/shops$/);
    if(profile)return {shops:(await all("SELECT s.*,u.eco_id owner_eco_id FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE u.eco_id=? AND u.status='active' AND s.status='active' AND s.visibility='public' AND EXISTS(SELECT 1 FROM roles WHERE user_id=u.id AND role='seller') ORDER BY s.id LIMIT 25",profile[1])).map(dtoShop)};
    const photo=path.match(/^\/public\/photos\/([a-f0-9-]{36})$/i);
    if(photo){
     // The explicit lookup below uses exactly the shared catalogue eligibility.
     const allowed=await q('SELECT p.id '+PUBLIC_NATIVE_FROM+' AND EXISTS(SELECT 1 FROM m01_product_media m WHERE m.product_id=p.id AND m.asset_id=?) LIMIT 1',photo[1]);
     if(!allowed)stop('asset_not_found','This photo is unavailable.');
     const asset=await q('SELECT * FROM media_assets WHERE id=?',photo[1]);
     return {__media:await loadMediaAsset(asset.id),mimeType:asset.mime_type};
    }
    return stop('not_found','Public page not found.');
   }
   await auth(ctx);
   assert(query.size===0,400,'invalid_query','This private view does not accept account selectors.');
   await rateLimit('native-studio:'+ctx.user.id,120,60_000);
   if(path==='/studio/shops'){
    if(method==='GET')return {shops:(await all("SELECT s.*,u.eco_id owner_eco_id FROM m01_shops s JOIN m01_shop_members m ON m.shop_id=s.id JOIN users u ON u.id=s.owner_id WHERE m.user_id=? AND m.status='active' AND s.status!='suspended' ORDER BY s.created_at LIMIT 25",ctx.user.id)).map(dtoShop)};
    if(method==='POST'){
     exact(body,['requestId','name','slug']);uuid(body.requestId);const name=text(body.name,2,80,'your shop name'),canonical=slug(body.slug);
     assert(await q("SELECT 1 ok FROM roles WHERE user_id=? AND role='seller'",ctx.user.id),403,'seller_required','Activate your existing seller role first.');
     const old=await q('SELECT s.*,u.eco_id owner_eco_id FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE s.owner_id=? AND s.request_id=?',ctx.user.id,body.requestId);
     if(old){assert(old.name===name&&old.slug===canonical,409,'shop_retry_changed','Use the original shop details for this retry.');return {shop:dtoShop(old)};}
     assert(!(await q('SELECT 1 ok FROM m01_shop_aliases WHERE slug=?',canonical)),409,'slug_taken','This shop link is already reserved.');
     const shopId=id();await run('INSERT INTO m01_shops(id,owner_id,request_id,name,slug,created_at) VALUES(?,?,?,?,?,?)',shopId,ctx.user.id,body.requestId,name,canonical,now());
     await run("INSERT INTO m01_shop_members(shop_id,user_id,role) VALUES(?,?,'owner')",shopId,ctx.user.id);
     await run('INSERT INTO m01_shop_aliases(slug,shop_id,created_at) VALUES(?,?,?)',canonical,shopId,now());
     await event(ctx.user.id,'shop',shopId,'SHOP_CREATED',{});
     return {shop:dtoShop(await q('SELECT s.*,u.eco_id owner_eco_id FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE s.id=?',shopId))};
    }
   }
   if(path==='/studio/reviews'&&method==='GET'){
    await staff(ctx);
    const shops=(await all("SELECT s.*,u.eco_id owner_eco_id FROM m01_shops s JOIN users u ON u.id=s.owner_id WHERE s.status='draft' ORDER BY s.created_at LIMIT 25")).map(dtoShop);
    const pending=await all("SELECT product_id FROM m01_product_publication WHERE moderation='pending' ORDER BY updated_at LIMIT 50");
    const products=await Promise.all(pending.map(p=>privateProduct(p.product_id)));
    await event(ctx.user.id,'marketplace_review',ctx.user.id,'MARKETPLACE_REVIEW_QUEUE_READ',{});
    return {shops,products};
   }
   const reviewPhoto=path.match(/^\/studio\/reviews\/photos\/([a-f0-9-]{36})$/i);
   if(reviewPhoto&&method==='GET'){
    await staff(ctx);
    const asset=await q('SELECT a.* FROM media_assets a JOIN m01_photos p ON p.asset_id=a.id WHERE a.id=?',reviewPhoto[1]);
    if(!asset)stop('asset_not_found','This review photo is unavailable.');
    return {__media:await loadMediaAsset(asset.id),mimeType:asset.mime_type};
   }
   const review=path.match(/^\/studio\/reviews\/(shops|products)\/([a-f0-9-]{36})$/i);
   if(review&&method==='POST'){
    const actor=await staff(ctx);assert(['approved','rejected'].includes(body.decision),400,'invalid_review','Choose approve or reject.');
    if(review[1]==='shops'){
     exact(body,['decision']);const shop=await q('SELECT * FROM m01_shops WHERE id=?',review[2]);if(!shop)stop();
     assert(shop.owner_id!==actor,403,'independent_review_required','Another authorized reviewer must approve this shop.');
     await run('UPDATE m01_shops SET status=?,visibility=?,approved_by=? WHERE id=?',body.decision==='approved'?'active':'suspended',body.decision==='approved'?'public':'private',actor,shop.id);
    }else{
     exact(body,['revision','decision']);const record=await q('SELECT p.*,v.* FROM products p JOIN m01_product_publication v ON v.product_id=p.id WHERE p.id=?',review[2]);if(!record)stop();
     assert(record.seller_id!==actor&&record.created_by!==actor,403,'independent_review_required','Another authorized reviewer must review this product.');
     assert(Number(record.revision)===body.revision,409,'product_changed','This product changed. Review its latest revision.');
     assert(body.decision!=='approved'||(await validation(record)).valid,400,'product_invalid','Complete product validation before approval.');
     await run('UPDATE m01_product_publication SET moderation=?,approved_revision=?,approved_by=? WHERE product_id=?',body.decision,body.decision==='approved'?body.revision:null,actor,record.id);
    }
    await event(actor,'marketplace_review',review[2],'MARKETPLACE_REVIEWED',{decision:body.decision});return {reviewed:true};
   }
   const shopMatch=path.match(/^\/studio\/shops\/([a-f0-9-]{36})(.*)$/i);
   if(shopMatch){
    const suffix=shopMatch[2],shop=await shopAccess(ctx,shopMatch[1],suffix.startsWith('/theme')?(suffix==='/theme/apply'?'apply':method==='GET'?'read':'theme'):suffix==='/slug'?'slug':method==='GET'?'read':'product');
    if(!suffix&&method==='GET')return {shop:dtoShop(shop)};
    if(suffix==='/slug'&&method==='PATCH'){
     exact(body,['slug']);const name=slug(body.slug),old=await q('SELECT shop_id FROM m01_shop_aliases WHERE slug=?',name);
     assert(!old||old.shop_id===shop.id,409,'slug_taken','This link belongs to another shop.');
     await run('INSERT INTO m01_shop_aliases(slug,shop_id,created_at) VALUES(?,?,?) ON CONFLICT(slug) DO NOTHING',name,shop.id,now());
     await run('UPDATE m01_shops SET slug=? WHERE id=?',name,shop.id);return {shop:{...dtoShop(shop),slug:name,path:'/shops/'+name}};
    }
    if(suffix==='/products'&&method==='GET')return {products:await Promise.all((await all('SELECT product_id FROM m01_product_publication WHERE shop_id=? ORDER BY updated_at DESC LIMIT 100',shop.id)).map(p=>privateProduct(p.product_id)))};
    if(suffix==='/products'&&method==='POST'){
     exact(body,['requestId',...fields]);uuid(body.requestId);const values=input(body);
     const old=await q('SELECT product_id FROM m01_product_publication WHERE shop_id=? AND request_id=?',shop.id,body.requestId);
     if(old)return {product:await privateProduct(old.product_id)};
     const productId=id();
     await run("INSERT INTO products(id,seller_id,name,description,category,currency,price_minor,stock,variants_json,fulfillment_type,status,image_url,created_at,updated_at) VALUES(?,?,?,?,?,'GHS',?,?,?,'own_inventory','paused',?,?,?)",productId,shop.owner_id,values.title,values.description,values.categoryId,values.priceMinor,values.stock,JSON.stringify(values.variants),values.gallery[0]?'/social/assets/'+values.gallery[0].assetId:null,now(),now());
     await run('INSERT INTO m01_product_publication(product_id,shop_id,availability,collection_name,created_by,request_id,updated_at) VALUES(?,?,?,?,?,?,?)',productId,shop.id,values.availability,values.collection,ctx.user.id,body.requestId,now());
     await saveMedia(productId,shop.id,values.gallery);return {product:await privateProduct(productId)};
    }
    if(suffix==='/photos'&&method==='POST'){
     exact(body,['mimeType','data','rightsConfirmed']);assert(body.rightsConfirmed===true,400,'photo_rights_required','Confirm that you may use this photo.');
     await rateLimit('native-photo:'+ctx.user.id,12,60_000);
     const photo=await normalizePhoto(body);
     const assetId=id();await storeMediaAsset(assetId,photo.bytes,photo.mimeType);
     try{
      await run('INSERT INTO media_assets(id,owner_id,mime_type,byte_size,created_at) VALUES(?,?,?,?,?)',assetId,ctx.user.id,photo.mimeType,photo.bytes.length,now());
      await run('INSERT INTO m01_photos(asset_id,shop_id,rights_actor_id,width,height,created_at) VALUES(?,?,?,?,?,?)',assetId,shop.id,ctx.user.id,photo.width,photo.height,now());
     }catch(error){await removeMediaAsset(assetId);throw error;}
     return {photo:{id:assetId,mimeType:photo.mimeType,width:photo.width,height:photo.height,url:'/api/v1/studio/shops/'+shop.id+'/photos/'+assetId}};
    }
    const photo=suffix.match(/^\/photos\/([a-f0-9-]{36})$/i);
    if(photo&&method==='GET'){
     const asset=await q('SELECT a.* FROM media_assets a JOIN m01_photos p ON p.asset_id=a.id WHERE a.id=? AND p.shop_id=?',photo[1],shop.id);
     if(!asset)stop('asset_not_found','This photo is unavailable.');return {__media:await loadMediaAsset(asset.id),mimeType:asset.mime_type};
    }
    if(suffix==='/theme'&&method==='GET')return themeState(shop);
    if(suffix==='/theme'&&method==='POST'){exact(body,['expectedVersion','config']);return saveTheme(ctx,shop,body);}
    if(suffix==='/theme/restore'&&method==='POST'){
     exact(body,['expectedVersion','restoreVersion']);integer(body.restoreVersion,1);
     const old=await q('SELECT config_json FROM m01_theme_versions WHERE shop_id=? AND version=?',shop.id,body.restoreVersion);if(!old)stop('theme_unavailable','This theme version is unavailable.');
     return saveTheme(ctx,shop,{expectedVersion:body.expectedVersion,config:JSON.parse(old.config_json)});
    }
    if(suffix==='/theme/apply'&&method==='POST'){
     exact(body,['version','confirm']);assert(body.confirm===true,400,'approval_required','Review and approve this appearance first.');
     const state=await themeState(shop);assert(body.version===state.version&&state.version>0,409,'theme_changed','Review the latest saved theme before applying it.');
     await run('UPDATE m01_theme_current SET applied_version=? WHERE shop_id=?',body.version,shop.id);
     await event(ctx.user.id,'shop',shop.id,'SHOP_THEME_APPLIED',{version:body.version});return themeState(shop);
    }
   }
   const product=path.match(/^\/studio\/products\/([a-f0-9-]{36})(.*)$/i);
   if(product){
    const {row,shop}=await loadProduct(ctx,product[1]),suffix=product[2];
    if(!suffix&&method==='GET')return {product:await privateProduct(row.id)};
    if(!suffix&&method==='PATCH'){
     exact(body,['revision',...fields]);assert(body.revision===Number(row.revision),409,'product_changed','A newer product revision exists. Reload before editing.');
     const v=input(body);await saveMedia(row.id,shop.id,v.gallery);
     await run("UPDATE products SET name=?,description=?,category=?,price_minor=?,stock=?,variants_json=?,image_url=?,status='paused',updated_at=? WHERE id=?",v.title,v.description,v.categoryId,v.priceMinor,v.stock,JSON.stringify(v.variants),v.gallery[0]?'/social/assets/'+v.gallery[0].assetId:null,now(),row.id);
     await run("UPDATE m01_product_publication SET revision=revision+1,publication='draft',moderation='pending',approved_revision=NULL,approved_by=NULL,availability=?,collection_name=?,updated_at=? WHERE product_id=?",v.availability,v.collection,now(),row.id);
     await event(ctx.user.id,'product',row.id,'PRODUCT_DRAFT_SAVED',{revision:Number(row.revision)+1});return {product:await privateProduct(row.id)};
    }
    if(method==='POST'&&['/validate','/publish','/unpublish'].includes(suffix)){
     exact(body,suffix==='/publish'?['revision','confirmPublication','confirmSupply']:['revision']);
     assert(body.revision===Number(row.revision),409,'product_changed','Review the latest product revision.');
     const result=await validation(row);if(suffix==='/validate')return result;
     if(suffix==='/publish'){
      assert(body.confirmPublication===true&&body.confirmSupply===true,400,'publication_confirmation','Confirm publication and current supply before publishing.');
      assert(result.valid&&row.moderation==='approved'&&Number(row.approved_revision)===body.revision&&shop.status==='active'&&shop.visibility==='public',409,'publication_not_approved','This exact product revision and shop need approval before publication.');
      await run("UPDATE products SET status='active',updated_at=? WHERE id=?",now(),row.id);
      await run("UPDATE m01_product_publication SET publication='published',published_at=?,updated_at=? WHERE product_id=?",now(),now(),row.id);
     }else{
      await run("UPDATE products SET status='paused',updated_at=? WHERE id=?",now(),row.id);
      await run("UPDATE m01_product_publication SET publication='draft',updated_at=? WHERE product_id=?",now(),row.id);
     }
     await event(ctx.user.id,'product',row.id,suffix==='/publish'?'PRODUCT_PUBLISHED':'PRODUCT_UNPUBLISHED',{revision:body.revision,shopId:shop.id});
     return {product:await privateProduct(row.id),publicVisibilityVerified:suffix==='/publish'&&(await publicCatalog({listingId:row.id})).length===1};
    }
   }
   if(path==='/connect/enquiries'){
    if(method==='GET'){
     const rows=await all("SELECT DISTINCT e.* FROM connect_product_enquiries e LEFT JOIN m01_shop_members m ON m.shop_id=e.shop_id WHERE e.buyer_id=? OR (m.user_id=? AND m.status='active' AND m.role IN ('owner','administrator','enquiry_operator')) ORDER BY e.created_at DESC LIMIT 50",ctx.user.id,ctx.user.id);
     const enquiries=[];for(const e of rows){try{await enquiryScope(ctx,e.id);enquiries.push({id:e.id,productId:e.product_id,shopId:e.shop_id,state:e.state});}catch(error){if(error.status!==404)throw error;}}
     return {enquiries};
    }
    if(method==='POST'){
     exact(body,['listingId','clientId','body']);uuid(body.listingId);
     const listing=(await publicCatalog({listingId:body.listingId}))[0];if(!listing)stop('product_unavailable','This product is unavailable.');
     const shop=await q('SELECT * FROM m01_shops WHERE id=?',listing.shopId);
     assert(shop.owner_id!==ctx.user.id,400,'own_enquiry','Open Buyer Enquiries to respond to customers.');
     let e=await q('SELECT * FROM connect_product_enquiries WHERE buyer_id=? AND product_id=?',ctx.user.id,body.listingId);
     if(!e){const eid=id();await run('INSERT INTO connect_product_enquiries(id,shop_id,product_id,buyer_id,created_at) VALUES(?,?,?,?,?)',eid,shop.id,body.listingId,ctx.user.id,now());e={id:eid};}
     await sendMessage(ctx,e.id,{clientId:body.clientId,body:body.body});return {enquiry:{id:e.id,productId:body.listingId}};
    }
   }
   const enquiry=path.match(/^\/connect\/enquiries\/([a-f0-9-]{36})(\/messages)?$/i);
   if(enquiry){
    if(method==='GET'&&!enquiry[2]){
     const {e}=await enquiryScope(ctx,enquiry[1]);
     const rows=await all('SELECT * FROM connect_enquiry_messages WHERE enquiry_id=? ORDER BY sequence DESC LIMIT 50',e.id);
     return {enquiry:{id:e.id,productId:e.product_id,state:e.state},messages:rows.reverse().map(m=>({id:m.id,senderId:m.sender_id,body:m.body,createdAt:m.created_at}))};
    }
    if(method==='POST'&&enquiry[2]){await rateLimit('product-enquiry-send:'+ctx.user.id,20,60_000);return {message:await sendMessage(ctx,enquiry[1],body)};}
   }
   return stop('not_found','This Studio page is unavailable.');
 }
 // SQLite uses one connection: serialize this module's asynchronous transactions.
 let queue=Promise.resolve();
 async function route(ctx,method,path,body,query){
   const work=()=>transaction(()=>coreRoute(ctx,method,path,body,query));
   if(postgresMode)return work();
   const next=queue.then(work,work);queue=next.catch(()=>undefined);return next;
 }
 return {route,publicCatalog};
}
