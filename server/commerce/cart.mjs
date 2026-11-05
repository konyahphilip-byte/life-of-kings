import {createHash} from 'node:crypto';
import {normalizeOrderItems} from './order-input.mjs';
import {orderQuote} from './orders.mjs';

export const CART_VERSION='20261105084536_commerce_account_cart';
export const CART_SQLITE_SCHEMA=`
CREATE TABLE IF NOT EXISTS commerce_carts(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commerce_cart_items(user_id TEXT NOT NULL REFERENCES commerce_carts(user_id),product_id TEXT NOT NULL REFERENCES products(id),variant_key TEXT NOT NULL DEFAULT '',quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),PRIMARY KEY(user_id,product_id,variant_key));
CREATE TABLE IF NOT EXISTS commerce_order_commands(user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,cart_revision INTEGER NOT NULL,request_hash TEXT NOT NULL,order_id TEXT NOT NULL REFERENCES orders(id),created_at TEXT NOT NULL,PRIMARY KEY(user_id,client_id),UNIQUE(user_id,cart_revision));
CREATE INDEX IF NOT EXISTS commerce_commands_recent ON commerce_order_commands(user_id,created_at DESC);`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function cartItems(value,assert){
 assert(Array.isArray(value)&&value.length<=30,400,'invalid_items','Choose up to 30 cart lines.');
 if(!value.length)return [];
 for(const line of value)assert(record(line)&&Object.keys(line).every(k=>['productId','variantId','quantity'].includes(k)),400,'invalid_items','Cart lines contain only an item, option and quantity.');
 const grouped=normalizeOrderItems({items:value}),items=[];
 for(const[productId,lines]of grouped)for(const line of lines.sort((a,b)=>(a.variantId||'').localeCompare(b.variantId||''))){
  assert(line.qty<=1000000,400,'invalid_quantity','Choose at most 1,000,000 of an item.');
  items.push({productId,variantId:line.variantId,quantity:line.qty});
 }
 return items;
}

