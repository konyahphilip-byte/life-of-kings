// Target M01 projection over the existing products authority, once additive
// publication/merchant columns are migrated. Not wired to legacy production SQL.
export function publicListings({listings,shops,merchants,eligibleCategories,shopId,listingId}){
 const ids=new Set(), shopMap=new Map(shops.map(s=>[s.id,s])), merchantMap=new Map(merchants.map(m=>[m.id,m]));
 for(const row of listings){if(ids.has(row.id))throw Error('DUPLICATE_LISTING');ids.add(row.id)}
 return listings.filter(p=>{
  const s=shopMap.get(p.shopId),m=merchantMap.get(p.merchantId);
  return p.status==='active'&&p.publication==='published'&&p.moderation==='approved'&&eligibleCategories.includes(p.categoryId)
   &&s?.merchantId===p.merchantId&&s.status==='active'&&s.visibility==='public'&&s.publication==='published'&&m?.status==='active'&&m.visibility==='public'
   &&(!shopId||p.shopId===shopId)&&(!listingId||p.id===listingId);
 }).map(p=>({id:p.id,shopId:p.shopId,merchantId:p.merchantId,title:p.title,description:p.description,currency:p.currency,categoryId:p.categoryId,priceMinor:p.priceMinor,availability:p.availability,imageId:p.imageId}));
}
