const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION='20261027070000_connect_direct_messages';
export const DIRECT_MESSAGES_VERSION=VERSION;
export const DIRECT_MESSAGE_RECEIPTS_VERSION='20261028220000_connect_message_receipts';
export const DIRECT_MESSAGES_SQLITE_SCHEMA=`CREATE TABLE IF NOT EXISTS connect_direct_messages(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 low_user_id TEXT NOT NULL,high_user_id TEXT NOT NULL,
 friendship_revision INTEGER NOT NULL CHECK(friendship_revision>=0),
 sender_id TEXT NOT NULL REFERENCES users(id),
 client_id TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL,UNIQUE(sender_id,client_id),
 FOREIGN KEY(low_user_id,high_user_id) REFERENCES people_friendships(low_user_id,high_user_id),
 CHECK(low_user_id<high_user_id),CHECK(sender_id IN (low_user_id,high_user_id)));
 CREATE INDEX IF NOT EXISTS connect_direct_messages_pair ON connect_direct_messages(low_user_id,high_user_id,friendship_revision,sequence DESC);
 CREATE TABLE IF NOT EXISTS connect_direct_message_receipts(message_id TEXT PRIMARY KEY REFERENCES connect_direct_messages(id),recipient_id TEXT NOT NULL REFERENCES users(id),delivered_at TEXT NOT NULL);`;