export function createCartService({q,all,run,transaction,assert,now,rateLimit,productVariants,writeOrder,getOrder,visibleOrder,postgresMode,available=true,enabled=()=>true}){
 const lock=postgresMode?' FOR UPDATE':'';
 async function actor(id){
  assert(await q("SELECT id FROM users WHERE id=? AND status='active'"+(postgresMode?' FOR SHARE':''),id),403,'account_unavailable','This account is unavailable.');
 }
 async function authorize(ctx){
  await actor(ctx.user.id);
  assert(typeof ctx.sessionHash==='string',401,'session_expired','Sign in again before using your account bag.');
  const session=postgresMode
   ? await q('SELECT public.ecovibes_cart_session_authorized(?,?,?) AS allowed',ctx.sessionHash,ctx.user.id,ctx.csrfToken)
   : await q("SELECT 1 AS allowed FROM sessions WHERE token_hash=? AND user_id=? AND csrf_token=? AND expires_at>?",ctx.sessionHash,ctx.user.id,ctx.csrfToken,now());
  assert(session?.allowed,401,'session_expired','Sign in again before using your account bag.');
 }
 async function lockedCart(id){
  await run('INSERT INTO commerce_carts(user_id,revision,updated_at) VALUES(?,0,?) ON CONFLICT(user_id) DO NOTHING',id,now());
  return q('SELECT * FROM commerce_carts WHERE user_id=?'+lock,id);
 }
 const saved=async id=>(await all('SELECT product_id,variant_key,quantity FROM commerce_cart_items WHERE user_id=? ORDER BY product_id,variant_key',id)).map(r=>({productId:r.product_id,variantId:r.variant_key||null,quantity:Number(r.quantity)}));
 async function view(id){
  const cart=await q('SELECT * FROM commerce_carts WHERE user_id=?',id),items=await saved(id),display=[];
  const totals=new Map();for(const item of items)totals.set(item.productId,(totals.get(item.productId)||0)+item.quantity);
  let total=0,valid=true;
  for(const item of items){
   const product=await q("SELECT p.*,u.eco_id seller_eco_id FROM products p JOIN users u ON u.id=p.seller_id WHERE p.id=? AND p.status='active' AND u.status='active'",item.productId);
   const variants=product?productVariants(product):[],variant=item.variantId?variants.find(v=>v.id===item.variantId):null;
   const price=Number(variant?.priceMinor||product?.price_minor||0),lineTotal=price*item.quantity;
   const usable=Boolean(product&&product.seller_id!==id&&product.fulfillment_type!=='external_checkout'&&product.currency==='GHS'&&product.stock>=totals.get(item.productId)&&(variants.length?variant&& (variant.stock===null||variant.stock>=item.quantity):!item.variantId)&&Number.isSafeInteger(lineTotal)&&lineTotal>0);
   total+=lineTotal;valid&&=usable;
   display.push({...item,name:product?.name||'Unavailable item',variantTitle:variant?.title||null,sellerEcoId:product?.seller_eco_id||null,unitPriceMinor:usable?price:null,available:usable,reason:usable?null:'This item, option or quantity is unavailable. Remove it or choose another listing.'});
  }
  valid&&=Number.isSafeInteger(total)&&total>0&&total<=2147483647;
  const last=await q('SELECT order_id FROM commerce_order_commands WHERE user_id=? ORDER BY created_at DESC,client_id DESC LIMIT 1',id);
  return {ownerId:id,revision:Number(cart?.revision||0),items:display,totalMinor:valid?total:items.length?null:0,currency:'GHS',quoteId:valid?orderQuote(display):null,canCheckout:valid&&items.length>0,lastOrderId:last?.order_id||null};
 }
 function mutation(ctx,body,fields){
  assert(record(body)&&Object.keys(body).length===fields.length&&Object.keys(body).every(k=>fields.includes(k)),400,'invalid_cart','Refresh your account bag and try again.');
  assert(body.ownerId===ctx.user.id,409,'account_changed','Your account changed. Reopen your own bag.');
  assert(Number.isSafeInteger(body.revision)&&body.revision>=0,400,'invalid_cart','Cart revision is invalid.');
 }
 async function route(ctx,method,path,body,query){
  assert(ctx.user,401,'sign_in_required','Sign in to use your account bag.');
  assert(available&&enabled(),503,'cart_unavailable','Account ordering is unavailable. Your saved bag is retained.');
  assert([...query.keys()].length===0,400,'invalid_query','This bag accepts no account selectors.');
  const id=ctx.user.id;
  if(path==='/marketplace/cart'&&method==='GET'){
   await rateLimit('cart-read:'+id,120,60000);
   return transaction(async()=>{await authorize(ctx);await lockedCart(id);return view(id);});
  }
  if(path==='/marketplace/cart'&&method==='PUT'){
   mutation(ctx,body,['ownerId','revision','items']);const desired=cartItems(body.items,assert);
   await rateLimit('cart-write:'+id,40,60000);
   return transaction(async()=>{
    await authorize(ctx);const cart=await lockedCart(id),current=cartItems(await saved(id),assert);
    if(JSON.stringify(current)===JSON.stringify(desired))return view(id);
    assert(Number(cart.revision)===body.revision,409,'cart_changed','Your bag changed on another screen. Refresh it before editing.');
    assert(Number.isSafeInteger(Number(cart.revision)+1),409,'cart_changed','This bag needs support review.');
    const prior=new Map(current.map(i=>[JSON.stringify([i.productId,i.variantId]),i.quantity]));
    const additions=desired.filter(i=>i.quantity>(prior.get(JSON.stringify([i.productId,i.variantId]))||0));
    for(const item of additions)assert(await q("SELECT p.id FROM products p JOIN users u ON u.id=p.seller_id WHERE p.id=? AND p.status='active' AND u.status='active' AND p.seller_id<>? AND p.fulfillment_type<>'external_checkout'",item.productId,id),404,'product_unavailable','Choose a current listing from another seller.');
    await run('DELETE FROM commerce_cart_items WHERE user_id=?',id);
    for(const item of desired)await run('INSERT INTO commerce_cart_items(user_id,product_id,variant_key,quantity) VALUES(?,?,?,?)',id,item.productId,item.variantId||'',item.quantity);
    const next=await view(id);assert(next.items.filter(i=>additions.some(a=>a.productId===i.productId&&a.variantId===i.variantId)).every(i=>i.available),409,'cart_unavailable','Choose available quantities and options before saving.');
    await run('UPDATE commerce_carts SET revision=revision+1,updated_at=? WHERE user_id=?',now(),id);
    return view(id);
   });
  }
  if(path==='/marketplace/cart/checkout'&&method==='POST'){
   mutation(ctx,body,['ownerId','revision','totalMinor','quoteId','clientId']);
   assert(typeof body.clientId==='string'&&UUID.test(body.clientId)&&typeof body.quoteId==='string'&&/^[a-f0-9]{64}$/.test(body.quoteId)&&Number.isSafeInteger(body.totalMinor)&&body.totalMinor>0,400,'invalid_checkout','Review the total before placing your order.');
   const clientId=body.clientId.toLowerCase(),requestHash=digest({ownerId:id,revision:body.revision,totalMinor:body.totalMinor,quoteId:body.quoteId});
   await rateLimit('cart-checkout:'+id,30,60000);
   return transaction(async()=>{
    await authorize(ctx);const cart=await lockedCart(id);
    const previous=await q('SELECT * FROM commerce_order_commands WHERE user_id=? AND client_id=?',id,clientId);
    if(previous){
     assert(previous.request_hash===requestHash,409,'checkout_changed','This order request cannot be changed. Check your existing orders.');
     const order=await getOrder(previous.order_id);assert(order?.buyer_id===id,409,'order_unavailable','Your order requires support review.');
     return {ownerId:id,order:visibleOrder(order,ctx),cart:await view(id),replayed:true};
    }
    assert(Number(cart.revision)===body.revision,409,'cart_changed','This bag was changed or already ordered. Refresh and check your orders.');
    const items=await saved(id);assert(items.length>0,409,'cart_empty','Add an available listing before ordering.');
    const sellers=await all('SELECT DISTINCT p.seller_id FROM commerce_cart_items i JOIN products p ON p.id=i.product_id WHERE i.user_id=? ORDER BY p.seller_id',id);
    for(const seller of sellers)await actor(seller.seller_id);
    const current=await view(id);assert(current.canCheckout,409,'cart_unavailable','An item is unavailable. Refresh your bag.');
    assert(current.totalMinor===body.totalMinor&&current.quoteId===body.quoteId,409,'cart_price_changed','Item prices changed. Refresh and review the new total.');
    const order=await writeOrder(ctx,normalizeOrderItems({items}),body.totalMinor,body.quoteId);
    assert(order?.buyer_id===id,409,'order_unavailable','The saved order could not be confirmed.');
    await run('INSERT INTO commerce_order_commands(user_id,client_id,cart_revision,request_hash,order_id,created_at) VALUES(?,?,?,?,?,?)',id,clientId,body.revision,requestHash,order.id,now());
    await run('DELETE FROM commerce_cart_items WHERE user_id=?',id);
    await run('UPDATE commerce_carts SET revision=revision+1,updated_at=? WHERE user_id=?',now(),id);
    return {ownerId:id,order,cart:await view(id),replayed:false};
   });
  }
  assert(false,404,'not_found','Cart action not found.');
 }
 return {route};
}
