import {useEffect,useRef,useState,type FormEvent} from 'react';
import {apiUrl} from '../../lib/api';
import './public-catalog.css';
import {CATEGORIES} from '../../../shared/marketplace-taxonomy.mjs';
import {ProductDetails} from './ProductClassification';

type Variant={id:string;title:string;priceMinor:number|null;stock:number|null};
type Listing={categoryId?:string|null;categoryVersion?:number|null;attributes?:Record<string,string|number>;productType?:string;id:string;name:string;description:string;category:string;currency:string;priceMinor:number;stock:number;variants:Variant[];sellerEcoId:string;sellerName?:string;sellerIsCurrentUser:boolean;fulfillment_type:string;source_type:string;image_url:string|null;location:string};
type Page={items:Listing[];nextCursor:string|null;checkedAt:string;currency:string};
type Filters={q:string;categoryId:string;category:string;seller:string;source:string;min:string;max:string;inStock:boolean;sort:string};
type Props={account?:{id:string;ecoId:string}|null;online:boolean;saver:'standard'|'saver'|'extreme';onOpenWorkspace:()=>void;onStartSelling:()=>void};
const empty:Filters={q:'',categoryId:'',category:'',seller:'',source:'',min:'',max:'',inStock:false,sort:'newest'};
const money=(n:number)=>'GH₵'+(n/100).toFixed(2);
const sourceName=(source:string)=>(({direct:'Native EcoVibes listing',csv:'Seller-imported catalog',shopify:'Shopify-imported listing'} as Record<string,string>)[source]||'Seller listing');
function validPage(value:unknown):value is Page{
 const p=value as Page;
 return Boolean(p&&p.currency==='GHS'&&typeof p.checkedAt==='string'&&Number.isFinite(Date.parse(p.checkedAt))&&(p.nextCursor===null||typeof p.nextCursor==='string'&&p.nextCursor.length<=600)&&Array.isArray(p.items)&&p.items.length<=24&&p.items.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.description==='string'&&typeof i.category==='string'&&i.currency==='GHS'&&Number.isSafeInteger(i.priceMinor)&&i.priceMinor>0&&Number.isSafeInteger(i.stock)&&i.stock>=0&&typeof i.sellerEcoId==='string'&&typeof i.sellerIsCurrentUser==='boolean'&&typeof i.source_type==='string'&&typeof i.fulfillment_type==='string'&&Array.isArray(i.variants)&&i.variants.every(v=>typeof v.id==='string'&&typeof v.title==='string'&&(v.priceMinor===null||Number.isSafeInteger(v.priceMinor)&&v.priceMinor>0)&&(v.stock===null||Number.isSafeInteger(v.stock)&&v.stock>=0))));
}
function Photo({item,saver}:{item:Listing;saver:Props['saver']}){
 const [requested,setRequested]=useState(false),[failed,setFailed]=useState(false);
 const path=typeof item.image_url==='string'&&/^\/social\/assets\/[a-f0-9-]{36}$/.test(item.image_url)?item.image_url:null;
 if(!path||failed)return <div className="native-photo-placeholder">{failed?'Photo unavailable':'No EcoVibes photo'}</div>;
 if(saver!=='standard'&&!requested)return <button className="native-photo-load" onClick={()=>setRequested(true)}>Load photo of {item.name}</button>;
 return <img className="native-photo" loading="lazy" decoding="async" src={apiUrl(path)} alt={item.name} onError={()=>setFailed(true)}/>;
}
export default function PublicCatalog({account,online,saver,onOpenWorkspace,onStartSelling}:Props){
 const [filters,setFilters]=useState<Filters>(empty),[applied,setApplied]=useState<Filters>(empty),[items,setItems]=useState<Listing[]>([]),[next,setNext]=useState<string|null>(null),[checked,setChecked]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[options,setOptions]=useState<Record<string,string>>({});
 const [viewOwner,setViewOwner]=useState(account?.id||'guest'),owner=account?.id||'guest',ownerRef=useRef(owner),generation=useRef(0),pending=useRef<AbortController|null>(null);
 ownerRef.current=owner;
 async function load(f:Filters,cursor:string|null=null){
  pending.current?.abort();const controller=new AbortController(),token=++generation.current;pending.current=controller;
  const current=()=>generation.current===token&&ownerRef.current===owner&&!controller.signal.aborted;
  if(!online){setError('You’re offline. Reconnect to check current listings.');return;}
  setBusy(true);setError('');if(!cursor){setItems([]);setNext(null);setLoaded(false);setOptions({});}
  const query=new URLSearchParams({limit:'12',sort:f.sort,inStock:f.inStock?'1':'0'});
  for(const key of ['q','categoryId','category','seller','source'] as const)if(f[key].trim())query.set(key,f[key].trim());
  if(f.min!=='')query.set('minPrice',String(Math.round(Number(f.min)*100)));
  if(f.max!=='')query.set('maxPrice',String(Math.round(Number(f.max)*100)));
  if(cursor)query.set('cursor',cursor);
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(apiUrl('/marketplace/catalog?'+query),{credentials:'include',signal:controller.signal});
   const value=await response.json();
   if(!response.ok)throw Error(value?.error?.message||'Current listings could not be loaded.');
   if(!validPage(value))throw Error('The catalog response could not be confirmed.');
   if(!current())return;
   setItems(previous=>cursor?[...new Map([...previous,...value.items].map(i=>[i.id,i])).values()]:value.items);setNext(value.nextCursor);setChecked(value.checkedAt);setLoaded(true);
  }catch(e){
   if(generation.current===token&&ownerRef.current===owner)setError(controller.signal.aborted?'The catalog check timed out. Try again when connected.':e instanceof Error?e.message:'Current listings could not be loaded.');
  }finally{clearTimeout(timeout);if(generation.current===token&&ownerRef.current===owner)setBusy(false);}
 }
 useEffect(()=>{
  setViewOwner(owner);setItems([]);setNext(null);setChecked('');setLoaded(false);setOptions({});setBusy(false);
  if(online)void load(applied);else setError('You’re offline. Reconnect to check current listings.');
  return()=>{generation.current++;pending.current?.abort();};
 },[owner,online]);
 function search(e:FormEvent){e.preventDefault();setApplied({...filters});void load({...filters});}
 function review(item:Listing){
  if(!account){onOpenWorkspace();return;}
  if(!online||item.sellerIsCurrentUser)return;
  window.dispatchEvent(new CustomEvent('ecovibes:open-account-bag',{detail:{ownerId:account.id,productId:item.id,...(options[item.id]?{variantId:options[item.id]}:{})}}));
 }
 if(viewOwner!==owner)return <section aria-label="Current marketplace catalog"><p>Checking current listings…</p></section>;
 return <section className="native-catalog" aria-label="Current marketplace catalog">
  <div className="native-catalog-head"><div><h2>Shop current seller listings</h2><p>Start selling directly on EcoVibes. No external store or subscription required.</p></div><button type="button" onClick={onStartSelling}>Start selling</button></div>
  <form className="native-search" onSubmit={search}><label>Search products<input value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})} maxLength={100} placeholder="Try tomatoes, books or a fridge"/></label>
   <details><summary>Category, price and seller filters</summary><div className="native-filters">
    <label>Category<select aria-label="Category" value={filters.categoryId} onChange={e=>setFilters({...filters,categoryId:e.target.value,category:''})}><option value="">All categories</option>{CATEGORIES.filter(c=>!c.parentId).map(root=><optgroup key={root.id} label={root.label}><option value={root.id}>{root.label} · all</option>{CATEGORIES.filter(c=>c.parentId===root.id).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}</select></label><label>Other seller category label (legacy)<input maxLength={80} value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value,categoryId:''})} placeholder="Exact existing label"/></label>
    <label>Seller EcoVibes ID<input maxLength={41} value={filters.seller} onChange={e=>setFilters({...filters,seller:e.target.value})} placeholder="@their_store"/></label>
    <label>Minimum base price · GHS<input type="number" min="0" max="21474836.47" step=".01" value={filters.min} onChange={e=>setFilters({...filters,min:e.target.value})}/></label>
    <label>Maximum base price · GHS<input type="number" min="0" max="21474836.47" step=".01" value={filters.max} onChange={e=>setFilters({...filters,max:e.target.value})}/></label>
    <label>Product source<select value={filters.source} onChange={e=>setFilters({...filters,source:e.target.value})}><option value="">All published sources</option><option value="direct">Native EcoVibes</option><option value="csv">Seller-imported catalog</option><option value="shopify">Shopify-imported</option></select></label>
    <label>Sort listings<select value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="newest">Newest listings</option><option value="price_low">Base price: low to high</option><option value="price_high">Base price: high to low</option></select></label>
    <label className="native-checkbox"><input type="checkbox" checked={filters.inStock} onChange={e=>setFilters({...filters,inStock:e.target.checked})}/>In-stock listings only</label>
   </div></details><button disabled={busy||!online} type="submit">Search current catalog</button><button disabled={busy||!online} type="button" onClick={()=>void load(applied)}>Refresh listings</button>
  </form>
  {!online&&<p role="status">Offline — current stock cannot be checked. Ordering is paused.</p>}
  {busy&&<p role="status">Checking seller listings…</p>}{error&&<p className="native-catalog-error" role="alert">{error} No sample stock has been substituted.</p>}
  {!busy&&loaded&&!items.length&&<div className="native-catalog-empty"><h3>No matching published listings</h3><p>Try another search or start selling your own products.</p><button onClick={onStartSelling}>Add my products</button></div>}
  {items.length>0&&<><p>Showing {items.length} listing{items.length===1?'':'s'} · checked {new Date(checked).toLocaleString('en-GH')}</p><div className="native-product-grid">{items.map(item=>{
   const variant=item.variants.find(v=>v.id===options[item.id]),available=item.stock>0&&variant?.stock!==0;
   const price=variant?.priceMinor||item.priceMinor;
   return <article className="native-product" key={item.id}><Photo key={item.id+':'+saver} item={item} saver={saver}/><div><small>{sourceName(item.source_type)}</small><h3>{item.name}</h3><p>@{item.sellerEcoId} · {item.category}</p><p>{item.description}</p>{item.location&&<p>Seller location: {item.location}</p>}
    <ProductDetails item={item}/><strong>{money(price)}{item.variants.length&&!variant?' base price':''}</strong><p>{available?(variant?.stock??item.stock)+' in stock at last check':'Out of stock'}</p>
    {item.variants.length>0&&<label>Choose an option<select aria-label={'Choose option for '+item.name} value={options[item.id]||''} onChange={e=>setOptions({...options,[item.id]:e.target.value})}><option value="">Choose option</option>{item.variants.map(v=><option key={v.id} value={v.id} disabled={v.stock===0}>{v.title}{v.priceMinor?' · '+money(v.priceMinor):''}{v.stock===0?' · unavailable':''}</option>)}</select></label>}
    <button type="button" disabled={!online||!available||item.sellerIsCurrentUser||Boolean(item.variants.length&&!variant)} onClick={()=>review(item)}>{item.sellerIsCurrentUser?'Your listing':account?'Review in account bag':'Sign in to review item'}</button>
   </div></article>;
  })}</div></>}
  {next&&<button disabled={busy||!online} type="button" onClick={()=>void load(applied,next)}>Load more listings</button>}
  <p className="native-catalog-note">Prices and stock are checked again in the account bag. Publication does not imply seller verification. Delivery, payment and refunds are separate steps; EcoVibes platform fee is GH₵0.</p>
 </section>;
}
