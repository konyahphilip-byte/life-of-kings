import {normalizeClassification,readClassification} from '../../shared/marketplace-taxonomy.mjs';
export const CLASSIFICATION_VERSION='20261105120000_product_classification';
export const CLASSIFICATION_COLUMNS=[['products','category_id','TEXT'],['products','category_version','INTEGER'],['products','attributes_json',"TEXT NOT NULL DEFAULT '{}'"]];
export function productClassification(body,type,assert,available){
 if(!['categoryId','categoryVersion','attributes'].some(k=>Object.hasOwn(body,k)))return null;
 assert(available,503,'classification_unavailable','Product categories are temporarily unavailable. Your draft has not been published.');
 return normalizeClassification(body,assert,type);
}
export function updatedClassification(body,product,assert,available){
 const fields=['categoryId','categoryVersion','attributes'];
 if(!fields.some(k=>Object.hasOwn(body,k)))return null;
 const previous=readClassification(product)||{};
 return productClassification({...previous,...Object.fromEntries(fields.filter(k=>Object.hasOwn(body,k)).map(k=>[k,body[k]]))},product.product_type||'physical',assert,available);
}
export function publicClassification(row){const c=readClassification(row);return c?{categoryId:c.categoryId,categoryVersion:c.categoryVersion,attributes:c.attributes}:{categoryId:null,categoryVersion:null,attributes:{}};}
export async function saveClassification(run,id,value){if(value)await run('UPDATE products SET category_id=?,category_version=?,attributes_json=? WHERE id=?',value.categoryId,value.categoryVersion,JSON.stringify(value.attributes),id);}
