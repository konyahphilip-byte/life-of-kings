import {useEffect,useRef,useState,type FormEvent} from 'react';
import {apiUrl} from '../../lib/api';
import './server-cart.css';
type Item={productId:string;variantId:string|null;quantity:number;name:string;variantTitle:string|null;unitPriceMinor:number|null;available:boolean;reason:string|null};
type Cart={ownerId:string;revision:number;items:Item[];totalMinor:number|null;currency:string;quoteId:string|null;canCheckout:boolean;lastOrderId:string|null};
type Product={id:string;name:string;priceMinor:number;stock:number;sellerIsCurrentUser?:boolean;fulfillment_type:string;variants:Array<{id:string;title:string}>};
type Selection={productId:string;variantId?:string;ownerId:string};
type Checkout={ownerId:string;revision:number;totalMinor:number;quoteId:string;clientId:string};
type Props={ownerId:string;csrfToken:string;online:boolean;selection?:Selection|null;onOpenOrders:()=>void};
const money=(n:number)=>'GH₵'+(n/100).toFixed(2);
function validCart(value:unknown,owner:string):value is Cart{
 const c=value as Cart;
 return Boolean(c&&c.ownerId===owner&&Number.isSafeInteger(c.revision)&&c.revision>=0&&c.currency==='GHS'&&typeof c.canCheckout==='boolean'&&(c.quoteId===null||typeof c.quoteId==='string'&&/^[a-f0-9]{64}$/.test(c.quoteId))&&(!c.canCheckout||Boolean(c.quoteId))&&(c.totalMinor===null||Number.isSafeInteger(c.totalMinor)&&c.totalMinor>=0)&&Array.isArray(c.items)&&c.items.length<=30&&c.items.every(i=>i&&typeof i.productId==='string'&&typeof i.name==='string'&&Number.isSafeInteger(i.quantity)&&i.quantity>0&&(i.variantId===null||typeof i.variantId==='string')&&typeof i.available==='boolean'&&(i.unitPriceMinor===null||Number.isSafeInteger(i.unitPriceMinor)&&i.unitPriceMinor>0))&&(c.lastOrderId===null||typeof c.lastOrderId==='string'));
}
export default function ServerCart({ownerId,csrfToken,online,selection,onOpenOrders}:Props){
 const [cart,setCart]=useState<Cart|null>(null),[catalog,setCatalog]=useState<Product[]>([]),[productId,setProduct]=useState(selection?.ownerId===ownerId?selection.productId:''),[variantId,setVariant]=useState(selection?.variantId||''),[quantity,setQuantity]=useState('1');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false);
 const [viewOwner,setViewOwner]=useState(ownerId);
 const lifecycle=useRef<AbortController|null>(null),live=useRef(false),owner=useRef(ownerId),pending=useRef<Checkout|null>(null);
 owner.current=ownerId;
 const active=()=>live.current&&owner.current===ownerId;
 async function request(path:string,method='GET',body?:unknown){
  const controller=new AbortController(),stop=()=>controller.abort(),parent=lifecycle.current!.signal;
  parent.addEventListener('abort',stop,{once:true});const timeout=setTimeout(stop,10000);
  let r:Response,value;try{r=await fetch(apiUrl(path),{method,credentials:'include',signal:controller.signal,headers:{...(body?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrfToken}:{})},...(body?{body:JSON.stringify(body)}:{})});value=await r.json();}finally{clearTimeout(timeout);parent.removeEventListener('abort',stop);}
  if(!r.ok)throw Object.assign(new Error(value?.error?.message||'The account bag could not be checked.'),{status:r.status,code:value?.error?.code});
  if(!live.current||owner.current!==ownerId)throw Error('Your account changed. Reopen your bag.');
  return value;
 }
 async function refresh(){
  const value=await request('/marketplace/cart');if(!validCart(value,ownerId))throw Error('Your account bag could not be confirmed. Reopen it.');
  setCart(value);return value;
 }
 useEffect(()=>{
  setViewOwner(ownerId);setCart(null);setNotice('');setError('');setUncertain(false);setBusy(false);setCatalog([]);
  live.current=true;lifecycle.current=new AbortController();
  if(online)void refresh().catch(e=>{if(active())setError(e.message);});
  else setError('You’re offline. Reconnect to check your saved account bag.');
  return()=>{live.current=false;lifecycle.current?.abort();pending.current=null;};
 },[ownerId]);
 async function run(action:()=>Promise<void>){
  if(busy||!online||!csrfToken)return;setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){if(active())setError(e instanceof Error?e.message:'The operation could not be confirmed.');}
  finally{if(active())setBusy(false);}
 }
 async function browse(){
  await run(async()=>{const value=await request('/marketplace/products');if(!Array.isArray(value)||!value.every(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.variants)))throw Error('Current listings could not be confirmed.');const current=value.filter(p=>!p.sellerIsCurrentUser&&p.fulfillment_type!=='external_checkout'&&p.stock>0);setCatalog(current);if(!current.length)setNotice('No available listings from other sellers right now. Your saved bag is retained.');});
 }
 const lines=(value:Cart)=>value.items.map(i=>({productId:i.productId,variantId:i.variantId,quantity:i.quantity}));
 async function save(items:ReturnType<typeof lines>){
  if(!cart||pending.current)return;
  const value=await request('/marketplace/cart','PUT',{ownerId,revision:cart.revision,items});
  if(!validCart(value,ownerId))throw Error('The saved bag could not be confirmed. Refresh before continuing.');
  setCart(value);setNotice('Account bag saved.');
 }
 async function add(event:FormEvent){
  event.preventDefault();if(!cart)return;
  await run(async()=>{const desired=lines(cart).filter(i=>i.productId!==productId||i.variantId!==(variantId||null));desired.push({productId,variantId:variantId||null,quantity:Number(quantity)});await save(desired);});
 }
 async function checkout(){
  if(!pending.current&&(!cart||!cart.canCheckout||cart.totalMinor===null))return;
  pending.current??=Object.freeze({ownerId,revision:cart!.revision,totalMinor:cart!.totalMinor!,quoteId:cart!.quoteId!,clientId:crypto.randomUUID()});
  await run(async()=>{
   try{
    const value=await request('/marketplace/cart/checkout','POST',pending.current);
    if(value?.ownerId!==ownerId||!validCart(value.cart,ownerId)||typeof value.order?.id!=='string'||value.order.buyer_id!==ownerId||!Number.isSafeInteger(value.order.total_minor)||value.order.total_minor!==pending.current!.totalMinor||typeof value.order.status!=='string'||typeof value.order.payment_status!=='string')throw Error('Order outcome could not be confirmed. Retry this same request or check your orders.');
    pending.current=null;setUncertain(false);setCart(value.cart);setNotice('Saved order '+value.order.id+' · '+value.order.status+' · payment '+value.order.payment_status+'. No payment was taken by this action.');
   }catch(e){
    if(!active())throw e;
    const known=e as {status?:number;code?:string};
    if([400,404,409].includes(known.status||0)&&['cart_price_changed','cart_unavailable','cart_empty','cart_changed','invalid_checkout','product_unavailable','own_product','external_checkout','variant_required','variant_unavailable','stock_changed','variant_stock_changed','invalid_quantity','invalid_total','invalid_items'].includes(known.code||'')){
     pending.current=null;setUncertain(false);await refresh();
    }else setUncertain(true);
    throw e;
   }
  });
 }
 const selected=catalog.find(p=>p.id===productId);
 if(viewOwner!==ownerId)return <section className="server-cart" aria-label="Account bag"><p>Checking account bag…</p></section>;
 return <section className="server-cart" aria-label="Account bag">
  <h3>Your account bag</h3><p>Saved to this EcoVibes ID across signed-in devices. Review current listings and totals before placing an unpaid order.</p>
  {!online&&<p role="status">Offline — ordering is paused. Your server bag is retained.</p>}
  {error&&<p className="server-cart-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="server-cart-actions"><button type="button" disabled={busy||!online} onClick={()=>void run(async()=>{await refresh();})}>Refresh account bag</button><button type="button" disabled={busy||!online||uncertain} onClick={()=>void browse()}>Choose current listings</button></div>
  {catalog.length>0&&<form onSubmit={add}><label>Current listing<select value={productId} onChange={e=>{setProduct(e.target.value);setVariant('');}} required disabled={busy||uncertain}><option value="">Choose an item</option>{catalog.map(p=><option key={p.id} value={p.id}>{p.name} · {money(p.priceMinor)}</option>)}</select></label>
   {Boolean(selected?.variants.length)&&<label>Item option<select value={variantId} onChange={e=>setVariant(e.target.value)} required disabled={busy||uncertain}><option value="">Choose an option</option>{selected!.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
   <label>Quantity<input type="number" min="1" max="1000000" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy||uncertain} required/></label>
   <button type="submit" disabled={busy||!online||uncertain||!productId}>Save item to account bag</button></form>}
  {cart&&<>{cart.items.length===0?<p>No items in your account bag yet.</p>:<ul>{cart.items.map(i=><li key={i.productId+':'+i.variantId}><strong>{i.name}{i.variantTitle?' · '+i.variantTitle:''}</strong><span>Quantity {i.quantity}{i.unitPriceMinor!==null?' · '+money(i.unitPriceMinor*i.quantity):''}</span>{!i.available&&<p>{i.reason}</p>}<button type="button" disabled={busy||!online||uncertain} onClick={()=>void run(()=>save(lines(cart).filter(line=>line.productId!==i.productId||line.variantId!==i.variantId)))}>Remove {i.name}</button></li>)}</ul>}
   <p><strong>Reviewed items total: {cart.totalMinor===null?'Needs review':money(cart.totalMinor)}</strong></p>
   <p>Delivery and third-party charges are not included. This creates an unpaid order only; payment is a separate step. EcoVibes platform fee: GH₵0.</p>
   <button type="button" disabled={busy||!online||!csrfToken||(!pending.current&&!cart.canCheckout)} onClick={()=>void checkout()}>{uncertain?'Retry same order request':'Place unpaid order'}</button>
   {uncertain&&<p role="status">The outcome is unconfirmed. This retry uses the same request to avoid a second order. Check your saved orders before starting another purchase.</p>}
   {cart.lastOrderId&&<p>Most recent account-bag order: {cart.lastOrderId}</p>}
  </>}
  <button type="button" onClick={onOpenOrders}>Open account orders</button>
 </section>;
}
