// Dedicated Linux host only. Generation never contacts a provider or reads keys.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isIPv4} from 'node:net';
export const MEDIA_IMAGES=Object.freeze({
 livekit:'livekit/livekit-server:v1.13.11@sha256:25cd902de7cacbd5f1f779f6a6ac1eae20ba8f56b0935934ce6b0ab80d1e3d20',
 caddy:'livekit/caddyl4:v2.11.3@sha256:9dd090159a6042a907dbff0ce9dda27a21d2a559dc7b03b60a8e6b1b60b8348e',
 redis:'redis:8.4.0-alpine@sha256:4eec4565e45aa0b3966554c866bc73211e281b0b3d89fe9a33c982e6faca809d',
});
const encode=value=>JSON.stringify(value,null,2)+'\n';
function check(value,message){if(!value)throw new Error(message);}
const hostname=value=>typeof value==='string'&&value.length<=253&&/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
function publicIP(value){
 if(typeof value!=='string'||!isIPv4(value))return false;
 const [a,b]=value.split('.').map(Number);
 return a!==0&&a!==10&&a!==127&&a<224&&!(a===169&&b===254)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&b===168)&&!(a===100&&b>=64&&b<=127);
}
export function buildMediaDeployment(options,clock=new Date()){
 check(options&&typeof options==='object'&&!Array.isArray(options),'A reviewed configuration is required.');
 const keys=['signalHost','turnHost','publicIPv4','adminCIDR','expiresAt'];
 check(Object.keys(options).length===keys.length&&Object.keys(options).every(k=>keys.includes(k)),'Only public host, network and expiry settings are accepted; never pass keys.');
 const {signalHost,turnHost,publicIPv4,adminCIDR,expiresAt}=options;
 check(hostname(signalHost)&&hostname(turnHost)&&signalHost!==turnHost,'Use distinct lowercase DNS names without URLs or paths.');
 check(publicIP(publicIPv4),'A public IPv4 address is required.');
 check(typeof adminCIDR==='string'&&adminCIDR.endsWith('/32')&&publicIP(adminCIDR.slice(0,-3)),'Restrict SSH to one approved public IPv4 /32.');
 const expiry=Date.parse(expiresAt),stamp=clock.getTime();
 check(typeof expiresAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(expiresAt)&&Number.isFinite(expiry)&&new Date(expiry).toISOString()===expiresAt.replace('Z','.000Z')&&expiry>stamp&&expiry-stamp<=31*86400_000,'Choose a valid future UTC pilot expiry within 31 days.');
 const livekit={port:7880,bind_addresses:['127.0.0.1'],key_file:'/run/ecovibes/livekit-keys.yaml',
  rtc:{tcp_port:7881,port_range_start:50000,port_range_end:60000,use_external_ip:false,node_ip:publicIPv4},
  redis:{address:'127.0.0.1:6379'},logging:{level:'warn',pion_level:'error',json:true},
  room:{auto_create:false,max_participants:2,empty_timeout:60,departure_timeout:20,enable_remote_unmute:false,enabled_codecs:[{mime:'audio/opus'},{mime:'video/vp8'},{mime:'video/h264'}]},
  turn:{enabled:true,domain:turnHost,external_tls:true,tls_port:5349,udp_port:3478,proxy_protocol:true,proxy_protocol_trusted_cidrs:['127.0.0.1/32'],ttl_seconds:60,per_user_relay_allocation_limit:4},
  limit:{num_tracks:24,bytes_per_sec:2500000,subscription_limit_audio:1,subscription_limit_video:1,max_metadata_size:1024,max_attributes_size:1024,max_room_name_length:80,max_participant_identity_length:80},
 };
 // external_tls advertises TURN/TLS :443 while listening behind Caddy on :5349.
 const caddy={admin:{disabled:true},logging:{logs:{default:{level:'WARN'}}},storage:{module:'file_system',root:'/data'},apps:{tls:{certificates:{automate:[signalHost,turnHost]}},layer4:{servers:{main:{listen:[':443'],routes:[
  {match:[{tls:{sni:[turnHost]}}],handle:[{handler:'tls'},{handler:'proxy',proxy_protocol:'v2',upstreams:[{dial:['127.0.0.1:5349']}]}]},
  {match:[{tls:{sni:[signalHost]}}],handle:[{handler:'tls',connection_policies:[{alpn:['http/1.1']}]},{handler:'proxy',upstreams:[{dial:['127.0.0.1:7880']}]}]},
 ]}}}}};
 // Only systemd may restart the stack, after the expiry preflight. Docker's
 // automatic reboot policy would otherwise bypass the stopped pilot deadline.
 const common={restart:'no',network_mode:'host',security_opt:['no-new-privileges:true'],logging:{driver:'local',options:{'max-size':'10m','max-file':'3'}}};
 const compose={name:'ecovibes-owned-media',services:{
  caddy:{...common,image:MEDIA_IMAGES.caddy,command:['run','--config','/etc/caddy.json'],mem_limit:'256m',volumes:['./caddy.json:/etc/caddy.json:ro','caddy-data:/data']},
  livekit:{...common,image:MEDIA_IMAGES.livekit,command:['--config','/etc/livekit.yaml'],mem_limit:'4g',read_only:true,volumes:['./livekit.yaml:/etc/livekit.yaml:ro','/etc/ecovibes-media/livekit-keys.yaml:/run/ecovibes/livekit-keys.yaml:ro'],depends_on:{redis:{condition:'service_healthy'}}},
  redis:{...common,image:MEDIA_IMAGES.redis,command:['redis-server','/etc/redis.conf'],mem_limit:'256m',volumes:['./redis.conf:/etc/redis.conf:ro','redis-data:/data'],healthcheck:{test:['CMD','redis-cli','-h','127.0.0.1','ping'],interval:'5s',timeout:'3s',retries:10}},
 },volumes:{'caddy-data':{},'redis-data':{}}};
 const calendar=expiresAt.replace('T',' ').replace('Z',' UTC');
 return{
  'livekit.yaml':encode(livekit),'caddy.json':encode(caddy),'compose.yaml':encode(compose),
  'redis.conf':'bind 127.0.0.1\nprotected-mode yes\nport 6379\ndir /data\nappendonly yes\nappendfsync everysec\nmaxmemory 128mb\nmaxmemory-policy noeviction\nloglevel warning\n',
  'firewall.nft':`# Dedicated host only. Review and preserve provider console recovery before applying.\n# Does not flush or replace other tables.\ntable inet ecovibes_media {\n chain input {\n  type filter hook input priority 0; policy drop;\n  ct state established,related accept\n  iifname "lo" accept\n  ct state invalid drop\n  ip protocol icmp accept\n  meta l4proto ipv6-icmp accept\n  ip saddr ${adminCIDR} tcp dport 22 accept\n  tcp dport { 80, 443, 7881 } accept\n  udp dport 3478 accept\n  udp dport 50000-60000 accept\n }\n}\n`,
  'preflight.sh':`#!/bin/sh\nset -eu\n# No key content is read, echoed or passed in arguments.\n[ "$(uname -s)" = Linux ]\n[ "$(date -u +%s)" -lt ${Math.floor(expiry/1000)} ] || { echo 'Pilot expired; media stays stopped.' >&2; exit 1; }\n[ -f /etc/ecovibes-media/livekit-keys.yaml ] && [ ! -L /etc/ecovibes-media/livekit-keys.yaml ]\n[ "$(stat -c %a /etc/ecovibes-media/livekit-keys.yaml)" = 600 ]\n[ "$(stat -c %u /etc/ecovibes-media/livekit-keys.yaml)" = 0 ]\n[ -s /etc/ecovibes-media/livekit-keys.yaml ]\n# A prepared plan is not approval to enable client calling.\n[ -f /etc/ecovibes-media/host-approved ]\ngetent ahostsv4 ${signalHost} | awk '{ print $1 }' | grep -Fxq '${publicIPv4}'\ngetent ahostsv4 ${turnHost} | awk '{ print $1 }' | grep -Fxq '${publicIPv4}'\nnft list table inet ecovibes_media >/dev/null\ndocker compose -f /opt/ecovibes-media/compose.yaml config --quiet\n`,
  'ecovibes-media.service':`[Unit]\nDescription=EcoVibes owned media pilot\nRequires=docker.service\nAfter=docker.service network-online.target\nWants=network-online.target\n[Service]\nType=simple\nWorkingDirectory=/opt/ecovibes-media\nExecStartPre=/opt/ecovibes-media/preflight.sh\nExecStart=/usr/bin/docker compose -f /opt/ecovibes-media/compose.yaml up --no-build --pull never --abort-on-container-failure\nExecStop=/usr/bin/docker compose -f /opt/ecovibes-media/compose.yaml stop\nTimeoutStopSec=60\nRestart=on-failure\nRestartSec=30\n[Install]\nWantedBy=multi-user.target\n`,
  'ecovibes-media-stop.service':'[Unit]\nDescription=Stop EcoVibes media at the pilot deadline\n[Service]\nType=oneshot\nExecStart=/usr/bin/systemctl stop ecovibes-media.service\n',
  'ecovibes-media-stop.timer':`[Unit]\nDescription=EcoVibes media pilot deadline\n[Timer]\nOnCalendar=${calendar}\nPersistent=true\nAccuracySec=1s\nUnit=ecovibes-media-stop.service\n[Install]\nWantedBy=timers.target\n`,
  'public-plan.json':encode({...options,images:MEDIA_IMAGES,clientCallingEnabled:false,recordingEnabled:false,provisioned:false}),
 };
}
export async function writeMediaDeployment(options,target,clock=new Date()){
 const files=buildMediaDeployment(options,clock);
 await mkdir(target,{mode:0o700}); // No recursive/existing-directory overwrite.
 for(const [name,body]of Object.entries(files))await writeFile(resolve(target,name),body,{flag:'wx',mode:name.endsWith('.sh')?0o700:name==='redis.conf'?0o644:0o600});
 return Object.keys(files);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [signalHost,turnHost,publicIPv4,adminCIDR,expiresAt,target,...extra]=process.argv.slice(2);
  check(target&&!extra.length,'Usage: node infra/owned-media/config.mjs SIGNAL_HOST TURN_HOST PUBLIC_IPV4 ADMIN_IPV4/32 EXPIRES_UTC NEW_OUTPUT_DIRECTORY');
  const files=await writeMediaDeployment({signalHost,turnHost,publicIPv4,adminCIDR,expiresAt},resolve(target));
  console.log(JSON.stringify({generated:files,provisioned:false,callingEnabled:false}));
 }catch{console.error('Media plan generation failed. Check public inputs and use a new output directory. No provider or secret was accessed.');process.exitCode=1;}
}
