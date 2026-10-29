// Isolated Linux Docker verification. No provider login, production key or device capture.
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,createHash,createHmac} from 'node:crypto';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import {SignalResponse} from '@livekit/protocol';
import {AccessToken,RoomServiceClient} from 'livekit-server-sdk';
import {buildMediaDeployment,MEDIA_IMAGES} from '../infra/owned-media/config.mjs';
const exec=promisify(execFile),delay=ms=>new Promise(r=>setTimeout(r,ms));
const report={scope:'isolated Linux Docker, synthetic identities, no physical media',checks:[],cachedTokenRejoinDenied:null};
const pass=name=>{report.checks.push(name);console.log('PASS '+name);};
async function docker(args){
 try{return(await exec('docker',args,{timeout:180_000,maxBuffer:2_000_000})).stdout;}
 catch{throw new Error('Docker command failed: '+args[0]+'. Raw output withheld to avoid logging credentials.');}
}
function openSignal(host,ca,token){
 return new Promise((resolve,reject)=>{
  const wsKey=randomBytes(16).toString('base64');let buf=Buffer.alloc(0),upgraded=false,settled=false;
  const socket=tls.connect({host:'127.0.0.1',port:443,servername:host,ca,rejectUnauthorized:true});
  const timer=setTimeout(()=>fail(),7000);
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();reject(Error('Signal admission was rejected or unavailable.'));};
  socket.on('error',fail);
  socket.on('secureConnect',()=>socket.write(`GET /rtc?access_token=${encodeURIComponent(token)}&protocol=16&sdk=js&version=2.22.3&auto_subscribe=0 HTTP/1.1\r\nHost: ${host}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${wsKey}\r\n\r\n`));
  socket.on('data',chunk=>{
   if(settled)return;buf=Buffer.concat([buf,chunk]);if(buf.length>262144)return fail();
   if(!upgraded){const end=buf.indexOf('\r\n\r\n');if(end<0)return;
    const header=buf.subarray(0,end).toString(),expected=createHash('sha1').update(wsKey+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    if(!/^HTTP\/1\.1 101\b/.test(header)||!header.toLowerCase().includes('sec-websocket-accept: '+expected.toLowerCase()))return fail();
    upgraded=true;buf=buf.subarray(end+4);
   }
   while(buf.length>=2){let length=buf[1]&127,offset=2;
    if(length===126){if(buf.length<4)return;length=buf.readUInt16BE(2);offset=4;}
    if(length===127||length>262144)return fail();if(buf.length<offset+length)return;
    const op=buf[0]&15,body=buf.subarray(offset,offset+length);buf=buf.subarray(offset+length);
    if(op===8)return fail();if(op!==2)continue;
    try{const message=SignalResponse.fromBinary(body).message;if(message.case==='join'){settled=true;clearTimeout(timer);resolve({socket,join:message.value});return;}}
    catch{return fail();}
   }
  });
  socket.on('close',()=>{if(!settled)fail();});
 });
}
const attribute=(type,value)=>{const out=Buffer.alloc(4+Math.ceil(value.length/4)*4);out.writeUInt16BE(type);out.writeUInt16BE(value.length,2);value.copy(out,4);return out;};
function stun(type,attrs,key){
 const body=Buffer.concat(attrs),header=Buffer.alloc(20);header.writeUInt16BE(type);header.writeUInt16BE(body.length+(key?24:0),2);header.writeUInt32BE(0x2112a442,4);randomBytes(12).copy(header,8);
 const unsigned=Buffer.concat([header,body]);return key?Buffer.concat([unsigned,attribute(8,createHmac('sha1',key).update(unsigned).digest())]):unsigned;
}
async function verifyTurn(host,ca,credentials){
 const socket=tls.connect({host:'127.0.0.1',port:443,servername:host,ca,rejectUnauthorized:true});
 socket.on('error',()=>{});
 let buf=Buffer.alloc(0);const messages=[],pending=[];
 socket.on('data',chunk=>{buf=Buffer.concat([buf,chunk]);while(buf.length>=20){const end=20+buf.readUInt16BE(2);if(end>262144){socket.destroy();return;}if(buf.length<end)return;const message=buf.subarray(0,end);buf=buf.subarray(end);(pending.shift()||((m)=>messages.push(m)))(message);}});
 const receive=()=>new Promise((resolve,reject)=>{let timer;const callback=m=>{clearTimeout(timer);resolve(m);};if(messages.length)return resolve(messages.shift());pending.push(callback);timer=setTimeout(()=>{const index=pending.indexOf(callback);if(index>=0)pending.splice(index,1);reject(Error('TURN reply unavailable.'));},7000);});
 try{
  await new Promise((resolve,reject)=>{socket.once('secureConnect',resolve);socket.once('error',()=>reject(Error('TURN TLS unavailable.')));});
  const transport=attribute(0x19,Buffer.from([17,0,0,0]));socket.write(stun(3,[transport]));const challenge=await receive();
  assert.equal(challenge.readUInt16BE(0),0x113);const attrs=new Map();
  for(let p=20;p+4<=challenge.length;){const len=challenge.readUInt16BE(p+2);attrs.set(challenge.readUInt16BE(p),challenge.subarray(p+4,p+4+len));p+=4+Math.ceil(len/4)*4;}
  assert.equal(attrs.get(9)?.[2],4);assert.equal(attrs.get(9)?.[3],1);pass('TURN refuses unauthenticated allocation');
  const realm=attrs.get(0x14),nonce=attrs.get(0x15);assert.ok(realm&&nonce);
  const key=createHash('md5').update(credentials.username+':'+realm.toString()+':'+credentials.credential).digest();
  socket.write(stun(3,[transport,attribute(6,Buffer.from(credentials.username)),attribute(0x14,realm),attribute(0x15,nonce)],key));
  const allocated=await receive();assert.equal(allocated.readUInt16BE(0),0x103);pass('TURN accepts a room-issued credential through trusted TLS');
 }finally{socket.destroy();}
}
let directory,composeArgs,phase='Linux runtime';const sockets=[];
try{
 assert.equal(process.platform,'linux','The host-network stack requires Linux.');
 await docker(['info','--format','{{.OSType}}']);
 directory=await mkdtemp(join(tmpdir(),'ecovibes-owned-media-'));
 const clock=new Date(),expiresAt=new Date(clock.getTime()+3600_000).toISOString().replace(/\.\d{3}Z$/,'Z');
 const files=buildMediaDeployment({signalHost:'media.example.org',turnHost:'turn.example.org',publicIPv4:'203.0.113.10',adminCIDR:'198.51.100.7/32',expiresAt},clock);
 const key='ecovibes_synthetic_ci',secret=randomBytes(32).toString('hex');
 const live=JSON.parse(files['livekit.yaml']);live.rtc.node_ip='127.0.0.1';
 const caddy=JSON.parse(files['caddy.json']);caddy.apps.tls.automation={policies:[{issuers:[{module:'internal'}]}]};
 const compose=JSON.parse(files['compose.yaml']);
 compose.name='ecovibes-media-smoke-'+randomBytes(6).toString('hex');
 // Only this disposable fixture uses a throwaway internal CA and key file.
 compose.services.livekit.volumes[1]='./synthetic-keys.yaml:/run/ecovibes/livekit-keys.yaml:ro';
 // Retain project-scoped named data volumes: host PKI directories created by
 // root would be unreadable to the runner during cleanup. compose cp reads CA.
 for(const [name,content]of Object.entries({...files,'compose.yaml':JSON.stringify(compose),'livekit.yaml':JSON.stringify(live),'caddy.json':JSON.stringify(caddy),'synthetic-keys.yaml':JSON.stringify({[key]:secret})}))await writeFile(join(directory,name),content,{mode:name==='redis.conf'?0o644:0o600});
 composeArgs=['compose','-f',join(directory,'compose.yaml')];
 phase='Compose validation';await docker([...composeArgs,'config','--quiet']);pass('Docker Compose accepts the generated stack');
 await docker(['run','--rm','-v',directory+'/caddy.json:/config.json:ro',MEDIA_IMAGES.caddy,'validate','--config','/config.json']);pass('Pinned Caddy validates TLS and PROXY v2 configuration');
 phase='stack startup';await docker([...composeArgs,'up','--detach','--wait','--wait-timeout','60']);
 const api=new RoomServiceClient('http://127.0.0.1:7880',key,secret,{requestTimeout:5});
 let ca;
 phase='local CA and control readiness';
 for(let i=0;i<30;i++){try{await docker([...composeArgs,'cp','caddy:/data/pki/authorities/local/root.crt',join(directory,'root.crt')]);ca=await readFile(join(directory,'root.crt'));await api.listRooms();break;}catch{await delay(1000);}}
 assert.ok(ca,'Internal test CA unavailable.');
 const room='ev-owned-media-smoke';const created=await api.createRoom({name:room,emptyTimeout:60});assert.equal(created.maxParticipants,2);pass('Actual LiveKit applies the generated two-person room default');
 const token=async(identity,target=room,ttl=60)=>{const access=new AccessToken(key,secret,{identity,ttl});access.addGrant({room:target,roomJoin:true,canPublish:false,canPublishData:false,canSubscribe:false});return access.toJwt();};
 phase='TLS signalling';await assert.rejects(openSignal('media.example.org',ca,'invalid'));pass('Trusted TLS signalling rejects invalid admission');
 await assert.rejects(openSignal('media.example.org',ca,await token('outsider','not-created')));pass('A signed token cannot auto-create a missing room');
 const alphaToken=await token('synthetic-alpha');const alpha=await openSignal('media.example.org',ca,alphaToken);sockets.push(alpha.socket);
 const beta=await openSignal('media.example.org',ca,await token('synthetic-beta'));sockets.push(beta.socket);
 const identities=(await api.listParticipants(room)).map(p=>p.identity).sort();assert.deepEqual(identities,['synthetic-alpha','synthetic-beta']);pass('Two synthetic identities join through validated TLS without publishing');
 await assert.rejects(openSignal('media.example.org',ca,await token('third')));pass('The two-person limit rejects a third identity');
 const turn=alpha.join.iceServers.find(s=>s.urls.some(u=>u.startsWith('turns:')));assert.ok(turn);assert.ok(turn.urls.some(u=>u.includes(':443')));pass('TURN TLS advertises port 443');
 phase='TURN relay authentication';await verifyTurn('turn.example.org',ca,turn);
 phase='provider removal and replay';await api.removeParticipant(room,'synthetic-alpha',{revokeTokenTs:BigInt(Math.floor(Date.now()/1000)+1)});
 assert.ok(!(await api.listParticipants(room)).some(p=>p.identity==='synthetic-alpha'));pass('Actual provider removal disconnects the participant');
 // Capability observation, not an assertion that OSS implements Cloud revocation.
 try{const replay=await openSignal('media.example.org',ca,alphaToken);sockets.push(replay.socket);report.cachedTokenRejoinDenied=false;}
 catch{report.cachedTokenRejoinDenied=true;}
 await api.deleteRoom(room);await assert.rejects(openSignal('media.example.org',ca,alphaToken));pass('Deleted rooms stay closed to cached joins');
 report.publicTLSVerified=false;report.physicalMediaVerified=false;report.productionProvisioned=false;
 console.log(JSON.stringify(report));
 if(process.env.OWNED_MEDIA_REPORT)await writeFile(process.env.OWNED_MEDIA_REPORT,JSON.stringify(report,null,2));
}catch{console.error('Owned-media smoke failed at '+phase+'. No credentials or raw server responses were logged.');process.exitCode=1;}
finally{
 for(const socket of sockets)socket.destroy();
 if(composeArgs)try{await docker([...composeArgs,'down','--volumes','--remove-orphans']);}catch{console.error('Isolated Docker cleanup needs attention.');process.exitCode=1;}
 // The path is created by mkdtemp above; never accepts an operator-provided target.
 if(directory)await rm(directory,{recursive:true,force:true});
}
