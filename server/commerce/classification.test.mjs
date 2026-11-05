import {describe,it,expect} from 'vitest';
import {productClassification,updatedClassification} from './classification.mjs';
const assert=(ok,status,code,message)=>{if(!ok)throw Object.assign(Error(message),{status,code});};
const previous={category_id:'electronics.phones',category_version:1,attributes_json:'{"condition":"used","storageGb":128}',product_type:'physical'};
describe('product classification compatibility',()=>{
 it('fails closed when structured storage is unavailable but preserves legacy contracts',()=>{expect(productClassification({category:'Legacy'},'physical',assert,false)).toBeNull();expect(()=>productClassification({categoryId:'electronics.phones'},'physical',assert,false)).toThrow(/temporarily unavailable/);});
 it('updates only explicit category metadata and refuses a partial legacy classification',()=>{expect(updatedClassification({stock:4},previous,assert,true)).toBeNull();expect(updatedClassification({attributes:{condition:'new'}},previous,assert,true)).toMatchObject({categoryId:'electronics.phones',attributes:{condition:'new'}});expect(()=>updatedClassification({attributes:{condition:'new'}},{category:'Legacy'},assert,true)).toThrow();expect(()=>updatedClassification({categoryId:null},previous,assert,true)).toThrow();});
});
