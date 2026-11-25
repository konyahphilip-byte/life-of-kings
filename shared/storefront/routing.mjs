// Pure resolver contract. No live routes, DNS, redirects or shop publication are
// registered here. Persisted slug uniqueness + tombstones need a DB transaction.
const reserved=new Set(['admin','api','studio','discover','login','auth','support','shop','shops','settings','www','ecovibes']);
const valid=slug=>typeof slug==='string'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)&&!reserved.has(slug);
const isPublic=shop=>shop?.status==='active'&&shop.visibility==='public'&&shop.publication==='published';
export function validateSlugAssignment(slug,shopId,slugs){
 if(!valid(slug))throw Error('INVALID_SLUG');
 if(slugs.some(row=>row.slug===slug&&row.shopId!==shopId))throw Error('SLUG_TAKEN');
 return slug;
}
export function resolvePublicShop(slug,{shops,slugs}){
 if(!valid(slug))return{status:404};
 const matching=slugs.filter(row=>row.slug===slug);
 if(matching.length!==1)return{status:404};
 const owners=shops.filter(shop=>shop.id===matching[0].shopId);
 if(owners.length!==1)return{status:404};
 const shop=owners[0];
 const canonical=slugs.filter(row=>row.slug===shop.canonicalSlug);
 if(!isPublic(shop)||!valid(shop.canonicalSlug)||canonical.length!==1||canonical[0].shopId!==shop.id)return{status:404};
 return slug===shop.canonicalSlug?{status:200,shopId:shop.id,canonicalPath:`/shop/${shop.canonicalSlug}`}:{status:308,shopId:shop.id,location:`/shop/${shop.canonicalSlug}`};
}
export function canonicalPublicLink(config,shop){
 let url;try{url=new URL(config.origin)}catch{throw Error('PUBLIC_ORIGIN_UNVERIFIED')}
 if(config.verified!==true||url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port)throw Error('PUBLIC_ORIGIN_UNVERIFIED');
 if(!isPublic(shop)||!valid(shop.canonicalSlug))throw Error('SHOP_NOT_PUBLIC');
 return `${url.origin}/shop/${shop.canonicalSlug}`;
}
