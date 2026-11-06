const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PROFILE_VERSION='20261028233000_people_profile_media';
export const PROFILE_SQLITE_SCHEMA=`CREATE TABLE IF NOT EXISTS people_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),avatar_asset_id TEXT REFERENCES media_assets(id),banner_asset_id TEXT REFERENCES media_assets(id),revision INTEGER NOT NULL CHECK(revision>=1),updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS people_profiles_avatar_asset ON people_profiles(avatar_asset_id) WHERE avatar_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS people_profiles_banner_asset ON people_profiles(banner_asset_id) WHERE banner_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS people_follows_target_user ON people_follows(target_user_id,user_id);`;
export function createPeopleProfile({q,run,transaction,assert,now,event,rateLimit,postgresMode,available=false}){
 async function authorize(viewer,target){
  assert(await q("SELECT 1 ok FROM users WHERE id=? AND status='active'",viewer),401,'sign_in_required','Sign in to view profiles.');
  assert(await q("SELECT 1 ok FROM users WHERE id=? AND status='active'",target),404,'profile_unavailable','This profile is unavailable.');
  if(viewer!==target)assert(!await q('SELECT 1 ok FROM people_friendships WHERE ((low_user_id=? AND high_user_id=?) OR (high_user_id=? AND low_user_id=?)) AND (low_blocked=1 OR high_blocked=1)',viewer,target,viewer,target),404,'profile_unavailable','This profile is unavailable.');
 }
 async function read(viewer,target){
  await authorize(viewer,target);
  const counts=await q(`SELECT
   (SELECT count(*) FROM people_friendships r JOIN users u ON u.id=CASE WHEN r.low_user_id=? THEN r.high_user_id ELSE r.low_user_id END WHERE (r.low_user_id=? OR r.high_user_id=?) AND r.status='accepted' AND r.low_blocked=0 AND r.high_blocked=0 AND u.status='active') friends,
   (SELECT count(*) FROM people_follows f JOIN users u ON u.id=f.user_id WHERE f.target_user_id=? AND u.status='active' AND NOT EXISTS(SELECT 1 FROM people_friendships b WHERE ((b.low_user_id=? AND b.high_user_id=f.user_id) OR (b.high_user_id=? AND b.low_user_id=f.user_id)) AND (b.low_blocked=1 OR b.high_blocked=1))) followers,
   (SELECT count(*) FROM people_follows f JOIN users u ON u.id=f.target_user_id WHERE f.user_id=? AND u.status='active' AND NOT EXISTS(SELECT 1 FROM people_friendships b WHERE ((b.low_user_id=? AND b.high_user_id=f.target_user_id) OR (b.high_user_id=? AND b.low_user_id=f.target_user_id)) AND (b.low_blocked=1 OR b.high_blocked=1))) following`,target,target,target,target,target,target,target,target,target);
  const row=available?await q('SELECT * FROM people_profiles WHERE user_id=?',target):null;
  return {viewerId:viewer,ownerId:target,mediaEnabled:available,avatarAssetId:row?.avatar_asset_id||null,bannerAssetId:row?.banner_asset_id||null,revision:row?Number(row.revision):0,updatedAt:row?.updated_at||null,counts:{friends:Number(counts.friends),followers:Number(counts.followers),following:Number(counts.following)}};
 }
 async function save(actor,body){
  assert(available,503,'profile_media_unavailable','Profile photo storage is not available yet.');
  assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===4&&Object.keys(body).every(k=>['expectedOwnerId','avatarAssetId','bannerAssetId','revision'].includes(k))&&Number.isSafeInteger(body.revision)&&body.revision>=0&&[body.avatarAssetId,body.bannerAssetId].every(v=>v===null||typeof v==='string'&&UUID.test(v)),400,'invalid_profile','Use the profile photo controls and refresh before saving.');
  assert(body.expectedOwnerId===actor,403,'account_changed','Your sign-in changed. Reopen your profile before saving.');
  return transaction(async()=>{
   assert((await run("UPDATE users SET id=id WHERE id=? AND status='active'",actor)).changes===1,401,'sign_in_required','Sign in to edit your profile.');
   const current=await q(`SELECT * FROM people_profiles WHERE user_id=?${postgresMode?' FOR UPDATE':''}`,actor);
   // Exact retry after a lost response must not create another revision/event.
   if(current&&current.avatar_asset_id===body.avatarAssetId&&current.banner_asset_id===body.bannerAssetId)return read(actor,actor);
   assert(body.revision===(current?Number(current.revision):0),409,'profile_changed','Your profile changed on another device. Refresh before saving.');
   for(const assetId of new Set([body.avatarAssetId,body.bannerAssetId].filter(Boolean))){
    const asset=await q('SELECT id,mime_type FROM media_assets WHERE id=? AND owner_id=?',assetId,actor);
    assert(asset,404,'profile_image_unavailable','Choose an image uploaded by this account.');
    assert(['image/jpeg','image/png','image/webp'].includes(asset.mime_type),400,'profile_image_required','Choose a JPG, PNG or WebP profile image.');
   }
   const revision=(current?Number(current.revision):0)+1;
   await run('INSERT INTO people_profiles(user_id,avatar_asset_id,banner_asset_id,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_asset_id=excluded.avatar_asset_id,banner_asset_id=excluded.banner_asset_id,revision=excluded.revision,updated_at=excluded.updated_at',actor,body.avatarAssetId,body.bannerAssetId,revision,now());
   await event(actor,'people_profile',actor,'PROFILE_IMAGES_UPDATED',{revision});
   return read(actor,actor);
  });
 }
 async function route(ctx,method,path,body,query){
  assert(ctx.user?.status==='active'&&UUID.test(ctx.user.id),401,'sign_in_required','Sign in to view profiles.');
  assert(query.size===0,400,'invalid_profile_query','Use the profile controls without account selectors.');
  const match=path.match(/^\/people\/profiles\/(me|[0-9a-f-]{36})(?:\/media\/(avatar|banner))?$/i);
  assert(match,404,'profile_unavailable','This profile is unavailable.');
  const target=match[1]==='me'?ctx.user.id:match[1].toLowerCase();assert(UUID.test(target),404,'profile_unavailable','This profile is unavailable.');
  await rateLimit(`profile:${ctx.user.id}`,60,60_000);
  if(method==='GET'){
   const result=await read(ctx.user.id,target);
   if(match[2]){
    const assetId=result[match[2]==='avatar'?'avatarAssetId':'bannerAssetId'];assert(assetId,404,'profile_image_unavailable','This profile image is unavailable.');
    const asset=await q('SELECT id,mime_type FROM media_assets WHERE id=? AND owner_id=?',assetId,target);assert(asset,404,'profile_image_unavailable','This profile image is unavailable.');
    return {mediaAsset:asset};
   }
   return result;
  }
  assert(method==='POST'&&match[1]==='me'&&!match[2],404,'profile_unavailable','This profile is unavailable.');
  return save(ctx.user.id,body);
 }
 return{route};
}
