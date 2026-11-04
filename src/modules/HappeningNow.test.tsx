import '@testing-library/jest-dom/vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import HappeningNow from './HappeningNow';
let visible=true,connected=true;
const section=(id:string,title?:string)=>{
 const now=new Date().toISOString();
 return {id,source:id==='searches'?'Google Trends':'Apple Music',label:id==='searches'?'Trending searches in Ghana':'Apple Music Ghana Top Songs',sourceUrl:id==='searches'?'https://trends.google.com/trending?geo=GH':'https://rss.marketingtools.apple.com/api/v2/gh/music/most-played/10/songs.json',status:'available',checkedAt:now,updatedAt:now,expiresAt:new Date(Date.now()+600000).toISOString(),copyright:id==='music'?'Copyright © 2026 Apple Inc. All rights reserved.':'',items:[{title:title||(id==='searches'?'Ghana topic':'Ghana song'),subtitle:id==='music'?'Artist':'',url:id==='searches'?'https://trends.google.com/trends/explore?geo=GH&q=topic':'https://music.apple.com/gh/album/song/123?i=456',date:now}]};
};
const payload=()=>({asOf:new Date().toISOString(),sections:[section('searches'),section('music')]});
const flush=async(ms=0)=>{await act(async()=>{await vi.advanceTimersByTimeAsync(ms);});};
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));visible=true;connected=true;
 vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visible?'visible':'hidden');
 vi.spyOn(navigator,'onLine','get').mockImplementation(()=>connected);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(payload())));
});
afterEach(()=>{cleanup();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('loads on opening Home with attributed sources and no invented activity counts',async()=>{
 render(<HappeningNow/>);await flush();expect(fetch).toHaveBeenCalledOnce();expect(screen.getByText('Ghana topic')).toBeTruthy();expect(screen.getByText('Ghana song')).toBeTruthy();expect(screen.getByText('Artist')).toBeTruthy();expect(screen.queryByText(/2.4k|840 playing|3 days left/)).toBeNull();expect(vi.mocked(fetch).mock.calls[0][1]?.credentials).toBe('omit');expect(screen.getByText(/Updates automatically/)).toBeTruthy();
});
it('refreshes automatically at cache expiry without overlapping requests',async()=>{
 render(<HappeningNow/>);await flush();await flush(599999);expect(fetch).toHaveBeenCalledOnce();
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({...payload(),sections:[section('searches','Updated Ghana topic'),section('music')]}));await flush(1);expect(fetch).toHaveBeenCalledTimes(2);expect(screen.getByText('Updated Ghana topic')).toBeTruthy();
});
it('pauses while hidden or offline and catches up on return',async()=>{
 render(<HappeningNow/>);await flush();visible=false;fireEvent(document,new Event('visibilitychange'));await flush(600000);expect(fetch).toHaveBeenCalledOnce();
 visible=true;fireEvent(document,new Event('visibilitychange'));await flush();expect(fetch).toHaveBeenCalledTimes(2);
 connected=false;fireEvent(window,new Event('offline'));await flush(600000);expect(fetch).toHaveBeenCalledTimes(2);expect(screen.getByText(/You’re offline/)).toBeTruthy();
 connected=true;fireEvent(window,new Event('online'));await flush();expect(fetch).toHaveBeenCalledTimes(3);
});
it('backs off failed requests instead of polling continuously',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('offline',{status:503})));render(<HappeningNow/>);await flush();expect(screen.getByRole('status')).toHaveTextContent('Could not check');expect(fetch).toHaveBeenCalledOnce();
 await flush(59999);expect(fetch).toHaveBeenCalledOnce();await flush(1);expect(fetch).toHaveBeenCalledTimes(2);await flush(119999);expect(fetch).toHaveBeenCalledTimes(2);await flush(1);expect(fetch).toHaveBeenCalledTimes(3);
});
it('waits for connectivity on an offline initial visit',async()=>{
 connected=false;render(<HappeningNow/>);await flush();expect(fetch).not.toHaveBeenCalled();expect(screen.getByText(/You’re offline/)).toBeTruthy();
 connected=true;fireEvent(window,new Event('online'));await flush();expect(fetch).toHaveBeenCalledOnce();expect(screen.getByText('Ghana topic')).toBeTruthy();
});
it('ignores an aborted late response and leaves only one request active after resuming',async()=>{
 let resolve!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(r=>{resolve=r;})));
 const view=render(<HappeningNow/>);await flush();const signal=vi.mocked(fetch).mock.calls[0][1]?.signal;
 visible=false;fireEvent(document,new Event('visibilitychange'));expect(signal?.aborted).toBe(true);
 await act(async()=>{resolve(Response.json(payload()));});expect(screen.queryByText('Ghana topic')).toBeNull();
 visible=true;vi.mocked(fetch).mockResolvedValueOnce(Response.json(payload()));fireEvent(document,new Event('visibilitychange'));await flush();expect(fetch).toHaveBeenCalledTimes(2);expect(screen.getByText('Ghana topic')).toBeTruthy();
 view.unmount();expect(vi.getTimerCount()).toBe(0);
});
it('retains fresh records on temporary failure and labels expired records without displaying them as current',async()=>{
 render(<HappeningNow/>);await flush();vi.mocked(fetch).mockResolvedValue(new Response('offline',{status:503}));fireEvent.click(screen.getByRole('button',{name:'Refresh now'}));await flush();expect(screen.getByText('Ghana topic')).toBeTruthy();
 connected=false;fireEvent(window,new Event('offline'));await flush(600000);expect(screen.queryByText('Ghana topic')).toBeNull();expect(screen.getAllByText(/needs a fresh update/).length).toBe(2);
});
it('rejects forged source data and labels entry versus chart timestamps',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({...payload(),sections:[{...section('searches'),source:'X'},section('music')]}));render(<HappeningNow/>);await flush();expect(screen.getByRole('status')).toHaveTextContent('Could not check');await flush(60000);expect(screen.getByText(/Latest source entry/)).toBeTruthy();expect(screen.getByText(/Chart updated/)).toBeTruthy();
});
it('enforces a minimum refresh gap for near-expiry responses',async()=>{
 vi.mocked(fetch).mockImplementation(async()=>Response.json({...payload(),sections:[{...section('searches'),expiresAt:new Date(Date.now()+1000).toISOString()},section('music')]}));
 render(<HappeningNow/>);await flush();await flush(29999);expect(fetch).toHaveBeenCalledOnce();await flush(1);expect(fetch).toHaveBeenCalledTimes(2);
});

