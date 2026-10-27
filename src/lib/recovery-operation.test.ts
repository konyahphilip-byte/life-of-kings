import { describe, expect, it, vi } from 'vitest';
import { createRecoveryOperation } from './recovery-operation';

describe('captured recovery operation', () => {
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
  it('retains the captured authorization after a failed logout without reading shared storage', async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:503})).mockResolvedValueOnce(new Response(null,{status:204}));
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:Math.floor(Date.now()/1000)+3600},fetcher});
    await expect(op.signOut()).rejects.toThrow('sign-out could not be confirmed');
    await op.signOut();expect(fetcher).toHaveBeenCalledTimes(2);op.dispose();
  });
  it('expires and disposes without persisting the operation credential', async()=>{
    let now=1000;
    const fetcher=vi.fn();
    const op=createRecoveryOperation({url:'https://project.example.invalid',publishableKey:'synthetic-public-key',session:{access_token:'synthetic-owner-token',user:{id:'synthetic-owner'},expires_at:3600},fetcher,now:()=>now});
    now+=600001;
    expect(()=>op.authorization()).toThrow('expired');expect(fetcher).not.toHaveBeenCalled();op.dispose();
  });
});
