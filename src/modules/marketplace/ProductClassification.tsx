import {CATEGORIES,categoryById,normalizeClassification,TAXONOMY_VERSION} from '../../../shared/marketplace-taxonomy.mjs';
type Values=Record<string,string|number>;
export default function ProductClassification({productType,categoryId,attributes,onChange}:{productType:string;categoryId:string;attributes:Values;onChange:(categoryId:string,attributes:Values)=>void}){
 const selected=categoryById(categoryId);
 function change(key:string,value:string|number){const next={...attributes};if(value==='')delete next[key];else next[key]=value;onChange(categoryId,next);}
 return <fieldset className="product-classification"><legend>Help buyers choose the right product</legend>
  <label>Category<select required value={categoryId} onChange={e=>onChange(e.target.value,{})}><option value="">Choose a category</option>{CATEGORIES.filter(c=>!c.parentId).map(root=><optgroup key={root.id} label={root.label}>{CATEGORIES.filter(c=>c.parentId===root.id&&c.productType===productType).map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}</select></label>
  {selected?.attributes?.map(a=><label key={a.key}>{a.label}{!a.required?' (optional)':''}{a.type==='enum'?<select required={a.required} value={attributes[a.key]??''} onChange={e=>change(a.key,e.target.value)}><option value="">Choose {a.label.toLowerCase()}</option>{a.options?.map(v=><option key={v} value={v}>{v.replaceAll('-',' ')}</option>)}</select>:<input type={a.type==='integer'?'number':'text'} required={a.required} min={a.type==='integer'?a.min:undefined} max={a.type==='integer'?a.max:undefined} step={a.type==='integer'?1:undefined} maxLength={a.type==='text'?a.max:undefined} value={attributes[a.key]??''} onChange={e=>change(a.key,a.type==='integer'&&e.target.value!==''?Number(e.target.value):e.target.value)}/>}</label>)}
  <small>These are your product details, not an EcoVibes inspection or verification. Describe condition and availability accurately. Restricted goods need separate approval and are not enabled by choosing a category.</small>
 </fieldset>;
}
export function ProductDetails({item}:{item:{categoryId?:string|null;categoryVersion?:number|null;attributes?:Values;productType?:string}}){
 if(item.categoryVersion!==TAXONOMY_VERSION)return null;
 let value;try{value=normalizeClassification(item,(ok)=>{if(!ok)throw Error();},item.productType||'physical');}catch{return null;}
 const category=categoryById(value.categoryId);
 return <div className="product-declared-details"><small>Seller-entered details</small><dl>{category?.attributes?.filter(a=>Object.hasOwn(value.attributes,a.key)).map(a=><div key={a.key}><dt>{a.label}</dt><dd>{String(value.attributes[a.key]).replaceAll('-',' ')}</dd></div>)}</dl></div>;
}
