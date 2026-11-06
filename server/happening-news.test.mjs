import {describe,it,expect,vi} from 'vitest';
import {createWorldBriefings,relatedGhanaNews} from './happening-news.mjs';
import {readHeadlines} from '../shared/happening-news.mjs';
const now=Date.parse('2026-10-30T12:00:00Z');
const item=(title='A public briefing',url='https://www.ungeneva.org/en/news-media/press-briefing/2026/10/briefing',date='Fri, 30 Oct 2026 12:00:00 CET')=>'<item><title>'+title+'</title><link>'+url+'</link><pubDate>'+date+'</pubDate></item>';
const rss=(items=item())=>'<?xml version="1.0"?><rss><channel><title>Press Items</title><link>https://www.ungeneva.org/en</link>'+items+'</channel></rss>';
const response=(text=rss())=>new Response(text,{headers:{'Content-Type':'application/rss+xml'}});
const ghanaXml=(url='https://myjoyonline.com/a-story',title='Publisher headline')=>'<rss><channel><item><title>Ghana trend</title><pubDate>Fri, 30 Oct 2026 11:00:00 +0000</pubDate><ht:news_item><ht:news_item_title>'+title+'</ht:news_item_title><ht:news_item_url>'+url+'</ht:news_item_url><ht:news_item_source>Forged publisher</ht:news_item_source></ht:news_item></item></channel></rss>';
describe('source-labelled public headlines',()=>{
 it('reads only fixed UN Geneva RSS without private input and parses CET as UTC',async()=>{const fetchImpl=vi.fn(async()=>response());const result=await createWorldBriefings({fetchImpl,clock:()=>now})();expect(fetchImpl).toHaveBeenCalledExactlyOnceWith('https://www.ungeneva.org/en/news-media/press-items-list/rss.xml',expect.objectContaining({credentials:'omit',redirect:'error'}));expect(result.status).toBe('available');expect(result.items[0]).toMatchObject({publisher:'UN Geneva',date:'2026-10-30T11:00:00.000Z',dateKind:'published'});expect(JSON.stringify(result)).not.toContain('description');});
 it('shares in-flight work and caches success and failure without repeated upstream polling',async()=>{const fetchImpl=vi.fn(async()=>response());const get=createWorldBriefings({fetchImpl,clock:()=>now});await Promise.all([get(),get()]);await get();expect(fetchImpl).toHaveBeenCalledOnce();});
 it.each([rss(item('%AutoEntityLabel: placeholder%')),rss(item('Old',undefined,'Fri, 16 Oct 2026 12:00:00 CET')),rss(item('Future',undefined,'Sat, 31 Oct 2026 12:00:00 CET')),rss(item('Bad date',undefined,'Tue, 31 Feb 2026 12:00:00 CET')),rss(item('Unsafe','https://ungeneva.org.evil.example/en/news-media/fake')),rss(item('&lt;script&gt;bad&lt;/script&gt;')),rss('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>'+item()),'x'.repeat(262145)])('rejects unsafe, placeholder, stale and oversized news',async text=>{const r=await createWorldBriefings({fetchImpl:async()=>response(text),clock:()=>now})();expect(r.items).toEqual([]);});
 it('retains only safe publisher links related to Ghana search interest and labels trend date honestly',()=>{const r=relatedGhanaNews(ghanaXml(),now,now+600000);expect(r.items[0]).toMatchObject({title:'Publisher headline',publisher:'MyJoyOnline',dateKind:'trend'});expect(r.label).toBe('News behind Ghana’s searches');expect(JSON.stringify(r)).not.toContain('Forged publisher');});
 it.each(['http://myjoyonline.com/x','https://myjoyonline.com.evil.example/x','https://private.invalid/x','javascript:alert(1)'])('rejects unsafe/unapproved Ghana links: %s',url=>{expect(relatedGhanaNews(ghanaXml(url),now,now+600000).items).toEqual([]);});
 it('validates all source identities and does not treat news titles as independently checked facts',async()=>{const world=await createWorldBriefings({fetchImpl:async()=>response(),clock:()=>now})();const ghana=relatedGhanaNews(ghanaXml(),now,now+600000);expect(readHeadlines([ghana,world],now)).toHaveLength(2);expect(readHeadlines([{...ghana,source:'Verified by EcoVibes'},world],now)).toBeNull();expect(readHeadlines([ghana,{...world,items:[{...world.items[0],url:'https://evil.example'}]}],now)).toBeNull();});
 it('supports deny-only disable without an external request',async()=>{const fetchImpl=vi.fn();const get=createWorldBriefings({fetchImpl,clock:()=>now,disabled:()=>true});expect((await get()).status).toBe('disabled');expect(fetchImpl).not.toHaveBeenCalled();});
 it('deduplicates/caps feeds and evaluates freshness after the request completes',async()=>{let time=now;const get=createWorldBriefings({fetchImpl:async()=>{time+=2000;return response(rss(item('Near expiry',undefined,'Fri, 23 Oct 2026 14:00:01 CEST')));},clock:()=>time});expect((await get()).items).toEqual([]);});
});
it('requires source update metadata to match its items and no dates for unavailable sections',async()=>{
 const world=await createWorldBriefings({fetchImpl:async()=>response(),clock:()=>now})();const ghana=relatedGhanaNews(ghanaXml(),now,now+600000);
 expect(readHeadlines([ghana,{...world,updatedAt:new Date(now).toISOString()}],now)).toBeNull();
 expect(readHeadlines([ghana,{...world,status:'unavailable',items:[]}],now)).toBeNull();
});
it('deduplicates and caps source records and caches failure for five minutes',async()=>{
 let time=now;const entries=item()+item()+Array.from({length:7},(_,i)=>item('Headline '+i,'https://www.ungeneva.org/en/news-media/briefing/'+i)).join('');
 const good=await createWorldBriefings({fetchImpl:async()=>response(rss(entries)),clock:()=>time})();expect(good.items).toHaveLength(4);expect(new Set(good.items.map(i=>i.url)).size).toBe(4);
 const fetchImpl=vi.fn(async()=>new Response('upstream detail',{status:503}));const get=createWorldBriefings({fetchImpl,clock:()=>time});await get();time+=299999;await get();expect(fetchImpl).toHaveBeenCalledOnce();time+=1;await get();expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it.each(['2026-11-31T12:00:00Z','Fri, 30 Oct 2026 25:00:00 CET','Fri, 30 Oct 2026 12:00:00 XYZ'])('rejects malformed or unsupported RSS dates: %s',async date=>{
 const r=await createWorldBriefings({fetchImpl:async()=>response(rss(item('Malformed date',undefined,date))),clock:()=>Date.parse('2026-12-01T14:00:00Z')})();expect(r.items).toEqual([]);
});
it.each(['https://__proto__/x','https://constructor/x','https://tostring/x'])('rejects inherited publisher-map keys: %s',url=>{expect(relatedGhanaNews(ghanaXml(url),now,now+600000).items).toEqual([]);});
