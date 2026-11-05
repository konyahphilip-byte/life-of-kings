// Versioned seller declarations, not certifications or a restricted-goods detector.
export const TAXONOMY_VERSION=1;
const condition={key:'condition',label:'Condition',type:'enum',required:true,options:['new','used','refurbished']};
const text=(key,label,max=80)=>({key,label,type:'text',max});
const root=(id,label)=>({id,label,parentId:null});
const leaf=(id,label,parentId,attributes,productType='physical')=>({id,label,parentId,productType,attributes});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const CATEGORIES=freeze([
 root('fashion','Fashion'),root('electronics','Electronics'),root('home','Home & tools'),root('food','Fresh food'),root('creative','Books & creative goods'),root('other','Other listings'),
 leaf('fashion.clothing','Clothing','fashion',[condition,text('size','Size',40),text('material','Material')]),
 leaf('fashion.bags','Bags & accessories','fashion',[condition,text('material','Material')]),
 leaf('electronics.phones','Phones','electronics',[condition,text('brand','Brand'),text('model','Model'),{key:'storageGb',label:'Storage · GB',type:'integer',min:1,max:8192}]),
 leaf('electronics.accessories','Electronic accessories','electronics',[condition,text('compatibility','Compatible devices',120)]),
 leaf('home.furniture','Furniture','home',[condition,text('material','Material'),text('dimensions','Dimensions',120)]),
 leaf('home.hand-tools','Hand tools','home',[condition,text('material','Material')]),
 leaf('food.produce','Fresh produce','food',[{key:'unit',label:'Price is per',type:'enum',required:true,options:['item','kg','bunch','bag','crate']},text('originArea','Growing area')]),
 leaf('creative.books','Printed books','creative',[condition,text('language','Language'),text('author','Author',120)]),
 leaf('creative.crafts','Art & crafts','creative',[condition,text('material','Material')]),
 leaf('other.goods','Other ordinary goods','other',[condition,text('material','Material')]),
 leaf('other.digital','Digital content','other',[{key:'rights',label:'Your selling rights',type:'enum',required:true,options:['own-work','licensed']}],'digital'),
 leaf('other.services','Service listing','other',[{...text('scope','What is included',180),required:true}],'service'),
]);
export const categoryById=id=>CATEGORIES.find(c=>c.id===id);
export function categoryIds(id){const c=categoryById(id);return !c?[]:c.parentId?[c.id]:CATEGORIES.filter(x=>x.parentId===id).map(x=>x.id);}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export function normalizeClassification(input,assert,productType='physical'){
 const c=categoryById(input?.categoryId);
 assert(c?.parentId&&input.categoryVersion===TAXONOMY_VERSION,400,'invalid_product_category','Choose a current product category.');
 assert(c.productType===productType,400,'category_product_type','Choose a category that matches this product type.');
 const source=input.attributes;
 assert(record(source)&&Object.keys(source).length<=12&&Object.keys(source).every(k=>c.attributes.some(a=>a.key===k)),400,'invalid_product_attributes','Use only the details listed for this category.');
 const attributes={};
 for(const a of c.attributes){
  const raw=source[a.key];
  if(raw===undefined||raw===''){assert(!a.required,400,'required_product_attribute','Add '+a.label.toLowerCase()+'.');continue;}
  if(a.type==='enum'){assert(typeof raw==='string'&&a.options.includes(raw),400,'invalid_product_attribute','Choose a valid '+a.label.toLowerCase()+'.');attributes[a.key]=raw;}
  else if(a.type==='integer'){assert(Number.isSafeInteger(raw)&&raw>=a.min&&raw<=a.max,400,'invalid_product_attribute','Use a valid whole number for '+a.label.toLowerCase()+'.');attributes[a.key]=raw;}
  else{assert(typeof raw==='string'&&!/[\u0000-\u001f\u007f]/.test(raw),400,'invalid_product_attribute','Use plain text for '+a.label.toLowerCase()+'.');const value=raw.normalize('NFKC').trim();assert(value.length<=a.max&&(!a.required||value.length>0),400,'invalid_product_attribute','Check '+a.label.toLowerCase()+' length.');if(value)attributes[a.key]=value;}
 }
 return {categoryId:c.id,categoryVersion:TAXONOMY_VERSION,category:c.label,attributes};
}
export function readClassification(row){
 if(!row?.category_id)return null;
 try{return normalizeClassification({categoryId:row.category_id,categoryVersion:row.category_version,attributes:JSON.parse(row.attributes_json)},(ok)=>{if(!ok)throw Error();},row.product_type||'physical');}catch{return null;}
}
