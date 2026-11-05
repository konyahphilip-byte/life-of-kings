import {useEffect,useRef,useState,type FormEvent} from 'react';
import ProductClassification from './ProductClassification';
import {normalizeClassification,TAXONOMY_VERSION} from '../../../shared/marketplace-taxonomy.mjs';
import './shopify-review.css';
export type ImportedProduct={id:string;name:string;description?:string;reviewHash:string;status:string;variants:{id:string;title:string;priceMinor:number|null;stock:number|null}[]};
type Request=(path:string,init:RequestInit)=>Promise<{response:Response;value:Record<string,any>}>;
export default function ShopifyReview({product,ownerId,request,onDone,onClose}:{product:ImportedProduct;ownerId:string;request:Request;onDone:(message:string)=>void;onClose:()=>void}){
 const [categoryId,setCategory]=useState(''),[attributes,setAttributes]=useState<Record<string,string|number>>({}),[stock,setStock]=useState<Record<string,number>>({}),[fulfillment,setFulfillment]=useState('own_inventory'),[location,setLocation]=useState(''),[shipping,setShipping]=useState(''),[supply,setSupply]=useState(false),[photo,setPhoto]=useState(false),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState<string|null>(null);
 const alive=useRef(true),inFlight=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function publish(e:FormEvent){
  e.preventDefault();if(inFlight.current)return;
  let body=pending;
  try{
   if(!body){
    const classification=normalizeClassification({categoryId,categoryVersion:TAXONOMY_VERSION,attributes},(ok,_s,_c,message)=>{if(!ok)throw Error(message);},'physical');
    if(!supply||!location.trim()||!shipping.trim())throw Error('Confirm supply, your area and pickup/delivery terms.');
    if(photo&&!consent)throw Error('Choose whether EcoVibes may store and publicly show this product photo.');
    const variants=product.variants.map(v=>({id:v.id,stock:stock[v.id]??0}));
    if(!variants.some(v=>v.stock>0))throw Error('Allocate at least one available item to EcoVibes.');
    body=JSON.stringify({ownerId,clientId:crypto.randomUUID(),reviewHash:product.reviewHash,categoryId:classification.categoryId,categoryVersion:classification.categoryVersion,attributes:classification.attributes,variantStock:variants,fulfillmentType:fulfillment,location:location.trim(),shippingInfo:shipping.trim(),confirmedSupply:true,copyPhoto:photo,mediaConsent:photo&&consent});setPending(body);
   }
   inFlight.current=true;setBusy(true);setError('');
   const {response,value}=await request('/marketplace/products/'+product.id+'/publish',{method:'POST',body});if(!alive.current)return;
   if(!response.ok){
    if(response.status>=400&&response.status<500&&![408,429].includes(response.status))setPending(null);
    throw Error(value.error?.message||'Publication was not confirmed. Retry the same saved request.');
   }
   if(value.ownerId!==ownerId||value.productId!==product.id||typeof value.publishedAt!=='string'||value.publicationId!==JSON.parse(body).clientId)throw Error('The saved publication could not be confirmed. Retry the same request.');
   onDone(value.currentStatus==='active'?'Listing published to EcoVibes. No payment has been taken.':'This publication was saved earlier. The listing is now '+String(value.currentStatus)+'. Refresh your account listings.');
  }catch(err){if(alive.current)setError(err instanceof Error?err.message:'Publication could not be confirmed. Retry the same request.');}
  finally{inFlight.current=false;if(alive.current)setBusy(false);}
 }
 return <section className="shopify-review" aria-label="Review Shopify product">
  <h3>Review and publish {product.name}</h3><p>{product.description}</p>
  <p>This is a paused source snapshot. Confirm actual supply and allocate quantities for EcoVibes. Publishing does not reserve stock in Shopify or update your supplier. Manage availability across your sales channels.</p>
  <form onSubmit={publish}><fieldset disabled={busy||Boolean(pending)}>
   <legend>Product and fulfillment</legend><ProductClassification productType="physical" categoryId={categoryId} attributes={attributes} onChange={(id,a)=>{setCategory(id);setAttributes(a);}}/>
   <div className="shopify-variants">{product.variants.map(v=><label key={v.id}>{v.title} · {v.priceMinor===null?'Price unknown':'GH₵'+(v.priceMinor/100).toFixed(2)}<small>Source snapshot: {v.stock===null?'quantity unknown':v.stock+' available'}</small><span>Allocate to EcoVibes</span><input aria-label={'EcoVibes quantity '+v.title} type="number" min="0" max={v.stock??0} step="1" value={stock[v.id]??0} onChange={e=>setStock({...stock,[v.id]:Number(e.target.value)})}/></label>)}</div>
   <label>Fulfillment<select value={fulfillment} onChange={e=>setFulfillment(e.target.value)}><option value="own_inventory">Own inventory</option><option value="supplier_fulfilled">Supplier fulfilled</option><option value="dropship">Dropship</option></select></label>
   <label>Pickup or dispatch area<input required maxLength={120} value={location} onChange={e=>setLocation(e.target.value)}/></label>
   <label>Pickup/delivery terms and costs<input required maxLength={200} value={shipping} onChange={e=>setShipping(e.target.value)}/></label>
   <label className="shopify-choice"><input type="checkbox" checked={supply} onChange={e=>setSupply(e.target.checked)}/>I have confirmed supply and can fulfill the quantities allocated here.</label>
   <label className="shopify-choice"><input type="checkbox" checked={photo} onChange={e=>{setPhoto(e.target.checked);setConsent(false);}}/>Include the source product photo</label>
   {photo&&<label className="shopify-choice"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I have rights to this photo and agree to EcoVibes storing a copy and showing it publicly with this listing. It is not sent to Chale AI.</label>}
  </fieldset>
  {pending&&<p>Keep this review open to retry the identical request if the connection fails. Check My listings before starting a new review.</p>}
  {error&&<p role="alert">{error}</p>}<div className="shopify-review-actions"><button type="button" onClick={onClose} disabled={busy}>Close review</button><button type="submit" disabled={busy}>{busy?'Confirming publication…':pending?'Retry saved publication':'Publish reviewed listing'}</button></div>
  </form>
 </section>;
}
