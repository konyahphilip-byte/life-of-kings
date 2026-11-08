import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import GamesHub from './GamesHub';
const rumble={id:'rumble-rush',title:'Rumble Rush: Fusion Edition',category:'Racing',status:'development',summary:'Accra Skyway racing',milestone:'M1 driving',target:'Browser target',controls:'Keyboard target',playable:false,releaseVersion:null,downloadBytes:null,notice:'Not released yet.'};
const word={...rumble,id:'word-sprint',title:'Word Sprint',category:'Puzzle',status:'planned'};
const catalog={version:1,source:'ecovibes-roadmap',categories:['All','Racing','Puzzle'],games:[rumble,word]};
const props={ownerId:null,saver:'standard' as const,onSupport:vi.fn(),onAskAI:vi.fn()};
beforeEach(()=>{localStorage.clear();vi.stubGlobal('fetch',vi.fn(async()=>Response.json(catalog)));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
test('uses the public catalog and never loads a game or claims rankings',async()=>{
 const view=render(<GamesHub {...props}/>);
 await screen.findByRole('heading',{name:'Word Sprint'});
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(fetch).toHaveBeenCalledWith('/api/v1/games',expect.objectContaining({credentials:'include'}));
 expect(view.container.querySelector('iframe,video,canvas')).toBeNull();
 expect(screen.queryByRole('button',{name:/play now/i})).toBeNull();
 expect(screen.queryByText(/840 playing|2.4k|community challenge|leaderboard starts/i)).toBeNull();
});
test('filters category/search, clears no-match results and opens real project details',async()=>{
 render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Puzzle'}));
 expect(screen.queryByRole('button',{name:'View project: Rumble Rush: Fusion Edition'})).toBeNull();
 fireEvent.change(screen.getByRole('searchbox',{name:'Search game projects'}),{target:{value:'missing'}});
 expect(screen.getByText('No matching projects')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
 const open=screen.getByRole('button',{name:'View project: Word Sprint'});fireEvent.click(open);
 const detail=screen.getByRole('region',{name:'Word Sprint details'});
 expect(detail.textContent).toContain('Not released yet.');
 expect(within(detail).getByText('Keyboard target')).toBeTruthy();
 fireEvent.click(within(detail).getByRole('button',{name:'Close details'}));
 expect(screen.queryByRole('region',{name:'Word Sprint details'})).toBeNull();
 expect(document.activeElement).toBe(open);
});
test('saves only project IDs after storage succeeds and restores after remount',async()=>{
 const view=render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Save Word Sprint'}));
 expect(screen.getByRole('button',{name:'Remove Word Sprint from saved'}).getAttribute('aria-pressed')).toBe('true');
 view.unmount();render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Saved projects'}));
 expect(screen.getByRole('heading',{name:'Word Sprint'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'View project: Rumble Rush: Fusion Edition'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Remove Word Sprint from saved'}));
 expect(screen.getByText('Your next discovery starts here')).toBeTruthy();
});
test('does not show another account or guest saved projects when switching identities',async()=>{
 const view=render(<GamesHub {...props} ownerId="account-a"/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Save Word Sprint'}));
 view.rerender(<GamesHub {...props} ownerId="account-b"/>);await screen.findByRole('heading',{name:'Word Sprint'});
 expect(screen.getByRole('button',{name:'Save Word Sprint'}).getAttribute('aria-pressed')).toBe('false');
 view.rerender(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 expect(screen.getByRole('button',{name:'Save Word Sprint'}).getAttribute('aria-pressed')).toBe('false');
 view.rerender(<GamesHub {...props} ownerId="account-a"/>);await screen.findByRole('heading',{name:'Word Sprint'});
 expect(screen.getByRole('button',{name:'Remove Word Sprint from saved'})).toBeTruthy();
});
test('a quota/storage rejection cannot show a saved success',async()=>{
 render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('quota','QuotaExceededError');});
 fireEvent.click(screen.getByRole('button',{name:'Save Word Sprint'}));
 expect(screen.getByRole('alert').textContent).toContain('could not be saved');
 expect(screen.getByRole('button',{name:'Save Word Sprint'}).getAttribute('aria-pressed')).toBe('false');
});
test('offers a real retry after provider failure without substituting fixture projects',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({error:{message:'Catalog unavailable'}},{status:503}));
 render(<GamesHub {...props}/>);expect((await screen.findByRole('alert')).textContent).toContain('Catalog unavailable');
 expect(screen.queryByRole('heading',{name:'Word Sprint'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 expect(await screen.findByRole('heading',{name:'Word Sprint'})).toBeTruthy();
});
test.each([null,{...catalog,version:9},{...catalog,games:[{...rumble,playable:true}]},{...catalog,games:[rumble,rumble]},{...catalog,games:[{...rumble,title:{private:'not text'}}]}])('fails closed for a malformed catalog',async value=>{
 vi.mocked(fetch).mockResolvedValue(Response.json(value));render(<GamesHub {...props}/>);
 expect((await screen.findByRole('alert')).textContent).toContain('could not be read');
 expect(screen.queryByRole('button',{name:'Save Word Sprint'})).toBeNull();
});
test('opening creator guidance uses existing Chale and support instead of claiming a generator',async()=>{
 render(<GamesHub {...props} saver="extreme"/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Creator guide'}));
 fireEvent.click(screen.getByRole('button',{name:'Open Chale AI'}));expect(props.onAskAI).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Report a concern'}));expect(props.onSupport).toHaveBeenCalledOnce();
 expect(screen.getByText(/only a saved list on this device/i)).toBeTruthy();
 expect(document.querySelector('.ecogames-art')).toBeNull();
});

test('does not overwrite a corrupted saved list or claim it was recovered',async()=>{
 localStorage.setItem('ecovibes:games:saved:v1:guest','not-json');
 render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 expect(screen.getByRole('alert').textContent).toContain('has not been changed');
 const button=screen.getByRole('button',{name:'Save Word Sprint'}) as HTMLButtonElement;
 expect(button.disabled).toBe(true);fireEvent.click(button);
 expect(localStorage.getItem('ecovibes:games:saved:v1:guest')).toBe('not-json');
});
test('other-tab changes update only the matching saved-list owner',async()=>{
 render(<GamesHub {...props} ownerId="account-a"/>);await screen.findByRole('heading',{name:'Word Sprint'});
 const key='ecovibes:games:saved:v1:account%3Aaccount-a';localStorage.setItem(key,JSON.stringify(['word-sprint']));
 fireEvent(window,new StorageEvent('storage',{key:'ecovibes:games:saved:v1:account%3Aaccount-b'}));
 expect(screen.getByRole('button',{name:'Save Word Sprint'})).toBeTruthy();
 fireEvent(window,new StorageEvent('storage',{key}));
 expect(screen.getByRole('button',{name:'Remove Word Sprint from saved'})).toBeTruthy();
});

test('focuses the details region on every activation of the same project',async()=>{
 render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 const open=screen.getByRole('button',{name:'View project: Word Sprint'});
 open.focus();fireEvent.click(open);const detail=screen.getByRole('region',{name:'Word Sprint details'});expect(document.activeElement).toBe(detail);
 open.focus();fireEvent.click(open);expect(document.activeElement).toBe(detail);
});
test('returns focus to the active navigation when a saved opener was removed',async()=>{
 render(<GamesHub {...props}/>);await screen.findByRole('heading',{name:'Word Sprint'});
 fireEvent.click(screen.getByRole('button',{name:'Save Word Sprint'}));const tab=screen.getByRole('button',{name:'Saved projects'});fireEvent.click(tab);
 fireEvent.click(screen.getByRole('button',{name:'View project: Word Sprint'}));fireEvent.click(screen.getByRole('button',{name:'Remove Word Sprint from saved'}));
 fireEvent.click(screen.getByRole('button',{name:'Close details'}));expect(document.activeElement).toBe(tab);
});