const news=(id:string)=>{const now=new Date().toISOString();return {id,source:id==='ghana-news'?'Google Trends':'UN Geneva',label:id==='ghana-news'?'News behind Ghana’s searches':'UN world briefings',sourceUrl:id==='ghana-news'?'https://trends.google.com/trending?geo=GH':'https://www.ungeneva.org/en/news-media/press-items-list/rss.xml',status:'available',checkedAt:now,expiresAt:new Date(Date.now()+300000).toISOString(),updatedAt:now,items:[{title:id==='ghana-news'?'Ghana related headline':'World briefing headline',url:id==='ghana-news'?'https://myjoyonline.com/synthetic-news':'https://www.ungeneva.org/en/news-media/press-briefing/2026/10/synthetic',publisher:id==='ghana-news'?'MyJoyOnline':'UN Geneva',date:now,dateKind:id==='ghana-news'?'trend':'published'}]};};
it('separates trends/music/news and links attributed publishers without an extra filter fetch',async()=>{
 vi.mocked(fetch).mockImplementation(async()=>Response.json({...payload(),news:[news('ghana-news'),news('world-news')]}));render(<HappeningNow/>);await flush();fireEvent.click(screen.getByRole('button',{name:'News'}));expect(screen.queryByText('Ghana topic')).toBeNull();expect(screen.getByRole('link',{name:'Ghana related headline'})).toHaveAttribute('href','https://myjoyonline.com/synthetic-news');expect(screen.getByText('MyJoyOnline')).toBeTruthy();expect(screen.getByText(/Trend date/)).toBeTruthy();expect(screen.getByText(/Published/)).toBeTruthy();expect(fetch).toHaveBeenCalledOnce();
});
it('schedules automatic updates from the earliest news expiry and isolates malformed news from other sources',async()=>{
 vi.mocked(fetch).mockImplementation(async()=>Response.json({...payload(),news:[news('ghana-news'),news('world-news')]}));render(<HappeningNow/>);await flush();await flush(300000);expect(fetch).toHaveBeenCalledTimes(2);expect(screen.getByText('World briefing headline')).toBeTruthy();
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({...payload(),news:[{...news('ghana-news'),source:'Fake verified news'},news('world-news')]}));fireEvent.click(screen.getByRole('button',{name:'Refresh now'}));await flush();expect(screen.getByText('Ghana topic')).toBeTruthy();expect(screen.queryByText('World briefing headline')).toBeNull();expect(screen.getByText(/News sources could not be checked/)).toBeTruthy();
});

it('aborts a stalled request after twelve seconds then backs off before retrying',async()=>{
 vi.stubGlobal('fetch',vi.fn((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))));
 render(<HappeningNow/>);await flush(11999);expect(fetch).toHaveBeenCalledOnce();expect(screen.getByRole('button',{name:'Updating…'})).toBeDisabled();await flush(1);expect(screen.getByRole('status')).toHaveTextContent('Could not check');await flush(59999);expect(fetch).toHaveBeenCalledOnce();await flush(1);expect(fetch).toHaveBeenCalledTimes(2);
});
