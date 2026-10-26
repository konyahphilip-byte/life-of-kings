const DAY=86_400_000, REQUEST_LIFETIME=7*DAY;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const FRIENDS_SQLITE_SCHEMA=`CREATE TABLE IF NOT EXISTS people_friendships(
 low_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 high_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requester_id TEXT REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'none' CHECK(status IN ('none','pending','accepted','closed')),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 low_blocked INTEGER NOT NULL DEFAULT 0 CHECK(low_blocked IN (0,1)),
 high_blocked INTEGER NOT NULL DEFAULT 0 CHECK(high_blocked IN (0,1)),
 requested_at TEXT,updated_at TEXT NOT NULL,
 PRIMARY KEY(low_user_id,high_user_id),CHECK(low_user_id<high_user_id),
 CHECK(requester_id IS NULL OR requester_id IN (low_user_id,high_user_id)),
 CHECK(status NOT IN ('pending','accepted') OR (requester_id IS NOT NULL AND requested_at IS NOT NULL)));
 CREATE INDEX IF NOT EXISTS people_friendships_high_recent ON people_friendships(high_user_id,updated_at DESC);
 CREATE INDEX IF NOT EXISTS people_friendships_low_recent ON people_friendships(low_user_id,updated_at DESC);`;

// These records express friendship consent only. They issue no room token,
// publish no media, and do not grant access to private jobs or conversations.
export function createPeopleFriends({q,all,run,transaction,assert,now,notify,event,rateLimit,postgresMode}) {
 const validPair=(actor,target)=>assert(UUID.test(actor)&&UUID.test(target)&&actor!==target,404,'person_not_found','Person not found.');
 const pair=(actor,target)=>[actor,target].sort();
 const alive=row=>row?.status==='pending'&&Date.parse(row.requested_at)>Date.parse(now())-REQUEST_LIFETIME;
 const mineBlocked=(row,actor)=>Number(row?.[actor===row?.low_user_id?'low_blocked':'high_blocked'])===1;
 const otherBlocked=(row,actor)=>Number(row?.[actor===row?.low_user_id?'high_blocked':'low_blocked'])===1;
 function view(row,actor){
  const revision=Number(row?.revision||0);
  if(mineBlocked(row,actor))return {state:'blocked',revision,actions:['unblock']};
  if(otherBlocked(row,actor))return {state:'unavailable',revision,actions:[]};
  if(row?.status==='accepted')return {state:'friends',revision,actions:['remove','block']};
  if(alive(row))return row.requester_id===actor?{state:'outgoing',revision,actions:['cancel','block']}:{state:'incoming',revision,actions:['accept','decline','block']};
  const cooling=row?.status==='closed'&&Date.parse(row.updated_at)>Date.parse(now())-DAY;
  return {state:cooling?'cooldown':'none',revision,actions:cooling?['block']:['request','block']};
 }
 async function get(actor,target){
  validPair(actor,target);
  assert(await q("SELECT id FROM users WHERE id=? AND status='active'",target),404,'person_not_found','Person not found.');
  const [low,high]=pair(actor,target);
  return view(await q('SELECT * FROM people_friendships WHERE low_user_id=? AND high_user_id=?',low,high),actor);
 }
 async function act(actor,target,body){
  validPair(actor,target);
  assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(key=>['action','revision'].includes(key))&&Object.keys(body).length===2,400,'invalid_friend_action','Choose a friend request action.');
  const {action,revision}=body;
  assert(['request','accept','decline','cancel','remove','block','unblock'].includes(action)&&Number.isSafeInteger(revision)&&revision>=0,400,'invalid_friend_action','Refresh your friends and try again.');
  await rateLimit(`friends-write:${actor}`,20,60_000);
  if(action==='request')await rateLimit(`friends-request:${actor}`,10,60*60_000);
  return transaction(async()=>{
   const [low,high]=pair(actor,target),stamp=now();
   // Lock both active accounts in stable order: suspension and opposite-side
   // requests serialize with this relationship on PostgreSQL.
   for(const userId of [low,high])assert((await run("UPDATE users SET id=id WHERE id=? AND status='active'",userId)).changes===1,404,'person_not_found','Person not found.');
   await run("INSERT INTO people_friendships(low_user_id,high_user_id,status,updated_at) VALUES(?,?,'none',?) ON CONFLICT(low_user_id,high_user_id) DO NOTHING",low,high,stamp);
   const row=await q(`SELECT * FROM people_friendships WHERE low_user_id=? AND high_user_id=?${postgresMode?' FOR UPDATE':''}`,low,high);
   assert(Number(row.revision)===revision,409,'friendship_changed','This request changed. Refresh your friends.');
   const ownColumn=actor===low?'low_blocked':'high_blocked';
   if(action==='block'||action==='unblock'){
    assert(action==='block'||mineBlocked(row,actor),409,'friendship_changed','Refresh your friends.');
    await run(`UPDATE people_friendships SET ${ownColumn}=?,status='closed',revision=revision+1,updated_at=? WHERE low_user_id=? AND high_user_id=?`,action==='block'?1:0,stamp,low,high);
   }else{
    assert(!mineBlocked(row,actor)&&!otherBlocked(row,actor),404,'person_not_found','This connection is unavailable.');
    const state=view(row,actor).state;
    if(action==='request'&&state==='outgoing')return view(row,actor); // retry, no duplicate notice
    if(action==='request'){
     assert(state!=='cooldown',429,'friend_request_cooldown','Please wait 24 hours after closing a request before sending another.');
     assert(state==='none',409,'friendship_changed','Use the existing request controls.');
     await run("UPDATE people_friendships SET status='pending',requester_id=?,requested_at=?,updated_at=?,revision=revision+1 WHERE low_user_id=? AND high_user_id=?",actor,stamp,stamp,low,high);
     const sender=await q('SELECT eco_id FROM users WHERE id=?',actor);
     await notify(target,'friend_request','New friend request',`@${sender.eco_id} would like to add you. Open Calls & Live → Friends & requests to accept or decline.`,'friend_request',actor);
    }else{
     assert((action==='accept'||action==='decline')?state==='incoming':action==='cancel'?state==='outgoing':state==='friends',409,'friendship_changed','Only the right person can change an active request. Refresh your friends.');
     await run('UPDATE people_friendships SET status=?,updated_at=?,revision=revision+1 WHERE low_user_id=? AND high_user_id=?',action==='accept'?'accepted':'closed',stamp,low,high);
     if(action==='accept'){
      const recipient=await q('SELECT eco_id FROM users WHERE id=?',actor);
      await notify(target,'friend_accepted','Friend request accepted',`@${recipient.eco_id} accepted your friend request. This does not start a call.`,'friend_request',actor);
     }
    }
   }
   await event(actor,'friendship',`${low}:${high}`,`FRIEND_${action.toUpperCase()}`,{});
   return view(await q('SELECT * FROM people_friendships WHERE low_user_id=? AND high_user_id=?',low,high),actor);
  });
 }
 async function list(actor){
  const conditions={
   incoming:"r.status='pending' AND r.requester_id<>? AND r.requested_at>? AND r.low_blocked=0 AND r.high_blocked=0",
   outgoing:"r.status='pending' AND r.requester_id=? AND r.requested_at>? AND r.low_blocked=0 AND r.high_blocked=0",
   friends:"r.status='accepted' AND r.low_blocked=0 AND r.high_blocked=0",
   blocked:'((r.low_user_id=? AND r.low_blocked=1) OR (r.high_user_id=? AND r.high_blocked=1))'
  },result={truncated:{}};
  for(const [kind,condition] of Object.entries(conditions)){
   const extra=['incoming','outgoing'].includes(kind)?[actor,new Date(Date.parse(now())-REQUEST_LIFETIME).toISOString()]:kind==='blocked'?[actor,actor]:[];
   const rows=await all(`SELECT r.*,u.id,u.eco_id,u.display_name FROM people_friendships r JOIN users u ON u.id=CASE WHEN r.low_user_id=? THEN r.high_user_id ELSE r.low_user_id END WHERE (r.low_user_id=? OR r.high_user_id=?) AND u.status='active' AND ${condition} ORDER BY r.updated_at DESC,r.low_user_id,r.high_user_id LIMIT 51`,actor,actor,actor,...extra);
   result.truncated[kind]=rows.length>50;
   result[kind]=rows.slice(0,50).map(row=>({id:row.id,eco_id:row.eco_id,display_name:row.display_name,...view(row,actor)}));
  }
  return result;
 }
 return {get,act,list};
}
