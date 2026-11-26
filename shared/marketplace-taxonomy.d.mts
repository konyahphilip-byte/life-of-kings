export type Attribute={key:string;label:string;type:'enum'|'text'|'integer';required?:boolean;options?:readonly string[];max?:number;min?:number};
export type Category={id:string;label:string;parentId:string|null;productType?:string;attributes?:readonly Attribute[]};
export type Classification={categoryId:string;categoryVersion:number;category:string;attributes:Record<string,string|number>};
export const TAXONOMY_VERSION:number;
export const CATEGORIES:readonly Category[];
export function categoryById(id:unknown):Category|undefined;
export function categoryIds(id:string):string[];
export function normalizeClassification(input:unknown,assert:(ok:unknown,status:number,code:string,message:string)=>void,productType?:string):Classification;
export function readClassification(row:unknown):Classification|null;
