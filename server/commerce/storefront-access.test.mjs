import {describe,it,expect,vi} from 'vitest';
import {createStorefrontAccess} from './storefront-access.mjs';
const ctx={user:{id:'user-one',status:'active'}};
function fixture(){
 const deps={transaction:async work=>work(), verifySession:vi.fn(async()=>true),
   loadMembership:vi.fn(async(userId,shopId)=>({userId,shopId,merchantId:'merchant-one',role:'owner',status:'active',shopStatus:'draft'}))};
 return {deps, authorize:createStorefrontAccess(deps)};
}
describe('storefront capability boundary (not a registered API)',()=>{
 it('uses the existing authenticated principal and resolves current membership each operation',async()=>{
  const {deps,authorize}=fixture(); const result=await authorize(ctx,{shopId:'shop-one',capability:'theme.edit'});
  expect(deps.verifySession).toHaveBeenCalledWith(ctx); expect(deps.loadMembership).toHaveBeenCalledWith('user-one','shop-one');
  expect(result).toEqual({shopId:'shop-one',merchantId:'merchant-one',actorId:'user-one',capability:'theme.edit'});
  deps.loadMembership.mockResolvedValue(null);
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.edit'})).rejects.toThrow('SHOP_FORBIDDEN');
 });
 it('fails closed for expired sessions before reading private membership',async()=>{
  const {deps,authorize}=fixture(); deps.verifySession.mockResolvedValue(false);
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.read'})).rejects.toThrow('SIGN_IN_REQUIRED');
  expect(deps.loadMembership).not.toHaveBeenCalled();
 });
 it.each([null,{id:'user-one',status:'suspended'}])('rejects absent or suspended identity',async user=>{
  const {deps,authorize}=fixture(); await expect(authorize({user},{shopId:'shop-one',capability:'theme.read'})).rejects.toThrow('SIGN_IN_REQUIRED');
  expect(deps.loadMembership).not.toHaveBeenCalled();
 });
 it.each([{userId:'other'},{shopId:'other'},{status:'revoked'},{shopStatus:'suspended'},{role:'unknown'},{role:'__proto__'},{role:'constructor'}])('rejects mismatched or revoked authority: %j',async patch=>{
  const {deps,authorize}=fixture(); const row=await deps.loadMembership('user-one','shop-one'); deps.loadMembership.mockResolvedValue({...row,...patch});
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.edit'})).rejects.toThrow('SHOP_FORBIDDEN');
 });
 it('separates enquiry operators, designers and publication authority',async()=>{
  const {deps,authorize}=fixture(); const row=await deps.loadMembership('user-one','shop-one');
  deps.loadMembership.mockResolvedValue({...row,role:'designer'});
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.edit'})).resolves.toBeDefined();
  for(const capability of ['enquiry.reply','theme.publish']) await expect(authorize(ctx,{shopId:'shop-one',capability})).rejects.toThrow('SHOP_FORBIDDEN');
  deps.loadMembership.mockResolvedValue({...row,role:'enquiry_operator'});
  await expect(authorize(ctx,{shopId:'shop-one',capability:'enquiry.reply'})).resolves.toBeDefined();
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.edit'})).rejects.toThrow('SHOP_FORBIDDEN');
 });
 it('does not trust a role or actor supplied by the caller, and has no payment capability',async()=>{
  const {authorize}=fixture();
  await expect(authorize(ctx,{shopId:'shop-one',capability:'theme.edit',role:'owner'})).rejects.toThrow('INVALID_OPERATION');
  await expect(authorize(ctx,{shopId:'shop-one',capability:'payment.create'})).rejects.toThrow('INVALID_OPERATION');
 });
});
