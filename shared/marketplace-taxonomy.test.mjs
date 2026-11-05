import {describe,it,expect} from 'vitest';
import {CATEGORIES,TAXONOMY_VERSION,normalizeClassification,categoryIds,readClassification} from './marketplace-taxonomy.mjs';
const assert=(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});};
const valid={categoryId:'electronics.phones',categoryVersion:1,attributes:{condition:'used',brand:'  Example  ',storageGb:128}};
describe('shared product category and attribute contract',()=>{
 it('normalizes a seller declaration without inventing verification',()=>{expect(normalizeClassification(valid,assert,'physical')).toEqual({categoryId:'electronics.phones',categoryVersion:TAXONOMY_VERSION,attributes:{condition:'used',brand:'Example',storageGb:128},category:'Phones'});expect(valid.attributes.brand).toBe('  Example  ');});
 it('provides stable parent discovery and leaf-only publishing',()=>{expect(categoryIds('electronics')).toContain('electronics.phones');expect(categoryIds('electronics.phones')).toEqual(['electronics.phones']);expect(()=>normalizeClassification({...valid,categoryId:'electronics'},assert,'physical')).toThrow();expect(new Set(CATEGORIES.map(c=>c.id)).size).toBe(CATEGORIES.length);});
 it.each([
  {...valid,categoryId:'unknown'}, {...valid,categoryId:'restricted.medicines'}, {...valid,categoryVersion:2},
  {...valid,attributes:{}}, {...valid,attributes:{condition:'certified'}}, {...valid,attributes:{condition:'used',storageGb:'128'}},
  {...valid,attributes:{condition:'used',storageGb:-1}}, {...valid,attributes:{condition:'used',storageGb:1.5}},
  {...valid,attributes:{condition:'used',sellerId:'private'}}, {...valid,attributes:[]}, {...valid,attributes:null},
  {...valid,attributes:{condition:'used',brand:'x'.repeat(81)}}, {...valid,attributes:{condition:'used',brand:'bad\u0000value'}},
 ])('rejects unsupported or misleading attributes %#',input=>{expect(()=>normalizeClassification(input,assert,'physical')).toThrow();});
 it('enforces product type and does not accept arbitrary private data',()=>{expect(()=>normalizeClassification(valid,assert,'digital')).toThrow();expect(()=>normalizeClassification({...valid,attributes:JSON.parse('{"__proto__":"bad","condition":"used"}')},assert,'physical')).toThrow();});
 it('preserves legacy and malformed rows as unstructured without inferred attributes',()=>{expect(readClassification({category:'Phones'})).toBeNull();expect(readClassification({category_id:'electronics.phones',category_version:1,product_type:'physical',attributes_json:'broken'})).toBeNull();expect(readClassification({category_id:'electronics.phones',category_version:1,product_type:'physical',attributes_json:JSON.stringify(valid.attributes)})).toMatchObject({attributes:{condition:'used',storageGb:128}});});
});
