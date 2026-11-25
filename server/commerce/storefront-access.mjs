// Unregistered policy adapter. Requires the existing session authority and a
// current, transactionally read membership projection. No new authentication.
const capabilities={owner:['theme.read','theme.edit','theme.publish','catalogue.edit','enquiry.reply'],
 administrator:['theme.read','theme.edit','catalogue.edit','enquiry.reply'],product_manager:['theme.read','catalogue.edit'],
 enquiry_operator:['enquiry.reply'],designer:['theme.read','theme.edit'],analyst:['theme.read']};
const operations=new Set(Object.values(capabilities).flat());
export function createStorefrontAccess({transaction,verifySession,loadMembership}){
 if(![transaction,verifySession,loadMembership].every(x=>typeof x==='function'))throw Error('SHOP_UNAVAILABLE');
 return async (ctx,input)=>{
  if(!input||Object.keys(input).length!==2||!Object.hasOwn(input,'shopId')||!Object.hasOwn(input,'capability')||typeof input.shopId!=='string'||!input.shopId||input.shopId.length>80||!operations.has(input.capability))throw Error('INVALID_OPERATION');
  if(!ctx?.user?.id||ctx.user.status!=='active')throw Error('SIGN_IN_REQUIRED');
  return transaction(async()=>{
   if(await verifySession(ctx)!==true)throw Error('SIGN_IN_REQUIRED');
   const m=await loadMembership(ctx.user.id,input.shopId);
   if(!m||m.userId!==ctx.user.id||m.shopId!==input.shopId||!m.merchantId||m.status!=='active'||!['draft','active'].includes(m.shopStatus)||!Object.hasOwn(capabilities,m.role)||!capabilities[m.role].includes(input.capability))throw Error('SHOP_FORBIDDEN');
   return {shopId:m.shopId,merchantId:m.merchantId,actorId:ctx.user.id,capability:input.capability};
  });
 };
}
