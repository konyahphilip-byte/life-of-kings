import { describe, expect, it, vi } from 'vitest';
import { createRecoveryOperation } from './recovery-operation';

describe('captured recovery operation', () => {
  it('does not redispatch global sign-out after a lost response',async()=>{
    const fetcher=vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Synthetic acknowledgement lost')).mockResolvedValue(new Response(null,{status:204}));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    try{
      await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
      await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
      expect(fetcher).toHaveBeenCalledOnce();expect(op.signedOut).toBe(false);expect(op.signOutUnconfirmed).toBe(true);
      expect(()=>op.authorization()).toThrow('expired');
    }finally{op.dispose();}
  });
  it('shares one in-flight provider sign-out across overlapping cleanup handlers',async()=>{
    const pending:Array<(response:Response)=>void>=[];
    const fetcher=vi.fn<typeof fetch>(()=>new Promise(resolve=>pending.push(resolve)));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    const results=Promise.allSettled([op.signOut(),op.signOut()]);
    try{
      await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
      for(const resolve of pending)resolve(new Response(null,{status:204}));
      expect((await results).every(result=>result.status==='fulfilled')).toBe(true);
      expect(op.signedOut).toBe(true);await op.signOut();expect(fetcher).toHaveBeenCalledOnce();
    }finally{for(const resolve of pending)resolve(new Response(null,{status:204}));await results;op.dispose();}
  });
  it('shares an in-flight failure and blocks later global retries',async()=>{
    const pending:Array<(response:Response)=>void>=[];
    const fetcher=vi.fn<typeof fetch>(()=>new Promise(resolve=>pending.push(resolve)));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    const results=Promise.allSettled([op.signOut(),op.signOut()]);
    try{
      await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
      for(const resolve of pending)resolve(new Response(null,{status:503}));
      expect((await results).every(result=>result.status==='rejected')).toBe(true);expect(op.signedOut).toBe(false);
      fetcher.mockResolvedValueOnce(new Response(null,{status:204}));await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');expect(fetcher).toHaveBeenCalledOnce();
    }finally{for(const resolve of pending)resolve(new Response(null,{status:503}));await results;op.dispose();}
  });
  it('binds password and logout to the original token despite shared account changes', async () => {
    const session={access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600};
    const fetcher=vi.fn<typeof fetch>(async()=>Response.json({id:'synthetic-owner'}));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session,fetcher});
    const operationId=op.operationId;
    expect(operationId).toMatch(/^[0-9a-f-]{36}$/);
    session.access_token='synthetic-other-token';session.user.id='synthetic-other';
    await op.updatePassword('Synthetic-new-password-123');
    fetcher.mockResolvedValueOnce(new Response(null,{status:204}));
    await op.signOut();
    expect(op.operationId).toBe(operationId);
    for(const [,options] of fetcher.mock.calls){expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer synthetic-owner-token');expect(options?.credentials).toBe('omit');expect(options?.redirect).toBe('error');}
    expect(fetcher.mock.calls.map(([url])=>String(url))).toEqual(['https://project.example.invalid/auth/v1/user','https://project.example.invalid/auth/v1/logout?scope=global']);
    expect(JSON.stringify(op)).not.toContain('token');op.dispose();
  });
  it('disposes the captured authorization after an unconfirmed logout', async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response(null,{status:204}));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
    await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');expect(fetcher).toHaveBeenCalledOnce();expect(()=>op.authorization()).toThrow('expired');expect(op.signOutUnconfirmed).toBe(true);op.dispose();
  });
  it('expires and disposes without persisting the operation credential', async()=>{
    let now=1000;
    const fetcher=vi.fn();
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:3600},fetcher,now:()=>now});
    now+=600001;
    expect(()=>op.authorization()).toThrow('expired');expect(fetcher).not.toHaveBeenCalled();op.dispose();
  });
  it.each([302,401,403,429,500,503])('retains uncertainty without redispatch after HTTP %s',async(status)=>{
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(null,{status}));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    try{
      await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
      await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
      expect(fetcher).toHaveBeenCalledOnce();expect(op.signedOut).toBe(false);expect(op.signOutUnconfirmed).toBe(true);
    }finally{op.dispose();}
  });
});