// Messages remain in the API database, outside AI context and public discovery.
// Every read/retry/write rechecks current consent. Re-adding a removed friend
// starts a new revision: it never exposes messages from a previous relationship.
export function createDirectMessages({q,all,run,transaction,assert,now,id,event,notify,rateLimit,postgresMode,available=true,receiptsAvailable=true}){
 const message=row=>({id:row.id,sequence:String(row.sequence),senderId:row.sender_id,body:row.body,createdAt:row.created_at,deliveredAt:row.delivered_at||null});
 const storedMessage=async row=>message({...row,...(receiptsAvailable?await q('SELECT delivered_at FROM connect_direct_message_receipts WHERE message_id=?',row.id):{})});
 async function authorize(actor,target){
  assert(UUID.test(actor)&&UUID.test(target)&&actor!==target,404,'conversation_unavailable','This conversation is unavailable.');
  const [low,high]=[actor,target].sort();
  // Same stable account -> relationship lock order as friendship mutations.
  for(const userId of [low,high])assert((await run("UPDATE users SET id=id WHERE id=? AND status='active'",userId)).changes===1,404,'conversation_unavailable','This conversation is unavailable.');
  const relation=await q(`SELECT * FROM people_friendships WHERE low_user_id=? AND high_user_id=?${postgresMode?' FOR UPDATE':''}`,low,high);
  assert(relation?.status==='accepted'&&Number(relation.low_blocked)===0&&Number(relation.high_blocked)===0,404,'conversation_unavailable','This conversation is unavailable.');
  return {low,high,revision:Number(relation.revision)};
 }
 async function list(actor,ecoId){
  const rows=await all(`SELECT u.id,u.eco_id,u.display_name,r.revision FROM people_friendships r JOIN users u ON u.id=CASE WHEN r.low_user_id=? THEN r.high_user_id ELSE r.low_user_id END JOIN users me ON me.id=? AND me.status='active' WHERE (r.low_user_id=? OR r.high_user_id=?) AND r.status='accepted' AND r.low_blocked=0 AND r.high_blocked=0 AND u.status='active' ${ecoId?'AND lower(u.eco_id)=?':''} ORDER BY r.updated_at DESC,r.low_user_id,r.high_user_id LIMIT 51`,actor,actor,actor,actor,...(ecoId?[ecoId]:[]));
  return {ownerId:actor,friends:rows.slice(0,50).map(row=>({id:row.id,eco_id:row.eco_id,display_name:row.display_name,revision:Number(row.revision)})),truncated:rows.length>50};
 }
 async function read(actor,target,query){
  const before=query.get('before');
  assert(query.size===(before===null?0:1)&&[...query.keys()].every(key=>key==='before')&&(before===null||/^[1-9][0-9]{0,15}$/.test(before)&&Number.isSafeInteger(Number(before))),400,'invalid_message_query','Use the conversation controls to load messages.');
  return transaction(async()=>{
   const {low,high,revision}=await authorize(actor,target);
   const rows=await all(`SELECT m.id,m.sequence,m.sender_id,m.body,m.created_at${receiptsAvailable?',r.delivered_at':''} FROM connect_direct_messages m ${receiptsAvailable?'LEFT JOIN connect_direct_message_receipts r ON r.message_id=m.id':''} WHERE m.low_user_id=? AND m.high_user_id=? AND m.friendship_revision=?${before?' AND m.sequence<?':''} ORDER BY m.sequence DESC LIMIT 51`,low,high,revision,...(before?[Number(before)]:[]));
   const messages=rows.slice(0,50).reverse().map(message);
   return {ownerId:actor,revision,messages,receiptsEnabled:receiptsAvailable,hasOlder:rows.length>50,beforeCursor:messages[0]?.sequence||null};
  });
 }
 async function send(actor,target,body){
  assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===3&&Object.keys(body).every(key=>['body','revision','clientId'].includes(key)),400,'invalid_message','Write a message and refresh the conversation.');
  assert(typeof body.body==='string'&&body.body.trim().length>0&&body.body.length<=2000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.body)&&Number.isSafeInteger(body.revision)&&body.revision>=0&&typeof body.clientId==='string'&&UUID.test(body.clientId),400,'invalid_message','Use 1–2,000 characters for your message.');
  await rateLimit(`direct-message-send:${actor}`,20,60_000);
  const text=body.body.trim();
  return transaction(async()=>{
   const {low,high,revision}=await authorize(actor,target);
   assert(body.revision===revision,409,'conversation_changed','This friendship changed. Reopen the conversation.');
   const existing=await q('SELECT * FROM connect_direct_messages WHERE sender_id=? AND client_id=?',actor,body.clientId);
   if(existing){
    assert(existing.low_user_id===low&&existing.high_user_id===high&&Number(existing.friendship_revision)===revision&&existing.body===text,409,'message_retry_changed','This retry belongs to a different message.');
    return {ownerId:actor,message:await storedMessage(existing),revision};
   }
   const messageId=id();
   await run('INSERT INTO connect_direct_messages(id,low_user_id,high_user_id,friendship_revision,sender_id,client_id,body,created_at) VALUES(?,?,?,?,?,?,?,?)',messageId,low,high,revision,actor,body.clientId,text,now());
   // Audit metadata only: no text, phone, private job data or AI input.
   await event(actor,'direct_message',messageId,'DIRECT_MESSAGE_SENT',{recipientId:target});
   await notify(target,'direct_message','New message','You have a new private message.','direct_message',actor);
   return {ownerId:actor,message:await storedMessage(await q('SELECT * FROM connect_direct_messages WHERE id=?',messageId)),revision};
  });
 }
 async function acknowledge(actor,target,body){
  assert(receiptsAvailable,503,'receipts_unavailable','Delivery acknowledgements are unavailable.');
  assert(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length===2&&Object.keys(body).every(k=>['revision','messageIds'].includes(k))&&Number.isSafeInteger(body.revision)&&Array.isArray(body.messageIds)&&body.messageIds.length>0&&body.messageIds.length<=50&&new Set(body.messageIds).size===body.messageIds.length&&body.messageIds.every(v=>typeof v==='string'&&UUID.test(v)),400,'invalid_receipt','Refresh the conversation to acknowledge delivery.');
  return transaction(async()=>{
   const {low,high,revision}=await authorize(actor,target);
   assert(body.revision===revision,409,'conversation_changed','This friendship changed. Reopen the conversation.');
   // Validate every ID before writing any receipt. A sender cannot acknowledge itself.
   for(const messageId of body.messageIds){
    const row=await q('SELECT id FROM connect_direct_messages WHERE id=? AND low_user_id=? AND high_user_id=? AND friendship_revision=? AND sender_id=?',messageId,low,high,revision,target);
    assert(row,404,'message_unavailable','This message is unavailable.');
   }
   for(const messageId of body.messageIds)await run('INSERT INTO connect_direct_message_receipts(message_id,recipient_id,delivered_at) VALUES(?,?,?) ON CONFLICT(message_id) DO NOTHING',messageId,actor,now());
   return {ownerId:actor,revision,acknowledged:body.messageIds};
  });
 }
 async function route(ctx,method,path,body,query){
  if(path!=='/connect/messages'&&!path.startsWith('/connect/messages/'))return;
  assert(ctx.user?.status==='active',401,'sign_in_required','Sign in to message your friends.');
  assert(available,503,'messages_unavailable','Private messaging is not connected yet. Please try later.');
  await rateLimit(`direct-message-read:${ctx.user.id}`,120,60_000);
  if(path==='/connect/messages'&&method==='GET'){
   assert(query.size===0||query.size===1&&query.has('ecoId'),400,'invalid_message_query','Search using one exact public EcoVibes ID.');
   const ecoId=query.has('ecoId')?query.get('ecoId').trim().replace(/^@/,'').toLowerCase():null;
   assert(ecoId===null||/^[a-z0-9._]{3,24}$/.test(ecoId),400,'invalid_message_query','Use the exact EcoVibes ID, with 3–24 letters, numbers, dots or underscores.');
   return list(ctx.user.id,ecoId);
  }
  const receipt=path.match(/^\/connect\/messages\/([0-9a-f-]{36})\/receipts$/i);
  if(receipt&&method==='POST'){
   assert(query.size===0,400,'invalid_message_query','This view does not accept account selectors.');
   return acknowledge(ctx.user.id,receipt[1].toLowerCase(),body);
  }
  const target=path.match(/^\/connect\/messages\/([0-9a-f-]{36})$/i)?.[1]?.toLowerCase();
  if(target&&method==='GET')return read(ctx.user.id,target,query);
  if(target&&method==='POST'){
   assert(query.size===0,400,'invalid_message_query','This view does not accept account selectors.');
   return send(ctx.user.id,target,body);
  }
  assert(false,404,'not_found','Conversation not found.');
 }
 return {route};
}
