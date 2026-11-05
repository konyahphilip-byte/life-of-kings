// Existing account-cart authorization reused by consequential commerce commands.
export function createCommerceAuthorizer({q,assert,now,postgresMode}){
 async function actor(id){assert(await q("SELECT id FROM users WHERE id=? AND status='active'"+(postgresMode?' FOR SHARE':''),id),403,'account_unavailable','This account is unavailable.');}
 async function authorize(ctx,role=null){
  assert(ctx.user,401,'sign_in_required','Sign in to continue.');await actor(ctx.user.id);
  assert(typeof ctx.sessionHash==='string',401,'session_expired','Sign in again before using account commerce.');
  const session=postgresMode?await q('SELECT public.ecovibes_cart_session_authorized(?,?,?) AS allowed',ctx.sessionHash,ctx.user.id,ctx.csrfToken):await q('SELECT 1 AS allowed FROM sessions WHERE token_hash=? AND user_id=? AND csrf_token=? AND expires_at>?',ctx.sessionHash,ctx.user.id,ctx.csrfToken,now());
  assert(session?.allowed,401,'session_expired','Sign in again before using account commerce.');
  if(role)assert(await q('SELECT 1 ok FROM roles WHERE user_id=? AND role=?',ctx.user.id,role),403,'role_required','An active '+role+' role is required.');
 }
 return {actor,authorize};
}
