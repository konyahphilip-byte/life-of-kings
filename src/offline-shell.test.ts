import {describe,expect,it,vi} from 'vitest';
import {retireUnsafeShell} from './offline-shell';

describe('retiring the pre-safety offline shell',()=>{
 it('removes only the known legacy cache, before startup proceeds',async()=>{
  let finish!:(value:boolean)=>void;
  const deletion=new Promise<boolean>(resolve=>{finish=resolve;});
  const storage={delete:vi.fn(()=>deletion)};
  let started=false;
  const startup=retireUnsafeShell(storage).then(()=>{started=true;});
  await Promise.resolve();expect(started).toBe(false);
  expect(storage.delete).toHaveBeenCalledExactlyOnceWith('ecovibes-shell-v2');
  finish(true);await startup;expect(started).toBe(true);
 });
 it('allows startup when the unsafe cache was already absent',async()=>{
  await expect(retireUnsafeShell({delete:vi.fn(async()=>false)})).resolves.toBeUndefined();
 });
 it('does not authorize startup if cache access fails',async()=>{
  await expect(retireUnsafeShell({delete:vi.fn(async()=>{throw new Error('restricted');})})).rejects.toThrow();
 });
 it('does not require cache support on browsers without an offline worker cache',async()=>{
  await expect(retireUnsafeShell(undefined)).resolves.toBeUndefined();
 });
});
