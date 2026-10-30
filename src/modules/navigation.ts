// Client destinations are an allowlist, never an authorization mechanism.
export const destinations={Home:'home',Explore:'explore',Create:'create',Messages:'messages','Calls & Live':'calls',Reels:'reels',Profile:'profile',Marketplace:'marketplace',Opportunities:'opportunities',Gaming:'gaming',Communities:'communities','Quick&Handi':'quick-handi',Waste:'waste','EcoVibes ID':'account',Rewards:'rewards',Wallet:'wallet','Money & Trust':'money-trust',Settings:'settings'} as const;
export type Page=keyof typeof destinations;
export type ContentPage=Page;
export function isDestination(value:unknown):value is Page{return typeof value==='string'&&Object.hasOwn(destinations,value);}
export function destinationUrl(page:Page,location:Pick<Location,'pathname'|'search'>=window.location){
 const query=new URLSearchParams(location.search);
 // Explicitly leaving Account must not duplicate callback credentials into
 // unrelated history entries. An Account reload preserves its original flow.
 if(page!=='EcoVibes ID')for(const key of ['code','recovery','access_token','refresh_token','token_hash','error','error_description'])query.delete(key);
 const search=query.toString();return `${location.pathname}${search?'?'+search:''}#${destinations[page]}`;
}
export function readNavigation(location:Pick<Location,'hash'|'search'>=window.location):{page:ContentPage;composer:boolean;unavailable:boolean}{
 const search=new URLSearchParams(location.search),fragment=location.hash.slice(1),auth=new URLSearchParams(fragment);
 const entry=Object.entries(destinations).find(([,slug])=>slug===fragment.toLowerCase());
 // Route callbacks to the existing account component, without exposing, storing
 // or forwarding credential values. Provider verification remains its concern.
 if(!entry&&(search.get('recovery')==='1'||search.has('code')||['access_token','refresh_token','token_hash','error_description'].some(key=>auth.has(key))))return{page:'EcoVibes ID',composer:false,unavailable:false};
 if(!fragment)return{page:'Home',composer:false,unavailable:false};
 if(!entry)return{page:'Home',composer:false,unavailable:true};
 return{page:entry[0] as ContentPage,composer:false,unavailable:false};
}
