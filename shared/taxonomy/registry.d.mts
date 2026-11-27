export type ListingType='physical'|'vehicle'|'equipment'|'property'|'digital'|'material'|'service';
export type ListingIntent='sell'|'rent'|'lease'|'hire'|'quote';
export type EligibilityState='group'|'candidate'|'review-required'|'restricted'|'disabled'|'prohibited';
export interface Eligibility {readonly state:EligibilityState;readonly reason:string}
export interface Category {
 readonly id:string;readonly key:string;readonly parentId:string|null;readonly canonicalSlug:string;
 readonly displayName:string;readonly description:string;readonly depth:number;readonly sortOrder:number;
 readonly iconReference:string;readonly publicationEligibility:Eligibility;
 readonly listingTypes:readonly ListingType[];readonly listingIntents:readonly ListingIntent[];
 readonly schemaRef:string|null;readonly schemaVersion:number;readonly activeStatus:'active'|'deprecated';readonly replacementId?:string;
}
export interface AttributeDefinition {
 readonly id:string;readonly key:string;readonly label:string;readonly type:'text'|'enum'|'integer'|'number';
 readonly filterable:boolean;readonly searchable:boolean;readonly options?:readonly string[];
 readonly min?:number;readonly max?:number;readonly unit?:string|null;
}
export interface Schema {
 readonly ref:string;readonly version:number;
 readonly attributes:readonly {readonly key:string;readonly required:boolean;readonly displayOrder:number}[];
}
export interface Manifest {
 readonly version:number;readonly locales:readonly string[];readonly listingTypes:readonly ListingType[];readonly listingIntents:readonly ListingIntent[];
 readonly categories:readonly Category[];readonly attributeDefinitions:readonly AttributeDefinition[];readonly schemas:readonly Schema[];
 readonly aliases:readonly {readonly categoryId:string;readonly locale:string;readonly term:string;readonly ambiguous?:boolean}[];
 readonly related:readonly {readonly fromId:string;readonly toId:string;readonly reason:string}[];
 readonly coverage:readonly {readonly domain:number;readonly categoryIds:readonly string[];readonly dimension:'category'|'listingIntent'|'minimumQuantity';readonly decision:string}[];
}
export interface ClassificationInput {
 readonly registryVersion:number;readonly categoryId:string;readonly listingType:ListingType;readonly listingIntent:ListingIntent;
 readonly attributes:Readonly<Record<string,string|number>>;
}
export interface Classification extends ClassificationInput {
 readonly schemaVersion:number;readonly issues:readonly {readonly field:string;readonly code:string;readonly message:string}[];
}
export interface Registry {
 readonly version:number;
 byId(id:string):Category|undefined;byKey(key:string):Category|undefined;
 roots():readonly Category[];children(id:string):readonly Category[];breadcrumbs(id:string):readonly Category[];related(id:string):readonly Category[];
 schema(id:string):{readonly ref:string;readonly version:number;readonly attributes:readonly (AttributeDefinition&{readonly required:boolean;readonly displayOrder:number})[]}|null;
 eligibility(id:string):Eligibility;
 search(query:string,options?:{limit?:number;locale?:'en-GH'}):readonly {readonly category:Category;readonly score:number;readonly ambiguous:boolean}[];
 normalize(input:ClassificationInput,options?:{partial?:boolean}):Classification;
}
export const MANIFEST:Manifest;
export class TaxonomyError extends Error {readonly code:string;readonly field?:string;constructor(code:string,message:string,field?:string)}
export function createRegistry(input:unknown):Registry;
export function validateTransition(previous:Manifest,next:Manifest):{readonly fromVersion:number;readonly toVersion:number;readonly changes:readonly {readonly id:string;readonly fields:readonly string[]}[];readonly added:readonly string[]};
export function legacyAdvice(row:Record<string,unknown>,registry:Registry):{readonly registryVersion:number;readonly requiresReview:true;readonly automaticAssignment:null;readonly legacyValid:boolean;readonly reasonCode:string;readonly suggestedGroupIds:readonly string[]};
