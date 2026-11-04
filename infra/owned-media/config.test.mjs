// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {mkdtemp,stat,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildMediaDeployment,writeMediaDeployment} from './config.mjs';
const options={signalHost:'media.example.org',turnHost:'turn.example.org',publicIPv4:'203.0.113.10',adminCIDR:'198.51.100.7/32',expiresAt:'2026-11-01T12:00:00Z'};
const clock=new Date('2026-10-29T12:00:00Z');
describe('EcoVibes owned media deployment',()=>{
 it('rejects an impossible calendar deadline instead of generating an invalid stop timer',()=>{
  expect(()=>buildMediaDeployment({...options,expiresAt:'2026-11-31T12:00:00Z'},new Date('2026-11-02T12:00:00Z'))).toThrow();
 });
 it('lets the nonroot Redis process read only its nonsecret configuration and refuses overwrite',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ecovibes-plan-test-')),target=join(dir,'generated');
  try{await writeMediaDeployment(options,target,clock);
   expect((await stat(join(target,'redis.conf'))).mode&0o777).toBe(0o644);
   expect((await stat(join(target,'livekit.yaml'))).mode&0o777).toBe(0o600);
   expect((await stat(join(target,'preflight.sh'))).mode&0o777).toBe(0o700);
   await expect(writeMediaDeployment(options,target,clock)).rejects.toThrow();
   expect(JSON.parse(await readFile(join(target,'livekit.yaml'),'utf8')).key_file).toBe('/run/ecovibes/livekit-keys.yaml');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('creates a two-person, explicitly created room server without credentials or recording',()=>{
  const files=buildMediaDeployment(options,clock);const live=JSON.parse(files['livekit.yaml']);
  expect(live.room).toMatchObject({auto_create:false,max_participants:2,enable_remote_unmute:false});
  expect(live.key_file).toBe('/run/ecovibes/livekit-keys.yaml');expect(live.keys).toBeUndefined();
  expect(live).not.toHaveProperty('egress');expect(live).not.toHaveProperty('ingress');expect(live).not.toHaveProperty('webhook');
 });
 it('routes distinct trusted TLS names through Caddy and preserves TURN client addresses',()=>{
  const files=buildMediaDeployment(options,clock),caddy=JSON.parse(files['caddy.json']),live=JSON.parse(files['livekit.yaml']);
  const routes=caddy.apps.layer4.servers.main.routes;
  expect(caddy.admin.disabled).toBe(true);expect(caddy.apps.tls.certificates.automate).toEqual([options.signalHost,options.turnHost]);
  expect(routes[0].match[0].tls.sni).toEqual([options.turnHost]);expect(routes[0].handle[1]).toMatchObject({handler:'proxy',proxy_protocol:'v2',upstreams:[{dial:['127.0.0.1:5349']}]});
  expect(routes[1].handle[1].upstreams[0].dial).toEqual(['127.0.0.1:7880']);
  expect(live.turn).toMatchObject({enabled:true,external_tls:true,domain:options.turnHost,tls_port:5349,proxy_protocol:true,proxy_protocol_trusted_cidrs:['127.0.0.1/32']});
 });
 it('pins every image and never exposes Redis, cleartext control or metrics in the firewall',()=>{
  const files=buildMediaDeployment(options,clock),compose=JSON.parse(files['compose.yaml']);
  expect(Object.keys(compose.services).sort()).toEqual(['caddy','livekit','redis']);
  for(const service of Object.values(compose.services)){expect(service.image).toMatch(/@sha256:[a-f0-9]{64}$/);expect(service.network_mode).toBe('host');expect(service.restart).toBe('no');expect(service.logging.options['max-size']).toBe('10m');expect(service).not.toHaveProperty('ports');}
  expect(files['redis.conf']).toContain('bind 127.0.0.1');
  expect(files['firewall.nft']).toContain('policy drop');expect(files['firewall.nft']).toContain('ip saddr 198.51.100.7/32 tcp dport 22 accept');
  expect(files['firewall.nft']).not.toMatch(/dport.*(6379|7880|5349|6789).*accept/);
 });
 it('includes an expiry which also refuses later starts, without deleting data',()=>{
  const files=buildMediaDeployment(options,clock);
  expect(files['ecovibes-media-stop.timer']).toContain('2026-11-01 12:00:00 UTC');
  expect(files['preflight.sh']).toContain('date -u +%s');expect(files['preflight.sh']).toContain('stat');
  expect(files['ecovibes-media.service']).toContain('ExecStartPre=/opt/ecovibes-media/preflight.sh');
  expect(files['ecovibes-media-stop.service']).toContain('systemctl stop ecovibes-media.service');
  expect(JSON.stringify(files)).not.toMatch(/down --volumes|docker system prune|livekit\.cloud|devkey/);
 });
 it.each([
  {signalHost:'http://example.org'}, {turnHost:'media.example.org'}, {signalHost:'localhost'},
  {signalHost:'media.example.org\nadmin: true'}, {publicIPv4:'127.0.0.1'}, {publicIPv4:'10.0.0.1'},
  {adminCIDR:'0.0.0.0/0'}, {adminCIDR:'198.51.100.7/24'}, {expiresAt:'2026-10-28T00:00:00Z'},
  {expiresAt:'2027-10-29T00:00:00Z'}, {apiSecret:'must-not-accept-secrets'},
 ])('rejects unsafe or unreviewed configuration %j',patch=>{
  expect(()=>buildMediaDeployment({...options,...patch},clock)).toThrow();
 });
});
