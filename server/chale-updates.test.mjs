import { describe, expect, it, vi } from 'vitest';
import { createPublicUpdates as createUpdates } from './chale-updates.mjs';
import { chaleUpdateIntent, readPublicUpdates } from '../shared/chale-updates.mjs';

const now=Date.parse('2026-10-26T17:00:00.000Z');
const article=(url='https://gna.org.gh/2026/10/example/',extra={})=>({url,title:'Example publisher headline',seendate:'20261026T163000Z',...extra});
const response=articles=>new Response(JSON.stringify({articles}),{headers:{'Content-Type':'application/json'}});
const createPublicUpdates=options=>createUpdates({waitImpl:async()=>{},...options});
describe('source-separated public updates',()=>{
  it.each(["What's trending?",'What is happening in Ghana today?', 'Latest world news', 'What are the latest EcoVibes updates?'])("recognizes explicit updates: %s",q=>expect(chaleUpdateIntent(q)).not.toBeNull());
  it.each(['What is new in calculus?', 'How does a news camera work?', 'Hi', 'Any tips for a job interview?'])('keeps ordinary questions on the conversation path: %s',q=>expect(chaleUpdateIntent(q)).toBeNull());
  it.each(['What are news headlines?','Give me tips for writing headlines','Tell me what is happening with my order today','What is new in my React app?'])('preserves explanation, advice, account and other-app questions: %s',q=>expect(chaleUpdateIntent(q)).toBeNull());
  it.each([["What's trending in Ghana?",'ghana'],["What's trending around the world?",'world'],['Latest global news','world'],['Latest international news','world']])('selects the requested geographic digest: %s',(q,scope)=>expect(chaleUpdateIntent(q)).toBe(scope));
  it('queries Ghana independently so newer world articles cannot crowd it out',async()=>{
    const fetchImpl=vi.fn(async url=>new URL(url).searchParams.get('query').includes('reuters.com')
      ?response(Array.from({length:100},(_,i)=>article('https://www.reuters.com/world/'+i)))
      :response([article()]));
    const r=await createPublicUpdates({fetchImpl,clock:()=>now})('ghana');
    expect(r.entries.filter(e=>e.kind==='ghana')).toHaveLength(1);
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get('query')).not.toContain('reuters.com');
  });
  it('returns versioned app release records without inference, private data or a news fetch',async()=>{
    const fetchImpl=vi.fn();const get=createPublicUpdates({fetchImpl,clock:()=>now});
    const r=await get('app');expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.entries.every(e=>e.kind==='app')).toBe(true);expect(r.entries.length).toBeGreaterThan(0);
    expect(r.entries[0].url).toMatch(/^https:\/\/github.com\/konyahphilip-byte\/life-of-kings\/pull\/\d+$/);
    expect(r.text).toContain('No verified popularity ranking');expect(r.usage.requests).toBe(0);
  });
  it('uses fixed group queries, separates publisher sources, and labels indexed dates honestly',async()=>{
    const fetchImpl=vi.fn(async url=>response([article(new URL(url).searchParams.get('query').includes('reuters.com')?'https://www.reuters.com/world/example/':'https://gna.org.gh/example/')]));
    const r=await createPublicUpdates({fetchImpl,clock:()=>now})('both');
    expect(fetchImpl).toHaveBeenCalledTimes(2);const [url,options]=fetchImpl.mock.calls[0];
    expect(new URL(url).hostname).toBe('api.gdeltproject.org');expect(options.redirect).toBe('error');expect(options.credentials).toBe('omit');expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(r.entries.filter(e=>e.kind==='ghana')).toHaveLength(1);expect(r.entries.filter(e=>e.kind==='world')).toHaveLength(1);
    expect(r.entries.find(e=>e.kind==='ghana')).toMatchObject({source:'Ghana News Agency',date:'2026-10-26T16:30:00.000Z'});
    expect(r.text).toContain('indexed');expect(r.text).toContain('not a popularity ranking');expect(r.usage.requests).toBe(0);
  });
  it.each([
    article('http://gna.org.gh/unsafe'),article('https://gna.org.gh.evil.example/x'),article('https://user:password@gna.org.gh/x'),
    article('https://gna.org.gh:8443/x'),article('https://127.0.0.1/x'),article('javascript:alert(1)'),
    article(undefined,{seendate:'20261024T000000Z'}),article(undefined,{seendate:'20261027T000000Z'}),
    article(undefined,{seendate:'20260231T163000Z'}),article(undefined,{title:'<script>bad</script>'}),
  ])('rejects unsafe, stale, future or malformed metadata',async entry=>{
    const r=await createPublicUpdates({fetchImpl:async()=>response([entry]),clock:()=>now})('both');
    expect(r.entries.filter(e=>e.kind!=='app')).toEqual([]);expect(r.newsStatus).toBe('empty');
  });
  it('deduplicates and caps each group, shares in-flight reads and caches success',async()=>{
    const waitImpl=vi.fn(async()=>{}),fetchImpl=vi.fn(async()=>response([article(),article(),...Array.from({length:10},(_,i)=>article('https://gna.org.gh/item/'+i))]));const get=createPublicUpdates({fetchImpl,clock:()=>now,waitImpl});
    const [one,two]=await Promise.all([get('both'),get('ghana')]);expect(fetchImpl).toHaveBeenCalledTimes(2);expect(one.entries.filter(e=>e.kind==='ghana')).toHaveLength(4);
    expect(two.entries.every(e=>e.kind==='ghana')).toBe(true);await get('world');expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(waitImpl).toHaveBeenCalledExactlyOnceWith(6000);
  });
  it.each([429,503])('fails honestly and caches a %s without retry or model fallback',async status=>{
    const fetchImpl=vi.fn(async()=>new Response('private-upstream-detail',{status}));const get=createPublicUpdates({fetchImpl,clock:()=>now});
    const r=await get('both');await get('both');expect(fetchImpl).toHaveBeenCalledTimes(2);expect(r.newsStatus).toBe('unavailable');
    expect(r.text).toContain('could not check');expect(JSON.stringify(r)).not.toContain('private-upstream-detail');expect(r.entries.every(e=>e.kind==='app')).toBe(true);
  });
  it('does not serve expired news after a failed refresh',async()=>{
    let time=now;const fetchImpl=vi.fn().mockResolvedValueOnce(response([article()])).mockRejectedValueOnce(Error('offline'));const get=createPublicUpdates({fetchImpl,clock:()=>time});
    await get('both');time+=16*60_000;const r=await get('both');expect(r.newsStatus).toBe('unavailable');expect(r.entries.every(e=>e.kind==='app')).toBe(true);
  });
  it('bounds the response body and never returns injected instructions or HTML as news',async()=>{
    const get=createPublicUpdates({fetchImpl:async()=>new Response('x'.repeat(262145),{headers:{'Content-Type':'application/json'}}),clock:()=>now});
    expect((await get('both')).newsStatus).toBe('unavailable');
  });
  it('client validation rejects forged release records and unsafe news links',()=>{
    expect(readPublicUpdates({entries:[{kind:'app',title:'All payments live',url:'https://evil.example',date:new Date(now).toISOString(),source:'EcoVibes'}]},now)).toEqual([]);
    expect(readPublicUpdates({entries:[{kind:'ghana',title:'Click',url:'javascript:alert(1)',date:new Date(now).toISOString(),source:'Ghana News Agency'}]},now)).toEqual([]);
  });
  it('reports partial coverage separately when only one group is available',async()=>{
    const fetchImpl=vi.fn(async url=>new URL(url).searchParams.get('query').includes('reuters.com')?new Response('offline',{status:503}):response([article()]));
    const r=await createPublicUpdates({fetchImpl,clock:()=>now})('both');
    expect(r.newsStatus).toBe('partial');expect(r.newsStatuses).toEqual({ghana:'available',world:'unavailable'});
    expect(r.text).toContain('World: I could not check current news');expect(r.entries.some(e=>e.kind==='ghana')).toBe(true);
  });
});
